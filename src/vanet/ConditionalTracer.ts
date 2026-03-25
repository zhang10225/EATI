import * as crypto from 'crypto';
import { TracingRequest, AuthorityApproval, TracingResult } from './types';
import { PseudonymManager } from './PseudonymManager';

/**
 * 条件隐私追踪器（k-of-n 多方门限授权）
 *
 * VANET 追责场景：
 *   - 车辆用假名证书行驶，单方无法追踪；一旦发生恶意行为（闯红灯、虚假预警、碰瓷逃逸等），
 *     执法方需揭示假名背后的真实车辆身份
 *   - 直接由单一机构解密存在权力滥用风险（侵犯隐私、选择性执法）
 *   - k-of-n 门限方案：需要 k 个独立授权机构共同批准，才能触发 PCA 解密，防止单方滥权
 *
 * 与 EATI 的映射：
 *   - EATI 审计链（不可抵赖黑匣子）→ evidenceHash（行车事件哈希，存入追责链）
 *   - EATI MPC 门限签名           → k-of-n 多方批准机制
 *   - EATI 监护人（GuardianID）   → 授权机构（TrafficPolice / Court / TransportMinistry）
 */
export class ConditionalTracer {
    private readonly threshold: number;     // 最低审批数量 k
    private readonly authorities: string[]; // 授权机构 ID 列表（共 n 个）
    private readonly requests: Map<string, TracingRequest>;

    /**
     * @param threshold   k-of-n 中的 k（需至少多少机构批准才能触发追踪）
     * @param authorities 所有授权机构的 ID 列表（共 n 个）
     */
    constructor(threshold: number, authorities: string[]) {
        if (threshold <= 0 || threshold > authorities.length) {
            throw new Error(
                `Invalid threshold: ${threshold} must be between 1 and ${authorities.length}`
            );
        }
        this.threshold = threshold;
        this.authorities = [...authorities];
        this.requests = new Map();
    }

    /**
     * 创建追责请求
     * 执法机构（如交警）取得事件证据后发起
     *
     * @param pseudoId             涉事车辆的假名 ID
     * @param incidentDescription  事件描述
     * @param evidenceHash         事件证据哈希（存入追责链，不可抵赖）
     * @returns TracingRequest
     */
    public createRequest(
        pseudoId: string,
        incidentDescription: string,
        evidenceHash: string
    ): TracingRequest {
        const requestId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const request: TracingRequest = {
            requestId,
            pseudoId,
            incidentDescription,
            evidenceHash,
            requiredAuthorities: [...this.authorities],
            threshold: this.threshold,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        this.requests.set(requestId, request);
        return request;
    }

    /**
     * 获取追责请求
     */
    public getRequest(requestId: string): TracingRequest | undefined {
        return this.requests.get(requestId);
    }

    /**
     * 汇总各机构审批，判断是否达到门限
     * 达到门限后可选择触发 PCA 解密连接令牌
     *
     * @param request      追责请求
     * @param approvals    各机构的审批决定列表
     * @param linkageToken 假名证书中的连接令牌（可选，达到门限时由 PCA 解密）
     * @param linkageKey   PCA 持有的 AES-256 连接密钥（可选）
     * @returns TracingResult
     */
    public resolveTracing(
        request: TracingRequest,
        approvals: AuthorityApproval[],
        linkageToken?: string,
        linkageKey?: Buffer
    ): TracingResult {
        // 只统计"批准"且属于合法授权机构的审批，同一机构只算一次
        const validApprovals = approvals.filter(
            a => a.approved && this.authorities.includes(a.authorityId)
        );
        const uniqueApprovals = [
            ...new Map(validApprovals.map(a => [a.authorityId, a])).values()
        ];

        if (uniqueApprovals.length < this.threshold) {
            return {
                success: false,
                reason: `审批不足：${uniqueApprovals.length}/${this.threshold} 个授权机构已批准`
            };
        }

        // 更新请求状态
        const stored = this.requests.get(request.requestId);
        if (stored) {
            stored.status = 'approved';
        }

        // 如果提供了 linkageToken 和 linkageKey，触发 PCA 解密
        let realVehicleId: string | undefined;
        if (linkageToken && linkageKey) {
            const decoded = PseudonymManager.decodeLinkageToken(linkageToken, linkageKey);
            realVehicleId = decoded?.realVehicleId;
        }

        return {
            success: true,
            pseudoId: request.pseudoId,
            realVehicleId,
            resolvedAt: new Date().toISOString(),
            approvalCount: uniqueApprovals.length
        };
    }

    /** k-of-n 中的 k */
    public getThreshold(): number {
        return this.threshold;
    }

    /** 授权机构数量（n）*/
    public getAuthorityCount(): number {
        return this.authorities.length;
    }
}
