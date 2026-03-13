import { VehicleIdentityManager } from './VehicleIdentityManager';
import { CertificateRevocationManager } from './CertificateRevocationManager';
import { AgentCollaborativeTrust } from './AgentCollaborativeTrust';
import { AccountabilityTracer } from './AccountabilityTracer';
import {
    RSUAgent,
    AgentStatus,
    AgentVote,
    RevocationReason,
    RevocationRequestStatus,
    EvidenceType,
    AuditConclusion,
    PseudonymCertificate,
    VehicleIdentity,
    VehicleIdentityHash,
    CollaborativeRevocationRequest,
    RevocationRecord,
    AuditReport
} from './types';

/**
 * 集成场景步骤
 */
export enum ScenarioStep {
    VEHICLE_REGISTRATION = 'vehicle_registration',
    CERTIFICATE_ISSUANCE = 'certificate_issuance',
    AGENT_SETUP = 'agent_setup',
    MISBEHAVIOR_DETECTION = 'misbehavior_detection',
    TRUST_EVALUATION = 'trust_evaluation',
    COLLABORATIVE_REVOCATION = 'collaborative_revocation',
    REVOCATION_EXECUTION = 'revocation_execution',
    EVIDENCE_COLLECTION = 'evidence_collection',
    ACCOUNTABILITY_AUDIT = 'accountability_audit',
    IDENTITY_RESOLUTION = 'identity_resolution'
}

/**
 * 场景执行结果
 */
export interface ScenarioResult {
    /** 场景名称 */
    scenarioName: string;
    /** 执行步骤与结果 */
    steps: {
        step: ScenarioStep;
        success: boolean;
        durationMs: number;
        details: string;
    }[];
    /** 总耗时 */
    totalDurationMs: number;
    /** 是否全部成功 */
    allPassed: boolean;
}

/**
 * 端到端集成场景
 * 演示 EATI-V2X 系统的完整工作流程
 *
 * 场景说明:
 * 1. 车辆注册 → 获得 VID（基于 EATI 的 AEID 思想）
 * 2. 颁发假名证书 → 车辆获得 V2X 通信凭证
 * 3. RSU Agent 部署 → 建立协同信任网络
 * 4. 恶意行为检测 → Agent 发现异常
 * 5. 信任评估 → 多 Agent 协同评估
 * 6. 协同撤销投票 → t-of-n 阈值决策
 * 7. 撤销执行 → 更新 Bloom Filter CRL
 * 8. 证据收集 → Merkle Tree 存证
 * 9. 审计报告 → 多 Agent 联合审计
 * 10. 身份追溯 → TA 恢复真实身份
 */
export class IntegrationScenario {
    private idManager: VehicleIdentityManager;
    private revocationManager: CertificateRevocationManager;
    private trustManager: AgentCollaborativeTrust;
    private tracer: AccountabilityTracer;

    constructor() {
        this.idManager = new VehicleIdentityManager();
        this.revocationManager = new CertificateRevocationManager();
        this.trustManager = new AgentCollaborativeTrust();
        this.tracer = new AccountabilityTracer();
    }

