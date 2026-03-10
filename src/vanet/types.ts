/**
 * VANET (Vehicular Ad-hoc Network) 相关类型定义
 * 适用于 V2X 场景下的可信身份、隐私保护与实时撤销
 */

/**
 * 假名证书（对外广播，不暴露真实身份）
 * 对应 EATI 中的 AgentCredentials，但生命周期极短（分钟级）
 */
export interface PseudonymCert {
    /** 假名标识符（公开，每次轮换变化）*/
    pseudoId: string;
    /** ECDSA P-256 公钥 PEM（IEEE 1609.2 标准）*/
    publicKey: string;
    /** ECDSA P-256 私钥 PEM（保存在 OBU 安全存储中，不对外暴露）*/
    privateKey: string;
    /**
     * 加密连接令牌：AES-256-GCM 加密的 {realVehicleId, pseudoId, issuedAt}
     * 只有持有 linkageKey 的 PCA 才能解密，OBU 自身也无法解密
     */
    linkageToken: string;
    /** 到期时间（Unix ms 时间戳）*/
    expiresAt: number;
    /** 创建时间 */
    createdAt: number;
}

/**
 * Bloom Filter 紧凑导出格式
 * 由 RSU（路侧单元）生成后，通过 DSRC/C-V2X 广播给路过的 OBU
 */
export interface BloomFilterExport {
    /** Base64 编码的 filter 位数组 */
    data: string;
    /** filter 总位数 */
    size: number;
    /** 哈希函数个数 */
    hashCount: number;
    /** 格式版本 */
    version: number;
    /** 生成时间戳 */
    timestamp: number;
}

/**
 * 追责请求（需要 k-of-n 授权机构协作审批）
 * 对应 EATI 中高风险动作的多方确认流程
 */
export interface TracingRequest {
    requestId: string;
    /** 涉事车辆假名 ID */
    pseudoId: string;
    /** 事件描述（如"闯红灯并危险驾驶"）*/
    incidentDescription: string;
    /** 事件证据哈希（行车数据/视频摘要，存入追责链，不可抵赖）*/
    evidenceHash: string;
    /** 需要参与审批的授权机构列表（共 n 个）*/
    requiredAuthorities: string[];
    /** 最低审批数量（k-of-n 中的 k）*/
    threshold: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
}

/**
 * 授权机构的审批决定
 * 对应 EATI 中 MPC 门限签名的各方参与
 */
export interface AuthorityApproval {
    authorityId: string;
    requestId: string;
    approved: boolean;
    /** 授权机构对 (requestId + approved + timestamp) 的签名 */
    signature: string;
    timestamp: string;
}

/**
 * 追责结果
 */
export interface TracingResult {
    success: boolean;
    pseudoId?: string;
    /** 解密后的真实车辆 ID（追责成功后由 PCA 填充）*/
    realVehicleId?: string;
    resolvedAt?: string;
    approvalCount?: number;
    reason?: string;
}
