/**
 * 车联网撤销与追责模块 - 类型定义
 * Vehicular Network Revocation & Accountability Types
 *
 * 基于 EATI 信任基础设施思想，适配到车联网（V2X）场景
 */

/**
 * 车辆身份标识 (Vehicle Identity Descriptor)
 * 对应 EATI 中的 AEID，适配为 OBU 硬件指纹
 */
export interface VehicleIdentity {
    /** 车辆识别号 Vehicle Identification Number */
    vin: string;
    /** OBU (On-Board Unit) 硬件指纹 */
    obuFingerprint: string;
    /** 网络标识指纹（V2X 通信标识） */
    networkFingerprint: string;
    /** 注册时间戳 */
    registrationTimestamp: number;
}

/**
 * VID Hash - 车辆身份哈希
 * 类似 EATI 的 AEID Hash
 */
export interface VehicleIdentityHash {
    /** 版本号 */
    version: string;
    /** 完整 VID hash (SHA-256) */
    hash: string;
    /** 生成时间 */
    generatedAt: number;
}

/**
 * 假名证书 (Pseudonym Certificate)
 */
export interface PseudonymCertificate {
    /** 证书唯一标识 */
    certId: string;
    /** 车辆 VID hash (关联但不直接暴露真实身份) */
    vidHash: string;
    /** 公钥 (PEM 格式) */
    publicKey: string;
    /** 颁发时间 */
    issuedAt: number;
    /** 过期时间 */
    expiresAt: number;
    /** 颁发者 (TA ID) */
    issuerId: string;
    /** 证书状态 */
    status: CertificateStatus;
}

/**
 * 证书状态枚举
 */
export enum CertificateStatus {
    ACTIVE = 'active',
    REVOKED = 'revoked',
    EXPIRED = 'expired',
    SUSPENDED = 'suspended'
}

/**
 * 撤销记录
 */
export interface RevocationRecord {
    /** 被撤销的证书 ID */
    certId: string;
    /** 撤销原因 */
    reason: RevocationReason;
    /** 撤销时间 */
    revokedAt: number;
    /** 撤销发起者（Agent ID） */
    revokedBy: string;
    /** 支持撤销的投票数 */
    voteCount: number;
    /** 投票阈值 */
    voteThreshold: number;
    /** 投票详情 */
    votes: AgentVote[];
    /** 关联的证据哈希列表 */
    evidenceHashes: string[];
}

/**
 * 撤销原因枚举
 */
export enum RevocationReason {
    /** 恶意行为检测 */
    MISBEHAVIOR_DETECTED = 'misbehavior_detected',
    /** Sybil 攻击 */
    SYBIL_ATTACK = 'sybil_attack',
    /** 虚假消息发送 */
    FALSE_MESSAGE = 'false_message',
    /** 密钥泄露 */
    KEY_COMPROMISE = 'key_compromise',
    /** 系统管理撤销 */
    ADMINISTRATIVE = 'administrative',
    /** 证书过期 */
    EXPIRATION = 'expiration'
}

/**
 * RSU Agent 定义
 */
export interface RSUAgent {
    /** Agent 唯一标识 */
    agentId: string;
    /** RSU 位置 (经纬度) */
    location: { latitude: number; longitude: number };
    /** Agent 公钥 */
    publicKey: string;
    /** 信任权重 (0-1) */
    trustWeight: number;
    /** 覆盖范围 (米) */
    coverageRadius: number;
    /** Agent 状态 */
    status: AgentStatus;
}

/**
 * Agent 状态枚举
 */
export enum AgentStatus {
    ONLINE = 'online',
    OFFLINE = 'offline',
    BUSY = 'busy',
    MAINTENANCE = 'maintenance'
}

/**
 * Agent 投票（用于协同撤销决策）
 */
export interface AgentVote {
    /** 投票的 Agent ID */
    agentId: string;
    /** 投票决定: true=同意撤销, false=反对 */
    decision: boolean;
    /** 信任评分 (该 Agent 对目标车辆的信任评分 0-1) */
    trustScore: number;
    /** 投票时间 */
    timestamp: number;
    /** 投票签名 */
    signature: string;
    /** 支持证据哈希 */
    evidenceHash?: string;
}

/**
 * 信任评估结果
 */
