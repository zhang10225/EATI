import * as crypto from 'crypto';
import { VehicleIdentityManager } from './VehicleIdentityManager';
import { CertificateRevocationManager, BloomFilter } from './CertificateRevocationManager';
import { AgentCollaborativeTrust } from './AgentCollaborativeTrust';
import { AccountabilityTracer } from './AccountabilityTracer';
import {
    BloomFilterConfig,
    RSUAgent,
    AgentStatus,
    AgentVote,
    RevocationReason,
    RevocationRequestStatus,
    EvidenceType,
    AuditConclusion
} from './types';

/**
 * 性能基准测试指标
 * Performance Benchmark Metrics for GlobeCom Paper Evaluation
 */
export interface BenchmarkMetrics {
    /** 操作名称 */
    operation: string;
    /** 样本数量 */
    sampleCount: number;
    /** 平均耗时 (ms) */
    avgTimeMs: number;
    /** 最小耗时 (ms) */
    minTimeMs: number;
    /** 最大耗时 (ms) */
    maxTimeMs: number;
    /** 标准差 (ms) */
    stdDevMs: number;
    /** 吞吐量 (ops/sec) */
    throughput: number;
}

/**
 * Bloom Filter 准确性指标
 */
export interface BloomFilterAccuracyMetrics {
    /** 测试元素总数 */
    totalElements: number;
    /** 已插入元素数 */
    insertedElements: number;
    /** 真正例 (正确识别已撤销) */
    truePositives: number;
    /** 假正例 (误判为已撤销) */
    falsePositives: number;
    /** 真负例 (正确识别未撤销) */
    trueNegatives: number;
    /** 误判率 (实际) */
    actualFalsePositiveRate: number;
    /** 误判率 (理论) */
    theoreticalFalsePositiveRate: number;
}

/**
 * Agent 协同延迟指标
 */
export interface CollaborationLatencyMetrics {
    /** Agent 数量 */
    agentCount: number;
    /** 撤销发起到完成平均时间 (ms) */
    avgRevocationLatencyMs: number;
    /** 投票收集平均时间 (ms) */
    avgVotingLatencyMs: number;
    /** 信任聚合平均时间 (ms) */
    avgTrustAggregationMs: number;
}

/**
 * 综合性能报告
 */
export interface PerformanceReport {
    /** 报告生成时间 */
    generatedAt: number;
    /** 密码学操作基准 */
    cryptoBenchmarks: BenchmarkMetrics[];
    /** Bloom Filter 准确性 */
    bloomFilterAccuracy: BloomFilterAccuracyMetrics;
    /** Agent 协同延迟 */
    collaborationLatency: CollaborationLatencyMetrics;
    /** 全流程端到端延迟 (ms) */
    endToEndLatencyMs: number;
}

/**
 * 性能基准测试工具
 * 用于 GlobeCom 论文中的性能评估章节
 *
 * 评估指标:
 * 1. 签名/验签时间 - V2X 消息处理延迟
 * 2. 撤销查询时间 - CRL 查询效率 (Bloom Filter vs 线性搜索)
 * 3. Agent 协同延迟 - 从检测到撤销的总时间
 * 4. 通信开销 - 投票消息量
 * 5. Merkle Tree 操作 - 证据链构建与验证
 */
export class PerformanceBenchmark {
    /**
     * 测量单个操作的执行时间
     *
     * @param operation 待测量的操作函数
     * @param iterations 执行次数
     * @param operationName 操作名称
     * @returns 基准测试指标
     */
    public measureOperation(
        operation: () => void,
        iterations: number,
        operationName: string
    ): BenchmarkMetrics {
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            operation();
            const end = performance.now();
            times.push(end - start);
        }

