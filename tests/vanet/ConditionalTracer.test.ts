import * as crypto from 'crypto';
import { ConditionalTracer } from '../../src/vanet/ConditionalTracer';
import { PseudonymManager } from '../../src/vanet/PseudonymManager';
import { AuthorityApproval } from '../../src/vanet/types';

describe('ConditionalTracer', () => {
    const AUTHORITIES = ['traffic-police', 'court', 'transport-ministry'];
    const THRESHOLD = 2; // 2-of-3
    let tracer: ConditionalTracer;

    beforeEach(() => {
        tracer = new ConditionalTracer(THRESHOLD, AUTHORITIES);
    });

    describe('constructor validation', () => {
        it('should reject threshold of 0', () => {
            expect(() => new ConditionalTracer(0, AUTHORITIES)).toThrow();
        });

        it('should reject threshold greater than authority count', () => {
            expect(() => new ConditionalTracer(4, AUTHORITIES)).toThrow();
        });

        it('should accept valid k-of-n configurations', () => {
            expect(() => new ConditionalTracer(1, AUTHORITIES)).not.toThrow();
            expect(() => new ConditionalTracer(3, AUTHORITIES)).not.toThrow(); // 3-of-3
        });

        it('should expose threshold and authority count', () => {
            expect(tracer.getThreshold()).toBe(THRESHOLD);
            expect(tracer.getAuthorityCount()).toBe(3);
        });
    });

    describe('createRequest', () => {
        it('should create a tracing request with correct fields', () => {
            const req = tracer.createRequest(
                'pseudo-abc123',
                '闯红灯并危险驾驶',
                'sha256-evidence-hash-xyz'
            );

            expect(req.requestId).toMatch(/^trace-\d+-[a-f0-9]+$/);
            expect(req.pseudoId).toBe('pseudo-abc123');
            expect(req.incidentDescription).toBe('闯红灯并危险驾驶');
            expect(req.evidenceHash).toBe('sha256-evidence-hash-xyz');
            expect(req.threshold).toBe(THRESHOLD);
            expect(req.status).toBe('pending');
            expect(req.requiredAuthorities).toEqual(AUTHORITIES);
        });

        it('should generate unique requestIds', () => {
            const req1 = tracer.createRequest('pseudo-1', 'incident-1', 'hash-1');
            const req2 = tracer.createRequest('pseudo-2', 'incident-2', 'hash-2');
            expect(req1.requestId).not.toBe(req2.requestId);
        });

        it('should be retrievable by requestId', () => {
            const req = tracer.createRequest('pseudo-xyz', '恶意 BSM 广播', 'hash-abc');
            const retrieved = tracer.getRequest(req.requestId);
            expect(retrieved).toEqual(req);
        });

        it('should return undefined for unknown requestId', () => {
            expect(tracer.getRequest('nonexistent')).toBeUndefined();
        });
    });

    describe('resolveTracing', () => {
        function makeApproval(authorityId: string, requestId: string, approved = true): AuthorityApproval {
            return {
                authorityId,
                requestId,
                approved,
                signature: `sig-${authorityId}`,
                timestamp: new Date().toISOString()
            };
        }

        it('should fail when no approvals are provided', () => {
            const req = tracer.createRequest('pseudo-001', '超速', 'hash-001');
            const result = tracer.resolveTracing(req, []);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('审批不足');
        });

        it('should fail when approvals are below threshold', () => {
            const req = tracer.createRequest('pseudo-002', '闯红灯', 'hash-002');
            const approvals = [makeApproval('traffic-police', req.requestId)];

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(false);
            expect(result.reason).toContain('1/2');
        });

        it('should succeed when threshold is exactly met', () => {
            const req = tracer.createRequest('pseudo-003', '恶意干扰', 'hash-003');
            const approvals = [
                makeApproval('traffic-police', req.requestId),
                makeApproval('court', req.requestId)
            ];

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(true);
            expect(result.approvalCount).toBe(2);
            expect(result.pseudoId).toBe('pseudo-003');
            expect(result.resolvedAt).toBeDefined();
        });

        it('should succeed when more than threshold approvals are provided', () => {
            const req = tracer.createRequest('pseudo-004', '碰撞逃逸', 'hash-004');
            const approvals = AUTHORITIES.map(a => makeApproval(a, req.requestId));

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(true);
            expect(result.approvalCount).toBe(3);
        });

        it('should ignore rejections when counting approvals', () => {
            const req = tracer.createRequest('pseudo-005', '虚假预警', 'hash-005');
            const approvals = [
                makeApproval('traffic-police', req.requestId, true),
                makeApproval('court', req.requestId, false) // rejected
            ];

            // Only 1 valid approval (court rejected)
            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(false);
        });

        it('should deduplicate multiple approvals from the same authority', () => {
            const req = tracer.createRequest('pseudo-006', '虚假信号', 'hash-006');
            // 同一机构批准两次，只应算一次
            const approvals = [
                makeApproval('traffic-police', req.requestId),
                makeApproval('traffic-police', req.requestId) // duplicate
            ];

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(false); // only 1 unique authority
        });

        it('should ignore approvals from unknown authorities', () => {
            const req = tracer.createRequest('pseudo-007', '测试', 'hash-007');
            const approvals = [
                makeApproval('traffic-police', req.requestId),
                makeApproval('unknown-authority', req.requestId) // not in authorities list
            ];

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(false); // unknown authority ignored
        });

        it('should update request status to approved on success', () => {
            const req = tracer.createRequest('pseudo-008', '测试', 'hash-008');
            const approvals = [
                makeApproval('traffic-police', req.requestId),
                makeApproval('court', req.requestId)
            ];

            tracer.resolveTracing(req, approvals);

            const updated = tracer.getRequest(req.requestId);
            expect(updated!.status).toBe('approved');
        });
    });

    describe('full end-to-end: pseudonym → incident → tracing', () => {
        it('should decode real vehicle ID after threshold approvals', () => {
            // 1. OBU 申请假名证书
            const linkageKey = crypto.randomBytes(32);
            const pm = new PseudonymManager('vehicle-皖A12345', linkageKey);
            const pseudoCert = pm.generatePseudonym();

            // 2. 执法方发现恶意行为，发起追责请求
            const req = tracer.createRequest(
                pseudoCert.pseudoId,
                '在高速公路上广播虚假碰撞预警，导致多车追尾',
                crypto.createHash('sha256').update('dashcam-video-data').digest('hex')
            );

            // 3. k 个授权机构独立审批
            const approvals: AuthorityApproval[] = [
                {
                    authorityId: 'traffic-police',
                    requestId: req.requestId,
                    approved: true,
                    signature: 'police-sig',
                    timestamp: new Date().toISOString()
                },
                {
                    authorityId: 'court',
                    requestId: req.requestId,
                    approved: true,
                    signature: 'court-sig',
                    timestamp: new Date().toISOString()
                }
            ];

            // 4. 达到门限，PCA 解密 linkageToken 揭示真实车辆
            const result = tracer.resolveTracing(
                req,
                approvals,
                pseudoCert.linkageToken,
                linkageKey
            );

            expect(result.success).toBe(true);
            expect(result.realVehicleId).toBe('vehicle-皖A12345');
            expect(result.pseudoId).toBe(pseudoCert.pseudoId);
            expect(result.approvalCount).toBe(2);
        });

        it('should not reveal real ID if threshold is not met', () => {
            const linkageKey = crypto.randomBytes(32);
            const pm = new PseudonymManager('vehicle-京B99999', linkageKey);
            const pseudoCert = pm.generatePseudonym();

            const req = tracer.createRequest(pseudoCert.pseudoId, '测试事件', 'hash-test');

            // 只有 1 个机构批准（不足门限）
            const approvals: AuthorityApproval[] = [
                {
                    authorityId: 'traffic-police',
                    requestId: req.requestId,
                    approved: true,
                    signature: 'sig1',
                    timestamp: new Date().toISOString()
                }
            ];

            const result = tracer.resolveTracing(
                req,
                approvals,
                pseudoCert.linkageToken,
                linkageKey
            );

            expect(result.success).toBe(false);
            expect(result.realVehicleId).toBeUndefined();
        });

        it('should succeed without decoding real ID when linkageToken is not provided', () => {
            const req = tracer.createRequest('pseudo-no-token', '测试无 token', 'hash');
            const approvals: AuthorityApproval[] = [
                { authorityId: 'traffic-police', requestId: req.requestId, approved: true, signature: 'sig1', timestamp: new Date().toISOString() },
                { authorityId: 'court', requestId: req.requestId, approved: true, signature: 'sig2', timestamp: new Date().toISOString() }
            ];

            const result = tracer.resolveTracing(req, approvals);
            expect(result.success).toBe(true);
            expect(result.realVehicleId).toBeUndefined();
        });
    });
});