export interface TrustEvaluation {
    /** 被评估的车辆 VID hash */
    vehicleVidHash: string;
    /** 评估的 Agent ID */
    evaluatorAgentId: string;
    /** 直接信任值 (基于直接交互) */
    directTrust: number;
    /** 间接信任值 (基于其他 Agent 推荐) */
    indirectTrust: number;
    /** 综合信任值 */
    overallTrust: number;
    /** 评估时间 */
    evaluatedAt: number;
    /** 信任衰减因子 */
    decayFactor: number;
}

/**
 * 追责证据记录
 */
export interface EvidenceRecord {
    /** 证据唯一标识 */
    evidenceId: string;
    /** 证据类型 */
    type: EvidenceType;
    /** 相关车辆 VID hash */
    vehicleVidHash: string;
    /** 证据内容摘要 */
    contentHash: string;
    /** 收集时间 */
    collectedAt: number;
    /** 收集的 Agent ID */
    collectedBy: string;
    /** 证据签名 */
    signature: string;
    /** Merkle Tree 中的位置 */
    merkleIndex?: number;
    /** Merkle 证明路径 */
    merkleProof?: string[];
}

/**
 * 证据类型枚举
 */
export enum EvidenceType {
    /** V2X 消息日志 */
    MESSAGE_LOG = 'message_log',
    /** 位置异常记录 */
    LOCATION_ANOMALY = 'location_anomaly',
    /** 速度异常记录 */
    SPEED_ANOMALY = 'speed_anomaly',
    /** 签名验证失败 */
    SIGNATURE_FAILURE = 'signature_failure',
    /** 证书异常 */
    CERTIFICATE_ANOMALY = 'certificate_anomaly',
    /** Agent 协同检测报告 */
    COLLABORATIVE_DETECTION = 'collaborative_detection'
}

/**
 * Bloom Filter 配置
 */
export interface BloomFilterConfig {
    /** 预期元素数量 */
    expectedElements: number;
    /** 误判率 */
    falsePositiveRate: number;
    /** 位数组大小 (自动计算) */
    bitArraySize?: number;
    /** 哈希函数数量 (自动计算) */
    hashFunctionCount?: number;
}

/**
 * 协同撤销请求
 */
export interface CollaborativeRevocationRequest {
    /** 请求 ID */
    requestId: string;
    /** 目标证书 ID */
    targetCertId: string;
    /** 目标车辆 VID hash */
    targetVidHash: string;
    /** 撤销原因 */
    reason: RevocationReason;
    /** 发起 Agent ID */
    initiatorAgentId: string;
    /** 发起时间 */
    initiatedAt: number;
    /** 投票截止时间 */
    votingDeadline: number;
    /** 阈值 (t-of-n) */
    threshold: number;
    /** 参与 Agent 总数 */
    totalAgents: number;
    /** 当前收集到的投票 */
    votes: AgentVote[];
    /** 请求状态 */
    status: RevocationRequestStatus;
}

/**
 * 撤销请求状态
 */
export enum RevocationRequestStatus {
    /** 投票进行中 */
    VOTING = 'voting',
    /** 已批准 */
    APPROVED = 'approved',
    /** 已拒绝 */
    REJECTED = 'rejected',
    /** 已超时 */
    EXPIRED = 'expired',
    /** 已执行 */
    EXECUTED = 'executed'
}

/**
 * Merkle Tree 节点
 */
export interface MerkleNode {
    /** 节点哈希 */
    hash: string;
    /** 左子节点哈希 */
    left?: string;
    /** 右子节点哈希 */
    right?: string;
    /** 数据内容（叶子节点） */
    data?: string;
}

/**
 * 审计报告
 */
export interface AuditReport {
    /** 报告 ID */
    reportId: string;
    /** 被审计的车辆 VID hash */
    vehicleVidHash: string;
    /** 关联证据列表 */
    evidenceRecords: EvidenceRecord[];
    /** Merkle Root */
    merkleRoot: string;
    /** 审计 Agent 列表 */
    auditorAgents: string[];
    /** 审计结论 */
    conclusion: AuditConclusion;
    /** 生成时间 */
    generatedAt: number;
    /** 报告签名（联合签名） */
    signatures: { agentId: string; signature: string }[];
}

/**
 * 审计结论枚举
 */
export enum AuditConclusion {
    /** 行为正常 */
    NORMAL = 'normal',
    /** 存在可疑行为 */
    SUSPICIOUS = 'suspicious',
    /** 确认恶意行为 */
    MALICIOUS = 'malicious',
    /** 证据不足 */
    INSUFFICIENT_EVIDENCE = 'insufficient_evidence'
}
