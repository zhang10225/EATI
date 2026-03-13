import { AccountabilityTracer } from '../../src/vehicular/AccountabilityTracer';
import { EvidenceType, AuditConclusion } from '../../src/vehicular/types';

describe('AccountabilityTracer', () => {
    let tracer: AccountabilityTracer;

    beforeEach(() => {
        tracer = new AccountabilityTracer();
    });

    describe('Evidence Submission', () => {
        it('should submit evidence and return record', () => {
            const record = tracer.submitEvidence(
                EvidenceType.MESSAGE_LOG,
                'vehicle-hash-001',
                'V2X message content: speed=60, heading=180',
                'RSU-001',
                'signature-data'
            );

            expect(record.evidenceId).toMatch(/^[0-9a-f]{32}$/);
            expect(record.type).toBe(EvidenceType.MESSAGE_LOG);
            expect(record.vehicleVidHash).toBe('vehicle-hash-001');
            expect(record.contentHash).toMatch(/^[0-9a-f]{64}$/);
            expect(record.collectedBy).toBe('RSU-001');
            expect(record.merkleIndex).toBe(0);
        });

        it('should assign sequential merkle indices', () => {
            const r1 = tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            const r2 = tracer.submitEvidence(EvidenceType.LOCATION_ANOMALY, 'vh-1', 'content-2', 'RSU-2', 'sig-2');
            const r3 = tracer.submitEvidence(EvidenceType.SPEED_ANOMALY, 'vh-1', 'content-3', 'RSU-3', 'sig-3');

            expect(r1.merkleIndex).toBe(0);
            expect(r2.merkleIndex).toBe(1);
            expect(r3.merkleIndex).toBe(2);
        });

        it('should count evidence correctly', () => {
            expect(tracer.getEvidenceCount()).toBe(0);

            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');

            expect(tracer.getEvidenceCount()).toBe(2);
        });
    });

    describe('Merkle Tree', () => {
        it('should build merkle root from single leaf', () => {
            const root = tracer.buildMerkleRoot(['hash-1']);
            expect(root).toBe('hash-1');
        });

        it('should build merkle root from two leaves', () => {
            const root = tracer.buildMerkleRoot(['hash-1', 'hash-2']);
            expect(root).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should build merkle root from multiple leaves', () => {
            const root = tracer.buildMerkleRoot(['h1', 'h2', 'h3', 'h4']);
            expect(root).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should return empty string for empty leaves', () => {
            expect(tracer.buildMerkleRoot([])).toBe('');
        });

        it('should update merkle root on evidence submission', () => {
            expect(tracer.getMerkleRoot()).toBe('');

            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            const root1 = tracer.getMerkleRoot();
            expect(root1).toMatch(/^[0-9a-f]{64}$/);

            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');
            const root2 = tracer.getMerkleRoot();
            expect(root2).not.toBe(root1);
        });

        it('should generate and include merkle proof in evidence', () => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            const r2 = tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');

            expect(r2.merkleProof).toBeDefined();
            expect(r2.merkleProof!.length).toBeGreaterThan(0);
        });
    });

    describe('Merkle Proof Verification', () => {
        it('should verify valid merkle proof for single element', () => {
            const record = tracer.submitEvidence(
                EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1'
            );

            const isValid = tracer.verifyMerkleProof(
                record.contentHash,
                record.merkleIndex!,
                record.merkleProof || [],
                tracer.getMerkleRoot()
            );

            expect(isValid).toBe(true);
        });

        it('should verify valid merkle proof for two elements', () => {
            const r1 = tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');

            // Re-generate proof for r1 after second element is added
            const proof = tracer.generateMerkleProof(0);
            const isValid = tracer.verifyMerkleProof(
                r1.contentHash,
                0,
                proof,
                tracer.getMerkleRoot()
            );

            expect(isValid).toBe(true);
        });

        it('should reject invalid content hash', () => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');

            const proof = tracer.generateMerkleProof(0);
            const isValid = tracer.verifyMerkleProof(
                'tampered-hash',
                0,
                proof,
                tracer.getMerkleRoot()
            );

            expect(isValid).toBe(false);
        });
    });

    describe('Evidence Queries', () => {
        beforeEach(() => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.LOCATION_ANOMALY, 'vh-1', 'content-2', 'RSU-2', 'sig-2');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-2', 'content-3', 'RSU-1', 'sig-3');
        });

        it('should get evidence by vehicle', () => {
            const evidence = tracer.getVehicleEvidence('vh-1');
            expect(evidence.length).toBe(2);
        });

        it('should get evidence by type', () => {
            const evidence = tracer.getEvidenceByType(EvidenceType.MESSAGE_LOG);
            expect(evidence.length).toBe(2);
        });

        it('should return empty for unknown vehicle', () => {
            expect(tracer.getVehicleEvidence('unknown').length).toBe(0);
        });
    });

    describe('Chain Integrity Verification', () => {
        it('should verify chain integrity for empty chain', () => {
            expect(tracer.verifyChainIntegrity()).toBe(true);
        });

        it('should verify chain integrity for populated chain', () => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-2', 'RSU-2', 'sig-2');
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-3', 'RSU-3', 'sig-3');

            expect(tracer.verifyChainIntegrity()).toBe(true);
        });
    });

    describe('Audit Report', () => {
        it('should generate audit report', () => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');
            tracer.submitEvidence(EvidenceType.LOCATION_ANOMALY, 'vh-1', 'content-2', 'RSU-2', 'sig-2');

            const report = tracer.generateAuditReport(
                'vh-1',
                ['RSU-1', 'RSU-2', 'RSU-3'],
                AuditConclusion.SUSPICIOUS,
                [
                    { agentId: 'RSU-1', signature: 'audit-sig-1' },
                    { agentId: 'RSU-2', signature: 'audit-sig-2' },
                    { agentId: 'RSU-3', signature: 'audit-sig-3' }
                ]
            );

            expect(report.reportId).toMatch(/^[0-9a-f]{32}$/);
            expect(report.vehicleVidHash).toBe('vh-1');
            expect(report.evidenceRecords.length).toBe(2);
            expect(report.auditorAgents.length).toBe(3);
            expect(report.conclusion).toBe(AuditConclusion.SUSPICIOUS);
            expect(report.merkleRoot).toBe(tracer.getMerkleRoot());
            expect(report.signatures.length).toBe(3);
        });

        it('should retrieve audit report by id', () => {
            tracer.submitEvidence(EvidenceType.MESSAGE_LOG, 'vh-1', 'content-1', 'RSU-1', 'sig-1');

            const report = tracer.generateAuditReport(
                'vh-1', ['RSU-1'], AuditConclusion.NORMAL,
                [{ agentId: 'RSU-1', signature: 'sig' }]
            );

            const retrieved = tracer.getAuditReport(report.reportId);
            expect(retrieved).toBeDefined();
            expect(retrieved!.reportId).toBe(report.reportId);
        });

        it('should return undefined for non-existent report', () => {
            expect(tracer.getAuditReport('non-existent')).toBeUndefined();
        });
    });
});
