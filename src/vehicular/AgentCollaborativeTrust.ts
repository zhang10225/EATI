import * as crypto from 'crypto';
import {
    RSUAgent,
    AgentVote,
    AgentStatus,
    TrustEvaluation,
    CollaborativeRevocationRequest,
    RevocationRequestStatus,
    RevocationReason
} from './types';

/**
 * Agent 协同信任管理器
 * 核心创新模块：多 RSU Agent 协同进行信任评估和撤销决策
 *
 * 设计理念:
 * 1. 去中心化: 多个 RSU Agent 协同决策，避免单点故障
 * 2. 加权信任: 不同 Agent 根据距离、历史表现等有不同权重
 * 3. 阈值投票: t-of-n 投票机制确保撤销决策的可靠性
 * 4. 信任衰减: 信任值随时间衰减，需要持续更新
 */
export class AgentCollaborativeTrust {
    /** 注册的 RSU Agent */
    private agents: Map<string, RSUAgent> = new Map();
    /** 信任评估历史 */
    private trustHistory: Map<string, TrustEvaluation[]> = new Map();
    /** 活跃的撤销请求 */
    private revocationRequests: Map<string, CollaborativeRevocationRequest> = new Map();
    /** 直接信任权重 */
    private readonly directTrustWeight: number;
    /** 间接信任权重 */
    private readonly indirectTrustWeight: number;
    /** 信任衰减率 (每小时) */
    private readonly trustDecayRate: number;
    /** 撤销投票超时 (毫秒) */
    private readonly votingTimeoutMs: number;

    constructor(
        directTrustWeight: number = 0.6,
        indirectTrustWeight: number = 0.4,
        trustDecayRate: number = 0.05,
        votingTimeoutMs: number = 30000 // 30 秒
    ) {
        this.directTrustWeight = directTrustWeight;
        this.indirectTrustWeight = indirectTrustWeight;
        this.trustDecayRate = trustDecayRate;
        this.votingTimeoutMs = votingTimeoutMs;
    }

    /**
     * 注册 RSU Agent
     * 对应 EATI 的 initAgent() 在 Agent 协同层面的实现
     *
     * @param agent RSU Agent 信息
     */
    public registerAgent(agent: RSUAgent): void {
        this.agents.set(agent.agentId, agent);
    }

    /**
     * 获取所有在线 Agent
     */
    public getOnlineAgents(): RSUAgent[] {
        return Array.from(this.agents.values())
            .filter(a => a.status === AgentStatus.ONLINE);
    }

    /**
     * 计算单个 Agent 对车辆的信任评估
     * 综合直接信任和间接信任
     *
     * @param agentId 评估 Agent ID
     * @param vehicleVidHash 被评估车辆 VID hash
     * @param directObservation 直接观测信任值 (0-1)
     * @param neighborRecommendations 邻居 Agent 推荐的信任值列表
     * @returns 信任评估结果
     */
    public evaluateTrust(
        agentId: string,
        vehicleVidHash: string,
        directObservation: number,
        neighborRecommendations: { agentId: string; trustValue: number; weight: number }[]
    ): TrustEvaluation {
        // 限制信任值范围在 [0, 1]
        const directTrust = Math.max(0, Math.min(1, directObservation));

        // 计算加权间接信任
        let indirectTrust = 0;
        let totalWeight = 0;
        for (const rec of neighborRecommendations) {
            indirectTrust += rec.trustValue * rec.weight;
            totalWeight += rec.weight;
        }
        indirectTrust = totalWeight > 0 ? indirectTrust / totalWeight : 0.5;

        // 综合信任 = α * 直接信任 + β * 间接信任
        const overallTrust = this.directTrustWeight * directTrust +
                            this.indirectTrustWeight * indirectTrust;

        // 应用时间衰减
        const decayFactor = this.calculateDecayFactor(agentId, vehicleVidHash);
        const decayedTrust = overallTrust * decayFactor;

        const evaluation: TrustEvaluation = {
            vehicleVidHash,
            evaluatorAgentId: agentId,
            directTrust,
            indirectTrust,
            overallTrust: decayedTrust,
            evaluatedAt: Date.now(),
            decayFactor
        };

        // 存储评估历史
        const key = `${agentId}:${vehicleVidHash}`;
        const history = this.trustHistory.get(key) || [];
        history.push(evaluation);
        this.trustHistory.set(key, history);

        return evaluation;
    }

    /**
     * 计算信任衰减因子
     * 信任值随时间指数衰减: decay = e^(-λ * Δt)
     */
    private calculateDecayFactor(agentId: string, vehicleVidHash: string): number {
        const key = `${agentId}:${vehicleVidHash}`;
        const history = this.trustHistory.get(key);

        if (!history || history.length === 0) {
            return 1.0; // 第一次评估，无衰减
        }

        const lastEvaluation = history[history.length - 1];
        const timeDeltaHours = (Date.now() - lastEvaluation.evaluatedAt) / 3600000;
        return Math.exp(-this.trustDecayRate * timeDeltaHours);
    }

