import { AgentCollaborativeTrust } from '../../src/vehicular/AgentCollaborativeTrust';
import {
    RSUAgent,
    AgentStatus,
    AgentVote,
    RevocationReason,
    RevocationRequestStatus
} from '../../src/vehicular/types';

describe('AgentCollaborativeTrust', () => {
    let trust: AgentCollaborativeTrust;

    beforeEach(() => {
        trust = new AgentCollaborativeTrust(0.6, 0.4, 0.05, 30000);
    });

    function createAgent(id: string, weight: number = 0.8): RSUAgent {
        return {
            agentId: id,
            location: { latitude: 39.9 + Math.random() * 0.1, longitude: 116.3 + Math.random() * 0.1 },
            publicKey: `-----BEGIN PUBLIC KEY-----\nMOCK_KEY_${id}\n-----END PUBLIC KEY-----`,
            trustWeight: weight,
            coverageRadius: 500,
            status: AgentStatus.ONLINE
        };
    }

    function createVote(agentId: string, decision: boolean, trustScore: number = 0.8): AgentVote {
        return {
            agentId,
            decision,
            trustScore,
            timestamp: Date.now(),
            signature: `sig-${agentId}`,
            evidenceHash: decision ? `evidence-${agentId}` : undefined
        };
    }

    describe('Agent Registration', () => {
        it('should register agents', () => {
            trust.registerAgent(createAgent('RSU-001'));
            trust.registerAgent(createAgent('RSU-002'));
            expect(trust.getAgentCount()).toBe(2);
        });

        it('should return online agents', () => {
            const agent1 = createAgent('RSU-001');
            const agent2 = createAgent('RSU-002');
            agent2.status = AgentStatus.OFFLINE;

            trust.registerAgent(agent1);
            trust.registerAgent(agent2);

            const onlineAgents = trust.getOnlineAgents();
            expect(onlineAgents.length).toBe(1);
            expect(onlineAgents[0].agentId).toBe('RSU-001');
        });

        it('should get agent by id', () => {
            trust.registerAgent(createAgent('RSU-001'));
            const agent = trust.getAgent('RSU-001');
            expect(agent).toBeDefined();
            expect(agent!.agentId).toBe('RSU-001');
        });
    });

    describe('Trust Evaluation', () => {
        beforeEach(() => {
            trust.registerAgent(createAgent('RSU-001', 0.8));
            trust.registerAgent(createAgent('RSU-002', 0.7));
            trust.registerAgent(createAgent('RSU-003', 0.9));
        });

        it('should evaluate trust with direct and indirect components', () => {
            const evaluation = trust.evaluateTrust(
                'RSU-001',
                'vehicle-hash-001',
                0.9, // direct observation
                [
                    { agentId: 'RSU-002', trustValue: 0.85, weight: 0.7 },
                    { agentId: 'RSU-003', trustValue: 0.75, weight: 0.9 }
                ]
            );

            expect(evaluation.directTrust).toBe(0.9);
            expect(evaluation.indirectTrust).toBeGreaterThan(0);
            expect(evaluation.overallTrust).toBeGreaterThan(0);
            expect(evaluation.overallTrust).toBeLessThanOrEqual(1);
            expect(evaluation.evaluatorAgentId).toBe('RSU-001');
            expect(evaluation.vehicleVidHash).toBe('vehicle-hash-001');
        });

        it('should clamp direct trust to [0, 1]', () => {
            const evalHigh = trust.evaluateTrust('RSU-001', 'vh-1', 1.5, []);
            expect(evalHigh.directTrust).toBe(1);

            const evalLow = trust.evaluateTrust('RSU-001', 'vh-2', -0.5, []);
            expect(evalLow.directTrust).toBe(0);
        });

        it('should use default indirect trust when no recommendations', () => {
            const evaluation = trust.evaluateTrust('RSU-001', 'vh-1', 0.8, []);
            // indirectTrust should be 0.5 (default when no recommendations)
            expect(evaluation.indirectTrust).toBe(0.5);
        });

        it('should store trust history', () => {
            trust.evaluateTrust('RSU-001', 'vh-1', 0.8, []);
            trust.evaluateTrust('RSU-001', 'vh-1', 0.7, []);

            const history = trust.getTrustHistory('RSU-001', 'vh-1');
            expect(history.length).toBe(2);
        });
    });

    describe('Trust Aggregation', () => {
        beforeEach(() => {
            trust.registerAgent(createAgent('RSU-001', 0.8));
            trust.registerAgent(createAgent('RSU-002', 0.6));
            trust.registerAgent(createAgent('RSU-003', 0.9));
        });

        it('should aggregate trust from multiple agents', () => {
            const eval1 = trust.evaluateTrust('RSU-001', 'vh-1', 0.9, []);
            const eval2 = trust.evaluateTrust('RSU-002', 'vh-1', 0.8, []);
            const eval3 = trust.evaluateTrust('RSU-003', 'vh-1', 0.7, []);

            const aggregated = trust.aggregateTrust([eval1, eval2, eval3]);
            expect(aggregated).toBeGreaterThan(0);
            expect(aggregated).toBeLessThanOrEqual(1);
        });

        it('should return 0.5 for empty evaluations', () => {
            expect(trust.aggregateTrust([])).toBe(0.5);
        });
    });

    describe('Collaborative Revocation', () => {
        beforeEach(() => {
            for (let i = 1; i <= 5; i++) {
                trust.registerAgent(createAgent(`RSU-00${i}`, 0.8));
            }
        });

        it('should initiate revocation request', () => {
            const request = trust.initiateRevocation(
                'RSU-001',
                'cert-001',
                'vh-001',
                RevocationReason.MISBEHAVIOR_DETECTED
            );

            expect(request.requestId).toBeDefined();
            expect(request.targetCertId).toBe('cert-001');
            expect(request.status).toBe(RevocationRequestStatus.VOTING);
            expect(request.totalAgents).toBe(5);
        });

        it('should approve when enough votes are collected', () => {
            const request = trust.initiateRevocation(
                'RSU-001', 'cert-001', 'vh-001', RevocationReason.FALSE_MESSAGE, 0.6
            );

            // 5 agents, threshold 0.6 → need 3 approvals
            trust.submitVote(request.requestId, createVote('RSU-001', true));
            trust.submitVote(request.requestId, createVote('RSU-002', true));
            const result = trust.submitVote(request.requestId, createVote('RSU-003', true));

            expect(result.status).toBe(RevocationRequestStatus.APPROVED);
        });

        it('should reject when impossible to reach threshold', () => {
            const request = trust.initiateRevocation(
                'RSU-001', 'cert-001', 'vh-001', RevocationReason.MISBEHAVIOR_DETECTED, 0.6
            );

            // 5 agents, threshold 0.6 → need 3 approvals
            // After 3 rejections, only 2 votes remain → impossible to reach 3
            trust.submitVote(request.requestId, createVote('RSU-001', false));
            trust.submitVote(request.requestId, createVote('RSU-002', false));
            const result = trust.submitVote(request.requestId, createVote('RSU-003', false));

            expect(result.status).toBe(RevocationRequestStatus.REJECTED);
        });

        it('should prevent duplicate voting', () => {
            const request = trust.initiateRevocation(
                'RSU-001', 'cert-001', 'vh-001', RevocationReason.MISBEHAVIOR_DETECTED
            );

            trust.submitVote(request.requestId, createVote('RSU-001', true));

            expect(() => {
                trust.submitVote(request.requestId, createVote('RSU-001', true));
            }).toThrow('Agent RSU-001 has already voted');
        });

        it('should throw for non-existent request', () => {
            expect(() => {
                trust.submitVote('non-existent', createVote('RSU-001', true));
            }).toThrow('Revocation request not found');
        });

        it('should list approved requests', () => {
            const request = trust.initiateRevocation(
                'RSU-001', 'cert-001', 'vh-001', RevocationReason.MISBEHAVIOR_DETECTED, 0.6
            );

            trust.submitVote(request.requestId, createVote('RSU-001', true));
            trust.submitVote(request.requestId, createVote('RSU-002', true));
            trust.submitVote(request.requestId, createVote('RSU-003', true));

            const approved = trust.getApprovedRequests();
            expect(approved.length).toBe(1);
            expect(approved[0].targetCertId).toBe('cert-001');
        });
    });
});
