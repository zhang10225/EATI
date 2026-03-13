import { PerformanceBenchmark } from '../../src/vehicular/PerformanceBenchmark';

describe('PerformanceBenchmark', () => {
    let benchmark: PerformanceBenchmark;

    beforeEach(() => {
        benchmark = new PerformanceBenchmark();
    });

    describe('measureOperation', () => {
        it('should measure operation timing correctly', () => {
            const metrics = benchmark.measureOperation(
                () => { let sum = 0; for (let i = 0; i < 1000; i++) sum += i; },
                10,
                'test operation'
            );

            expect(metrics.operation).toBe('test operation');
            expect(metrics.sampleCount).toBe(10);
            expect(metrics.avgTimeMs).toBeGreaterThanOrEqual(0);
            expect(metrics.minTimeMs).toBeLessThanOrEqual(metrics.avgTimeMs);
            expect(metrics.maxTimeMs).toBeGreaterThanOrEqual(metrics.avgTimeMs);
            expect(metrics.stdDevMs).toBeGreaterThanOrEqual(0);
            expect(metrics.throughput).toBeGreaterThan(0);
        });
    });

    describe('VID Hash Benchmarks', () => {
        it('should benchmark VID hash generation', () => {
            const metrics = benchmark.benchmarkVIDHashGeneration(10);

            expect(metrics.operation).toBe('VID Hash Generation');
            expect(metrics.sampleCount).toBe(10);
            expect(metrics.avgTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('should benchmark VID hash verification', () => {
            const metrics = benchmark.benchmarkVIDHashVerification(10);

            expect(metrics.operation).toBe('VID Hash Verification (timing-safe)');
            expect(metrics.sampleCount).toBe(10);
            expect(metrics.avgTimeMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Revocation Query Benchmarks', () => {
        it('should benchmark Bloom Filter vs linear search', () => {
            const result = benchmark.benchmarkRevocationQuery(100, 50);

            expect(result.bloomFilter.operation).toContain('Bloom Filter');
            expect(result.linearSearch.operation).toContain('Linear CRL');
            expect(result.bloomFilter.avgTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.linearSearch.avgTimeMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Bloom Filter Accuracy', () => {
        it('should measure Bloom Filter false positive rate', () => {
            const metrics = benchmark.benchmarkBloomFilterAccuracy(100, 1000, 0.01);

            expect(metrics.insertedElements).toBe(100);
            expect(metrics.truePositives).toBe(100); // No false negatives
            expect(metrics.trueNegatives + metrics.falsePositives).toBe(1000);
            expect(metrics.actualFalsePositiveRate).toBeLessThan(0.1); // Should be reasonably low
            expect(metrics.theoreticalFalsePositiveRate).toBe(0.01);
        });

        it('should have zero false negatives', () => {
            const metrics = benchmark.benchmarkBloomFilterAccuracy(50, 500, 0.001);
            // Bloom filter guarantee: no false negatives
            expect(metrics.truePositives).toBe(50);
        });
    });

    describe('Collaboration Latency', () => {
        it('should benchmark agent collaboration latency', () => {
            const metrics = benchmark.benchmarkCollaborationLatency(3, 5);

            expect(metrics.agentCount).toBe(3);
            expect(metrics.avgRevocationLatencyMs).toBeGreaterThanOrEqual(0);
            expect(metrics.avgVotingLatencyMs).toBeGreaterThanOrEqual(0);
            expect(metrics.avgTrustAggregationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Merkle Tree Benchmarks', () => {
        it('should benchmark Merkle tree build and verify', () => {
            const result = benchmark.benchmarkMerkleTreeOperations(20, 5);

            expect(result.build.operation).toContain('Merkle Tree Build');
            expect(result.verify.operation).toContain('Merkle Proof Verify');
            expect(result.build.avgTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.verify.avgTimeMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Full Benchmark Report', () => {
        it('should generate a complete performance report', () => {
            const report = benchmark.runFullBenchmark();

            expect(report.generatedAt).toBeGreaterThan(0);
            expect(report.cryptoBenchmarks.length).toBe(6);
            expect(report.bloomFilterAccuracy.truePositives).toBeGreaterThan(0);
            expect(report.collaborationLatency.agentCount).toBe(5);
            expect(report.endToEndLatencyMs).toBeGreaterThan(0);
        }, 30000); // Allow 30s for full benchmark
    });
});
