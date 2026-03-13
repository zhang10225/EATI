import { CertificateRevocationManager, BloomFilter } from '../../src/vehicular/CertificateRevocationManager';
import { RevocationReason, AgentVote, CertificateStatus, PseudonymCertificate } from '../../src/vehicular/types';

describe('BloomFilter', () => {
    let bf: BloomFilter;

    beforeEach(() => {
        bf = new BloomFilter({
            expectedElements: 1000,
            falsePositiveRate: 0.01
        });
    });

    it('should return false for elements not added', () => {
        expect(bf.mightContain('element-1')).toBe(false);
        expect(bf.mightContain('element-2')).toBe(false);
    });

    it('should return true for added elements', () => {
        bf.add('element-1');
        bf.add('element-2');

        expect(bf.mightContain('element-1')).toBe(true);
        expect(bf.mightContain('element-2')).toBe(true);
    });

    it('should have reasonable false positive rate', () => {
        // Add 100 elements
        for (let i = 0; i < 100; i++) {
            bf.add(`added-${i}`);
        }

        // Check 10000 non-added elements
        let falsePositives = 0;
        for (let i = 0; i < 10000; i++) {
            if (bf.mightContain(`not-added-${i}`)) {
                falsePositives++;
            }
        }

        // False positive rate should be reasonable (< 5% for our config)
        const fpr = falsePositives / 10000;
        expect(fpr).toBeLessThan(0.05);
    });

    it('should provide stats', () => {
        const stats = bf.getStats();
        expect(stats.bitArraySize).toBeGreaterThan(0);
        expect(stats.hashFunctionCount).toBeGreaterThan(0);
        expect(stats.fillRatio).toBe(0);

        bf.add('element-1');
        const statsAfter = bf.getStats();
        expect(statsAfter.fillRatio).toBeGreaterThan(0);
    });
});

describe('CertificateRevocationManager', () => {
    let manager: CertificateRevocationManager;

    beforeEach(() => {
        manager = new CertificateRevocationManager(
            { expectedElements: 1000, falsePositiveRate: 0.01 },
            0.6
        );
    });

    function createVotes(count: number, approve: boolean): AgentVote[] {
        return Array.from({ length: count }, (_, i) => ({
            agentId: `agent-${i}`,
            decision: approve,
            trustScore: 0.8,
            timestamp: Date.now(),
            signature: `sig-${i}`,
            evidenceHash: approve ? `evidence-${i}` : undefined
        }));
    }

    describe('Certificate Revocation', () => {
        it('should not be revoked initially', () => {
            expect(manager.isRevoked('cert-001')).toBe(false);
        });

        it('should revoke certificate when vote threshold is met', () => {
            const approveVotes = createVotes(4, true);
            const rejectVotes = createVotes(1, false).map((v, i) => ({
                ...v,
                agentId: `reject-agent-${i}`
            }));
            const allVotes = [...approveVotes, ...rejectVotes];

            const record = manager.revokeCertificate(
                'cert-001',
                RevocationReason.MISBEHAVIOR_DETECTED,
                'agent-0',
                allVotes,
                5 // 5 total agents
            );

            expect(record).not.toBeNull();
            expect(record!.certId).toBe('cert-001');
            expect(record!.voteCount).toBe(4);
            expect(manager.isRevoked('cert-001')).toBe(true);
        });

        it('should not revoke when vote threshold is not met', () => {
            const approveVotes = createVotes(2, true);
            const rejectVotes = createVotes(3, false).map((v, i) => ({
                ...v,
                agentId: `reject-agent-${i}`
            }));
            const allVotes = [...approveVotes, ...rejectVotes];

            const record = manager.revokeCertificate(
                'cert-002',
                RevocationReason.MISBEHAVIOR_DETECTED,
                'agent-0',
                allVotes,
                5
            );

            expect(record).toBeNull();
            expect(manager.isRevoked('cert-002')).toBe(false);
        });

        it('should collect evidence hashes from votes', () => {
            const votes = createVotes(5, true);
            const record = manager.revokeCertificate(
                'cert-003',
                RevocationReason.FALSE_MESSAGE,
                'agent-0',
                votes,
                5
            );

            expect(record).not.toBeNull();
            expect(record!.evidenceHashes.length).toBe(5);
        });
    });

    describe('Batch Revocation Check', () => {
        it('should batch check multiple certificates', () => {
            const votes = createVotes(5, true);
            manager.revokeCertificate('cert-A', RevocationReason.SYBIL_ATTACK, 'agent-0', votes, 5);

            const results = manager.batchCheckRevocation(['cert-A', 'cert-B', 'cert-C']);
            expect(results.get('cert-A')).toBe(true);
            expect(results.get('cert-B')).toBe(false);
            expect(results.get('cert-C')).toBe(false);
        });
    });

    describe('Revocation Records', () => {
        it('should store and retrieve revocation records', () => {
            const votes = createVotes(5, true);
            manager.revokeCertificate('cert-001', RevocationReason.KEY_COMPROMISE, 'agent-0', votes, 5);

            const record = manager.getRevocationRecord('cert-001');
            expect(record).toBeDefined();
            expect(record!.reason).toBe(RevocationReason.KEY_COMPROMISE);
        });

        it('should return undefined for non-revoked certificate', () => {
            expect(manager.getRevocationRecord('cert-unknown')).toBeUndefined();
        });

        it('should count revocations correctly', () => {
            expect(manager.getRevocationCount()).toBe(0);

            const votes = createVotes(5, true);
            manager.revokeCertificate('cert-1', RevocationReason.MISBEHAVIOR_DETECTED, 'agent-0', votes, 5);
            manager.revokeCertificate('cert-2', RevocationReason.MISBEHAVIOR_DETECTED, 'agent-0', votes, 5);

            expect(manager.getRevocationCount()).toBe(2);
        });
    });

    describe('Bloom Filter Stats', () => {
        it('should provide bloom filter statistics', () => {
            const stats = manager.getBloomFilterStats();
            expect(stats.bitArraySize).toBeGreaterThan(0);
            expect(stats.hashFunctionCount).toBeGreaterThan(0);
        });
    });
});