    /**
     * 运行完整的恶意车辆检测 → 撤销 → 追责场景
     *
     * @param maliciousVIN 恶意车辆 VIN
     * @param agentCount 参与 Agent 数量
     * @returns 场景执行结果
     */
    public runMisbehaviorScenario(
        maliciousVIN: string = 'VIN_MALICIOUS_001',
        agentCount: number = 5
    ): ScenarioResult {
        const steps: ScenarioResult['steps'] = [];
        const scenarioStart = performance.now();

        // Step 1: 车辆注册
        let identity: VehicleIdentity;
        let vidHash: VehicleIdentityHash;
        steps.push(this.executeStep(ScenarioStep.VEHICLE_REGISTRATION, () => {
            identity = this.idManager.registerVehicle(
                maliciousVIN,
                `OBU_${maliciousVIN}`,
                `HW_${maliciousVIN}`,
                `V2X_${maliciousVIN}`,
                'AA:BB:CC:DD:EE:01'
            );
            vidHash = this.idManager.generateVIDHash(identity!);
            return `Registered vehicle ${maliciousVIN}, VID hash: ${vidHash!.hash.substring(0, 16)}...`;
        }));

        // Step 2: 颁发假名证书
        let cert: PseudonymCertificate;
        steps.push(this.executeStep(ScenarioStep.CERTIFICATE_ISSUANCE, () => {
            cert = this.idManager.issuePseudonymCertificate(maliciousVIN, 'TA_001');
            this.revocationManager.registerCertificate(cert!);
            return `Issued certificate ${cert!.certId.substring(0, 16)}..., status: ${cert!.status}`;
        }));

        // Step 3: 部署 RSU Agents
        const agents: RSUAgent[] = [];
        steps.push(this.executeStep(ScenarioStep.AGENT_SETUP, () => {
            for (let i = 0; i < agentCount; i++) {
                const agent: RSUAgent = {
                    agentId: `RSU_AGENT_${i}`,
                    location: { latitude: 39.9 + i * 0.01, longitude: 116.4 + i * 0.01 },
                    publicKey: `pk_agent_${i}`,
                    trustWeight: 0.7 + (i % 3) * 0.1,
                    coverageRadius: 500,
                    status: AgentStatus.ONLINE
                };
                this.trustManager.registerAgent(agent);
                agents.push(agent);
            }
            return `Deployed ${agentCount} RSU Agents, all ONLINE`;
        }));

        // Step 4: 恶意行为检测 - 多个 Agent 记录证据
        steps.push(this.executeStep(ScenarioStep.MISBEHAVIOR_DETECTION, () => {
            // 多个 Agent 独立检测到异常
            this.tracer.submitEvidence(
                EvidenceType.MESSAGE_LOG,
                vidHash!.hash,
                `Vehicle ${maliciousVIN} sent false position (reported: 40.0N, actual: 39.9N)`,
                agents[0].agentId,
                'detection_sig_0'
            );
            this.tracer.submitEvidence(
                EvidenceType.SPEED_ANOMALY,
                vidHash!.hash,
                `Vehicle ${maliciousVIN} reported speed 200km/h in urban area`,
                agents[1].agentId,
                'detection_sig_1'
            );
            this.tracer.submitEvidence(
                EvidenceType.LOCATION_ANOMALY,
                vidHash!.hash,
                `Vehicle ${maliciousVIN} position inconsistency detected by triangulation`,
                agents[2].agentId,
                'detection_sig_2'
            );
            const evidenceCount = this.tracer.getVehicleEvidence(vidHash!.hash).length;
            return `Detected misbehavior, ${evidenceCount} evidence records collected by multiple Agents`;
        }));

        // Step 5: 信任评估 - 多 Agent 协同评估
        steps.push(this.executeStep(ScenarioStep.TRUST_EVALUATION, () => {
            const evaluations = agents.map((agent, i) => {
                // 直接观测：前 3 个 Agent 检测到异常，给低分
                const directObservation = i < 3 ? 0.2 : 0.5;
                // 间接推荐：基于邻居 Agent 的推荐
                const recommendations = agents
                    .filter(a => a.agentId !== agent.agentId)
                    .slice(0, 2)
                    .map(a => ({
                        agentId: a.agentId,
                        trustValue: 0.3,
                        weight: a.trustWeight
                    }));

                return this.trustManager.evaluateTrust(
                    agent.agentId,
                    vidHash!.hash,
                    directObservation,
                    recommendations
                );
            });

            const aggregatedTrust = this.trustManager.aggregateTrust(evaluations);
            return `Aggregated trust score: ${aggregatedTrust.toFixed(4)} (threshold for revocation: < 0.5)`;
        }));

        // Step 6: 协同撤销投票
        let revocationRequest: CollaborativeRevocationRequest;
        steps.push(this.executeStep(ScenarioStep.COLLABORATIVE_REVOCATION, () => {
            // Agent 0 发起撤销
            revocationRequest = this.trustManager.initiateRevocation(
                agents[0].agentId,
                cert!.certId,
                vidHash!.hash,
                RevocationReason.MISBEHAVIOR_DETECTED,
                0.6
            );

            // 所有 Agent 投票
            for (let i = 0; i < agentCount; i++) {
                const currentReq = this.trustManager.getRevocationRequest(revocationRequest!.requestId)!;
                if (currentReq.status !== RevocationRequestStatus.VOTING) {
                    break; // Threshold reached, stop voting
                }
                // 前 4 个同意，最后 1 个反对
                const vote: AgentVote = {
                    agentId: agents[i].agentId,
                    decision: i < agentCount - 1, // 多数同意
                    trustScore: i < 3 ? 0.2 : 0.5,
                    timestamp: Date.now(),
                    signature: `vote_sig_${i}`,
                    evidenceHash: i < 3
                        ? this.tracer.getVehicleEvidence(vidHash!.hash)[i]?.contentHash
                        : undefined
                };
                this.trustManager.submitVote(revocationRequest!.requestId, vote);
            }

            const finalRequest = this.trustManager.getRevocationRequest(revocationRequest!.requestId)!;
            const approvals = finalRequest.votes.filter(v => v.decision).length;
            return `Voting complete: ${approvals}/${agentCount} approved, status: ${finalRequest.status}`;
        }));

        // Step 7: 执行撤销
        let revocationRecord: RevocationRecord | null;
        steps.push(this.executeStep(ScenarioStep.REVOCATION_EXECUTION, () => {
            const finalRequest = this.trustManager.getRevocationRequest(revocationRequest!.requestId)!;
            revocationRecord = this.revocationManager.revokeCertificate(
                cert!.certId,
                RevocationReason.MISBEHAVIOR_DETECTED,
                agents[0].agentId,
                finalRequest.votes,
                agentCount
            );

            const isRevoked = this.revocationManager.isRevoked(cert!.certId);
            return `Certificate revoked: ${isRevoked}, Bloom Filter updated, record ID: ${revocationRecord?.certId?.substring(0, 16)}...`;
        }));

        // Step 8: 证据链完善
        steps.push(this.executeStep(ScenarioStep.EVIDENCE_COLLECTION, () => {
            // 记录撤销决策本身作为证据
            this.tracer.submitEvidence(
                EvidenceType.COLLABORATIVE_DETECTION,
                vidHash!.hash,
                `Collaborative revocation decision: ${agentCount - 1}/${agentCount} agents approved revocation`,
                agents[0].agentId,
                'revocation_decision_sig'
            );

            const integrityOk = this.tracer.verifyChainIntegrity();
            const evidenceCount = this.tracer.getVehicleEvidence(vidHash!.hash).length;
            return `Evidence chain: ${evidenceCount} records, Merkle root: ${this.tracer.getMerkleRoot().substring(0, 16)}..., integrity: ${integrityOk ? 'OK' : 'CORRUPTED'}`;
        }));

        // Step 9: 生成审计报告
        let auditReport: AuditReport;
        steps.push(this.executeStep(ScenarioStep.ACCOUNTABILITY_AUDIT, () => {
            auditReport = this.tracer.generateAuditReport(
                vidHash!.hash,
                agents.map(a => a.agentId),
                AuditConclusion.MALICIOUS,
                agents.map(a => ({ agentId: a.agentId, signature: `audit_sig_${a.agentId}` }))
            );
            return `Audit report generated: ${auditReport!.reportId.substring(0, 16)}..., conclusion: ${auditReport!.conclusion}, auditors: ${auditReport!.auditorAgents.length}`;
        }));

        // Step 10: 身份追溯
        steps.push(this.executeStep(ScenarioStep.IDENTITY_RESOLUTION, () => {
            const resolvedVIN = this.idManager.resolveIdentity(vidHash!.hash);
            return `Identity resolved: VID hash ${vidHash!.hash.substring(0, 16)}... → VIN: ${resolvedVIN}`;
        }));

        const scenarioEnd = performance.now();

        return {
            scenarioName: 'Misbehavior Detection → Collaborative Revocation → Accountability',
            steps,
            totalDurationMs: scenarioEnd - scenarioStart,
            allPassed: steps.every(s => s.success)
        };
    }