    /**
     * 聚合多个 Agent 的信任评估
     * 使用加权平均（权重基于 Agent 的信任权重）
     *
     * @param evaluations 多个 Agent 的信任评估
     * @returns 聚合后的综合信任值
     */
    public aggregateTrust(evaluations: TrustEvaluation[]): number {
        if (evaluations.length === 0) return 0.5;

        let weightedSum = 0;
        let totalWeight = 0;

        for (const evaluation of evaluations) {
            const agent = this.agents.get(evaluation.evaluatorAgentId);
            const weight = agent ? agent.trustWeight : 0.5;
            weightedSum += evaluation.overallTrust * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    }

    /**
     * 发起协同撤销请求
     * 核心创新：多 Agent 投票的去中心化撤销机制
     *
     * @param initiatorAgentId 发起者 Agent ID
     * @param targetCertId 目标证书 ID
     * @param targetVidHash 目标车辆 VID hash
     * @param reason 撤销原因
     * @param threshold t-of-n 阈值比例 (0-1)
     * @returns 撤销请求
     */
    public initiateRevocation(
        initiatorAgentId: string,
        targetCertId: string,
        targetVidHash: string,
        reason: RevocationReason,
        threshold: number = 0.6
    ): CollaborativeRevocationRequest {
        const onlineAgents = this.getOnlineAgents();
        const requestId = crypto.createHash('sha256')
            .update(`${targetCertId}|${Date.now()}|${crypto.randomBytes(8).toString('hex')}`)
            .digest('hex')
            .substring(0, 32);

        const request: CollaborativeRevocationRequest = {
            requestId,
            targetCertId,
            targetVidHash,
            reason,
            initiatorAgentId,
            initiatedAt: Date.now(),
            votingDeadline: Date.now() + this.votingTimeoutMs,
            threshold,
            totalAgents: onlineAgents.length,
            votes: [],
            status: RevocationRequestStatus.VOTING
        };

        this.revocationRequests.set(requestId, request);
        return request;
    }

    /**
     * Agent 提交撤销投票
     *
     * @param requestId 撤销请求 ID
     * @param vote Agent 投票
     * @returns 更新后的请求状态
     */
    public submitVote(requestId: string, vote: AgentVote): CollaborativeRevocationRequest {
        const request = this.revocationRequests.get(requestId);
        if (!request) {
            throw new Error(`Revocation request not found: ${requestId}`);
        }

        if (request.status !== RevocationRequestStatus.VOTING) {
            throw new Error(`Revocation request is not in voting status: ${request.status}`);
        }

        // 检查是否超时
        if (Date.now() > request.votingDeadline) {
            request.status = RevocationRequestStatus.EXPIRED;
            return request;
        }

        // 检查是否已投票
        if (request.votes.some(v => v.agentId === vote.agentId)) {
            throw new Error(`Agent ${vote.agentId} has already voted`);
        }

        // 记录投票
        request.votes.push(vote);

        // 检查投票结果
        this.checkVotingResult(request);

        return request;
    }

    /**
     * 检查投票结果
     * 当同意票达到阈值时自动批准，当不可能达到阈值时自动拒绝
     */
    private checkVotingResult(request: CollaborativeRevocationRequest): void {
        const approvalCount = request.votes.filter(v => v.decision).length;
        const rejectionCount = request.votes.filter(v => !v.decision).length;
        const requiredVotes = Math.ceil(request.totalAgents * request.threshold);
        const remainingVotes = request.totalAgents - request.votes.length;

        // 同意票已达阈值 -> 批准
        if (approvalCount >= requiredVotes) {
            request.status = RevocationRequestStatus.APPROVED;
            return;
        }

        // 即使剩余全部同意也无法达到阈值 -> 拒绝
        if (approvalCount + remainingVotes < requiredVotes) {
            request.status = RevocationRequestStatus.REJECTED;
            return;
        }

        // 所有人已投票但未达到阈值 -> 拒绝
        if (request.votes.length >= request.totalAgents && approvalCount < requiredVotes) {
            request.status = RevocationRequestStatus.REJECTED;
        }
    }

    /**
     * 获取撤销请求
     */
    public getRevocationRequest(requestId: string): CollaborativeRevocationRequest | undefined {
        return this.revocationRequests.get(requestId);
    }

    /**
     * 获取已批准的撤销请求列表
     */
    public getApprovedRequests(): CollaborativeRevocationRequest[] {
        return Array.from(this.revocationRequests.values())
            .filter(r => r.status === RevocationRequestStatus.APPROVED);
    }

    /**
     * 获取信任评估历史
     */
    public getTrustHistory(agentId: string, vehicleVidHash: string): TrustEvaluation[] {
        const key = `${agentId}:${vehicleVidHash}`;
        return this.trustHistory.get(key) || [];
    }

    /**
     * 获取已注册 Agent 数量
     */
    public getAgentCount(): number {
        return this.agents.size;
    }

    /**
     * 获取 Agent 信息
     */
    public getAgent(agentId: string): RSUAgent | undefined {
        return this.agents.get(agentId);
    }
}