        return this.computeMetrics(operationName, times);
    }

    /**
     * 基准: VID Hash 生成性能
     * 对应 EATI 的 AEID Hash 生成
     */
    public benchmarkVIDHashGeneration(iterations: number = 100): BenchmarkMetrics {
        const manager = new VehicleIdentityManager();
        const identity = manager.registerVehicle(
            'VIN_BENCH_001', 'OBU_SERIAL_001', 'HW_ID_001',
            'V2X_STATION_001', 'AA:BB:CC:DD:EE:01'
        );

        return this.measureOperation(
            () => manager.generateVIDHash(identity),
            iterations,
            'VID Hash Generation'
        );
    }

    /**
     * 基准: VID Hash 验证性能 (timing-safe)
     */
    public benchmarkVIDHashVerification(iterations: number = 100): BenchmarkMetrics {
        const manager = new VehicleIdentityManager();
        const identity = manager.registerVehicle(
            'VIN_BENCH_002', 'OBU_SERIAL_002', 'HW_ID_002',
            'V2X_STATION_002', 'AA:BB:CC:DD:EE:02'
        );
        const vidHash = manager.generateVIDHash(identity);

        return this.measureOperation(
            () => manager.verifyVIDHash(identity, vidHash.hash),
            iterations,
            'VID Hash Verification (timing-safe)'
        );
    }

    /**
     * 基准: Bloom Filter 撤销查询性能
     * 对比: 线性搜索 CRL
     *
     * @param elementCount CRL 中的元素数量
     * @param queryCount 查询次数
     */
    public benchmarkRevocationQuery(
        elementCount: number = 1000,
        queryCount: number = 100
    ): { bloomFilter: BenchmarkMetrics; linearSearch: BenchmarkMetrics } {
        // 准备 Bloom Filter CRL
        const bloomFilter = new BloomFilter({
            expectedElements: elementCount,
            falsePositiveRate: 0.001
        });
        const revokedIds: string[] = [];
        for (let i = 0; i < elementCount; i++) {
            const certId = crypto.createHash('sha256')
                .update(`cert_${i}`).digest('hex').substring(0, 32);
            bloomFilter.add(certId);
            revokedIds.push(certId);
        }

        // 准备线性搜索 CRL (Set for fair comparison)
        const linearCRL = new Set(revokedIds);

        // 准备查询目标（混合已撤销和未撤销）
        const queryTargets = revokedIds.slice(0, Math.min(queryCount, revokedIds.length));

        // 基准: Bloom Filter 查询
        const bloomMetrics = this.measureOperation(
            () => {
                for (const certId of queryTargets) {
                    bloomFilter.mightContain(certId);
                }
            },
            Math.max(1, Math.floor(queryCount / queryTargets.length)),
            `Bloom Filter Query (${elementCount} elements)`
        );

        // 基准: 线性搜索
        const linearMetrics = this.measureOperation(
            () => {
                for (const certId of queryTargets) {
                    linearCRL.has(certId);
                }
            },
            Math.max(1, Math.floor(queryCount / queryTargets.length)),
            `Linear CRL Query (${elementCount} elements)`
        );

        return { bloomFilter: bloomMetrics, linearSearch: linearMetrics };
    }

    /**
     * 基准: Bloom Filter 误判率实际测量
     *
     * @param insertCount 插入元素数
     * @param testCount 测试非存在元素数
     * @param falsePositiveRate 配置的误判率
     */
    public benchmarkBloomFilterAccuracy(
        insertCount: number = 1000,
        testCount: number = 10000,
        falsePositiveRate: number = 0.001
    ): BloomFilterAccuracyMetrics {
        const bloomFilter = new BloomFilter({
            expectedElements: insertCount,
            falsePositiveRate
        });

        // 插入元素
        const inserted = new Set<string>();
        for (let i = 0; i < insertCount; i++) {
            const id = `revoked_${i}`;
            bloomFilter.add(id);
            inserted.add(id);
        }

        // 测试已插入元素（应全部返回 true）
        let truePositives = 0;
        for (const id of inserted) {
            if (bloomFilter.mightContain(id)) {
                truePositives++;
            }
        }

        // 测试未插入元素（应返回 false，但可能误判）
        let falsePositives = 0;
        let trueNegatives = 0;
        for (let i = 0; i < testCount; i++) {
            const id = `not_revoked_${i}`;
            if (bloomFilter.mightContain(id)) {
                falsePositives++;
            } else {
                trueNegatives++;
            }
        }

        return {
            totalElements: insertCount + testCount,
            insertedElements: insertCount,
            truePositives,
            falsePositives,
            trueNegatives,
            actualFalsePositiveRate: falsePositives / testCount,
            theoreticalFalsePositiveRate: falsePositiveRate
        };
    }

    /**
     * 基准: Agent 协同撤销延迟
     * 测量从发起撤销到投票完成的全流程时间
     *
     * @param agentCount 参与 Agent 数量
     * @param iterations 执行次数
     */
    public benchmarkCollaborationLatency(
        agentCount: number = 5,
        iterations: number = 20
    ): CollaborationLatencyMetrics {
        const revocationTimes: number[] = [];
        const votingTimes: number[] = [];
        const aggregationTimes: number[] = [];

        for (let iter = 0; iter < iterations; iter++) {
            const trust = new AgentCollaborativeTrust();

            // 注册 Agents
            const agents: RSUAgent[] = [];
            for (let i = 0; i < agentCount; i++) {
                const agent: RSUAgent = {
                    agentId: `agent_${i}`,
                    location: { latitude: 39.9 + i * 0.01, longitude: 116.4 + i * 0.01 },
                    publicKey: `pk_${i}`,
                    trustWeight: 0.7 + Math.random() * 0.3,
                    coverageRadius: 500,
                    status: AgentStatus.ONLINE
                };
                trust.registerAgent(agent);
                agents.push(agent);
            }

            // 测量发起撤销时间
            const revStart = performance.now();
            const request = trust.initiateRevocation(
                agents[0].agentId,
                `cert_${iter}`,
                `vid_hash_${iter}`,
                RevocationReason.MISBEHAVIOR_DETECTED,
                0.6
            );
            const revEnd = performance.now();
            revocationTimes.push(revEnd - revStart);

            // 测量投票收集时间
            const voteStart = performance.now();
            for (let i = 0; i < agentCount; i++) {
                const currentReq = trust.getRevocationRequest(request.requestId)!;
                if (currentReq.status !== RevocationRequestStatus.VOTING) {
                    break; // Voting concluded (threshold reached early)
                }
                const vote: AgentVote = {
                    agentId: agents[i].agentId,
                    decision: true,
                    trustScore: 0.3,
                    timestamp: Date.now(),
                    signature: `sig_${i}`
                };
                trust.submitVote(request.requestId, vote);
            }
            const voteEnd = performance.now();
            votingTimes.push(voteEnd - voteStart);

            // 测量信任聚合时间
            const aggStart = performance.now();
            const evaluations = agents.map(a => trust.evaluateTrust(
                a.agentId,
                `vid_hash_${iter}`,
                0.8,
                []
            ));
            trust.aggregateTrust(evaluations);
            const aggEnd = performance.now();
            aggregationTimes.push(aggEnd - aggStart);
        }

        return {
            agentCount,
            avgRevocationLatencyMs: this.mean(revocationTimes),
            avgVotingLatencyMs: this.mean(votingTimes),
            avgTrustAggregationMs: this.mean(aggregationTimes)
        };
    }

    /**
     * 基准: Merkle Tree 构建与验证性能
     *
     * @param leafCount 叶子节点数量（证据条数）
     * @param iterations 执行次数
     */
    public benchmarkMerkleTreeOperations(
        leafCount: number = 100,
        iterations: number = 20
    ): { build: BenchmarkMetrics; verify: BenchmarkMetrics } {
        const tracer = new AccountabilityTracer();
        const leaves: string[] = [];

        // 准备叶子节点
        for (let i = 0; i < leafCount; i++) {
            leaves.push(crypto.createHash('sha256').update(`evidence_${i}`).digest('hex'));
        }

        // 基准: Merkle Tree 构建
        const buildMetrics = this.measureOperation(
            () => tracer.buildMerkleRoot(leaves),
            iterations,
            `Merkle Tree Build (${leafCount} leaves)`
        );

        // 提交证据以获得 Merkle Proof
        const submittedTracer = new AccountabilityTracer();
        for (let i = 0; i < leafCount; i++) {
            submittedTracer.submitEvidence(
                EvidenceType.MESSAGE_LOG,
                'vid_hash_bench',
                `evidence_content_${i}`,
                'agent_bench',
                `sig_${i}`
            );
        }
        const merkleRoot = submittedTracer.getMerkleRoot();
        const evidence = submittedTracer.getVehicleEvidence('vid_hash_bench');

        // 基准: Merkle Proof 验证
        const verifyMetrics = this.measureOperation(
            () => {
                for (const ev of evidence) {
                    if (ev.merkleProof && ev.merkleIndex !== undefined) {
                        submittedTracer.verifyMerkleProof(
                            ev.contentHash,
                            ev.merkleIndex,
                            ev.merkleProof,
                            merkleRoot
                        );
                    }
                }
            },
            iterations,
            `Merkle Proof Verify (${leafCount} proofs)`
        );

        return { build: buildMetrics, verify: verifyMetrics };
    }

    /**
     * 运行完整的性能评估
     * 生成 GlobeCom 论文所需的全部性能数据
     */
    public runFullBenchmark(): PerformanceReport {
        // 密码学操作基准
        const vidHashGen = this.benchmarkVIDHashGeneration();
        const vidHashVerify = this.benchmarkVIDHashVerification();
        const revocationQuery = this.benchmarkRevocationQuery();
        const merkleOps = this.benchmarkMerkleTreeOperations();

        // Bloom Filter 准确性
        const bloomAccuracy = this.benchmarkBloomFilterAccuracy();

        // Agent 协同延迟
        const collaborationLatency = this.benchmarkCollaborationLatency();

        // 端到端延迟测量
        const e2eStart = performance.now();
        this.runEndToEndScenario();
        const e2eEnd = performance.now();

        return {
            generatedAt: Date.now(),
            cryptoBenchmarks: [
                vidHashGen,
                vidHashVerify,
                revocationQuery.bloomFilter,
                revocationQuery.linearSearch,
                merkleOps.build,
                merkleOps.verify
            ],
            bloomFilterAccuracy: bloomAccuracy,
            collaborationLatency,
            endToEndLatencyMs: e2eEnd - e2eStart
        };
    }

    /**
     * 端到端场景（用于 E2E 延迟测量）
     */
    private runEndToEndScenario(): void {
        // 1. 车辆注册
        const idManager = new VehicleIdentityManager();
        const identity = idManager.registerVehicle(
            'VIN_E2E', 'OBU_E2E', 'HW_E2E', 'V2X_E2E', 'AA:BB:CC:DD:EE:FF'
        );
        const vidHash = idManager.generateVIDHash(identity);

        // 2. 颁发证书
        const cert = idManager.issuePseudonymCertificate('VIN_E2E', 'TA_001');

        // 3. Agent 协同检测
        const trust = new AgentCollaborativeTrust();
        for (let i = 0; i < 3; i++) {
            trust.registerAgent({
                agentId: `agent_e2e_${i}`,
                location: { latitude: 39.9, longitude: 116.4 },
                publicKey: `pk_e2e_${i}`,
                trustWeight: 0.8,
                coverageRadius: 500,
                status: AgentStatus.ONLINE
            });
        }

        // 4. 发起撤销
        const request = trust.initiateRevocation(
            'agent_e2e_0', cert.certId, vidHash.hash,
            RevocationReason.MISBEHAVIOR_DETECTED
        );

        // 5. Agent 投票
        for (let i = 0; i < 3; i++) {
            const currentReq = trust.getRevocationRequest(request.requestId)!;
            if (currentReq.status !== RevocationRequestStatus.VOTING) {
                break;
            }
            trust.submitVote(request.requestId, {
                agentId: `agent_e2e_${i}`,
                decision: true,
                trustScore: 0.3,
                timestamp: Date.now(),
                signature: `sig_e2e_${i}`
            });
        }

        // 6. 执行撤销
        const finalReq = trust.getRevocationRequest(request.requestId)!;
        const revManager = new CertificateRevocationManager();
        revManager.registerCertificate(cert);
        revManager.revokeCertificate(
            cert.certId,
            RevocationReason.MISBEHAVIOR_DETECTED,
            'agent_e2e_0',
            finalReq.votes,
            3
        );

        // 7. 记录证据
        const tracer = new AccountabilityTracer();
        tracer.submitEvidence(
            EvidenceType.COLLABORATIVE_DETECTION,
            vidHash.hash,
            'Misbehavior evidence from collaborative detection',
            'agent_e2e_0',
            'evidence_sig'
        );

        // 8. 生成审计报告
        tracer.generateAuditReport(
            vidHash.hash,
            ['agent_e2e_0', 'agent_e2e_1', 'agent_e2e_2'],
            AuditConclusion.MALICIOUS,
            [
                { agentId: 'agent_e2e_0', signature: 'audit_sig_0' },
                { agentId: 'agent_e2e_1', signature: 'audit_sig_1' },
                { agentId: 'agent_e2e_2', signature: 'audit_sig_2' }
            ]
        );
    }

    /**
     * 计算统计指标
     */
    private computeMetrics(operationName: string, times: number[]): BenchmarkMetrics {
        const avg = this.mean(times);
        const min = Math.min(...times);
        const max = Math.max(...times);
        const stdDev = this.stdDev(times, avg);
        const throughput = avg > 0 ? 1000 / avg : 0;

        return {
            operation: operationName,
            sampleCount: times.length,
            avgTimeMs: avg,
            minTimeMs: min,
            maxTimeMs: max,
            stdDevMs: stdDev,
            throughput
        };
    }

    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    private stdDev(values: number[], avg: number): number {
        if (values.length <= 1) return 0;
        const squaredDiffs = values.map(v => (v - avg) ** 2);
        return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
    }
}