    /**
     * 运行 Sybil 攻击检测场景
     * 场景：一辆车使用多个假身份进行 Sybil 攻击
     */
    public runSybilAttackScenario(
        attackerVIN: string = 'VIN_SYBIL_ATTACKER',
        fakeIdentityCount: number = 3
    ): ScenarioResult {
        const steps: ScenarioResult['steps'] = [];
        const scenarioStart = performance.now();

        // Step 1: 攻击者注册（合法身份）
        steps.push(this.executeStep(ScenarioStep.VEHICLE_REGISTRATION, () => {
            this.idManager.registerVehicle(
                attackerVIN, `OBU_${attackerVIN}`, `HW_${attackerVIN}`,
                `V2X_${attackerVIN}`, 'FF:EE:DD:CC:BB:AA'
            );
            return `Attacker registered with VIN: ${attackerVIN}`;
        }));

        // Step 2: 颁发多个假名证书（模拟 Sybil 攻击）
        const fakeCerts: PseudonymCertificate[] = [];
        steps.push(this.executeStep(ScenarioStep.CERTIFICATE_ISSUANCE, () => {
            for (let i = 0; i < fakeIdentityCount; i++) {
                const cert = this.idManager.issuePseudonymCertificate(attackerVIN, 'TA_001');
                fakeCerts.push(cert);
                this.revocationManager.registerCertificate(cert);
            }
            return `Issued ${fakeIdentityCount} pseudonym certificates for attacker`;
        }));

        // Step 3: Agent 部署
        const agents: RSUAgent[] = [];
        steps.push(this.executeStep(ScenarioStep.AGENT_SETUP, () => {
            for (let i = 0; i < 4; i++) {
                const agent: RSUAgent = {
                    agentId: `RSU_SYBIL_${i}`,
                    location: { latitude: 39.9 + i * 0.005, longitude: 116.4 },
                    publicKey: `pk_sybil_${i}`,
                    trustWeight: 0.8,
                    coverageRadius: 300,
                    status: AgentStatus.ONLINE
                };
                this.trustManager.registerAgent(agent);
                agents.push(agent);
            }
            return `Deployed ${agents.length} RSU Agents for Sybil detection`;
        }));

        // Step 4: 检测 Sybil 攻击
        const identity = this.idManager.getVehicleIdentity(attackerVIN)!;
        const vidHash = this.idManager.generateVIDHash(identity);

        steps.push(this.executeStep(ScenarioStep.MISBEHAVIOR_DETECTION, () => {
            this.tracer.submitEvidence(
                EvidenceType.CERTIFICATE_ANOMALY,
                vidHash.hash,
                `Multiple certificates detected from same OBU fingerprint: ${identity.obuFingerprint.substring(0, 16)}`,
                agents[0].agentId,
                'sybil_detection_sig'
            );
            return `Sybil attack detected: ${fakeIdentityCount} fake identities from OBU ${identity.obuFingerprint.substring(0, 16)}...`;
        }));

        // Step 5: 协同撤销所有假证书
        steps.push(this.executeStep(ScenarioStep.COLLABORATIVE_REVOCATION, () => {
            let revokedCount = 0;
            for (const cert of fakeCerts) {
                const request = this.trustManager.initiateRevocation(
                    agents[0].agentId,
                    cert.certId,
                    vidHash.hash,
                    RevocationReason.SYBIL_ATTACK,
                    0.6
                );

                for (const agent of agents) {
                    const currentReq = this.trustManager.getRevocationRequest(request.requestId)!;
                    if (currentReq.status !== RevocationRequestStatus.VOTING) {
                        break; // Threshold reached, stop voting
                    }
                    this.trustManager.submitVote(request.requestId, {
                        agentId: agent.agentId,
                        decision: true,
                        trustScore: 0.1,
                        timestamp: Date.now(),
                        signature: `sybil_vote_${agent.agentId}`
                    });
                }

                const finalReq = this.trustManager.getRevocationRequest(request.requestId)!;
                if (finalReq.status === RevocationRequestStatus.APPROVED) {
                    this.revocationManager.revokeCertificate(
                        cert.certId,
                        RevocationReason.SYBIL_ATTACK,
                        agents[0].agentId,
                        finalReq.votes,
                        agents.length
                    );
                    revokedCount++;
                }
            }
            return `Revoked ${revokedCount}/${fakeIdentityCount} Sybil certificates`;
        }));

        // Step 6: 审计追责
        steps.push(this.executeStep(ScenarioStep.ACCOUNTABILITY_AUDIT, () => {
            const report = this.tracer.generateAuditReport(
                vidHash.hash,
                agents.map(a => a.agentId),
                AuditConclusion.MALICIOUS,
                agents.map(a => ({ agentId: a.agentId, signature: `sybil_audit_${a.agentId}` }))
            );
            return `Sybil audit report: ${report.reportId.substring(0, 16)}..., conclusion: MALICIOUS`;
        }));

        // Step 7: 身份追溯
        steps.push(this.executeStep(ScenarioStep.IDENTITY_RESOLUTION, () => {
            const resolvedVIN = this.idManager.resolveIdentity(vidHash.hash);
            return `Sybil attacker identified: ${resolvedVIN}`;
        }));

        const scenarioEnd = performance.now();

        return {
            scenarioName: 'Sybil Attack Detection → Batch Revocation → Accountability',
            steps,
            totalDurationMs: scenarioEnd - scenarioStart,
            allPassed: steps.every(s => s.success)
        };
    }

    /**
     * 获取各管理器实例（用于测试验证）
     */
    public getManagers(): {
        idManager: VehicleIdentityManager;
        revocationManager: CertificateRevocationManager;
        trustManager: AgentCollaborativeTrust;
        tracer: AccountabilityTracer;
    } {
        return {
            idManager: this.idManager,
            revocationManager: this.revocationManager,
            trustManager: this.trustManager,
            tracer: this.tracer
        };
    }

    /**
     * 执行单个步骤并记录结果
     */
    private executeStep(
        step: ScenarioStep,
        action: () => string
    ): ScenarioResult['steps'][number] {
        const start = performance.now();
        try {
            const details = action();
            const end = performance.now();
            return {
                step,
                success: true,
                durationMs: end - start,
                details
            };
        } catch (error) {
            const end = performance.now();
            return {
                step,
                success: false,
                durationMs: end - start,
                details: `Error: ${(error as Error).message}`
            };
        }
    }
}
