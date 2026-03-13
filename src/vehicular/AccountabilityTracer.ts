import * as crypto from 'crypto';
import {
    EvidenceRecord,
    EvidenceType,
    MerkleNode,
    AuditReport,
    AuditConclusion
} from './types';

/**
 * 追责与证据链管理器
 * 基于 EATI 的不可变审计链思想（Merkle Transparent Log）
 *
 * 核心功能:
 * 1. 证据记录的不可变存储 (Merkle Tree)
 * 2. 证据完整性验证 (Merkle Proof)
 * 3. 多 Agent 协同审计
 * 4. 审计报告生成
 */
export class AccountabilityTracer {
    /** 证据记录存储 */
    private evidenceRecords: EvidenceRecord[] = [];
    /** Merkle Tree 叶子节点哈希 */
    private merkleLeaves: string[] = [];
    /** 当前 Merkle Root */
    private currentMerkleRoot: string = '';
    /** 审计报告 */
    private auditReports: Map<string, AuditReport> = new Map();

    /**
     * 提交证据记录
     * 对应 EATI 的 Logger 模块，但使用 Merkle Tree 保证不可变性
     *
     * @param type 证据类型
     * @param vehicleVidHash 相关车辆 VID hash
     * @param content 证据内容
     * @param collectedBy 收集者 Agent ID
     * @param signature 证据签名
     * @returns 证据记录
     */
    public submitEvidence(
        type: EvidenceType,
        vehicleVidHash: string,
        content: string,
        collectedBy: string,
        signature: string
    ): EvidenceRecord {
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');
        const evidenceId = crypto.createHash('sha256')
            .update(`${contentHash}|${Date.now()}|${collectedBy}`)
            .digest('hex')
            .substring(0, 32);

        const record: EvidenceRecord = {
            evidenceId,
            type,
            vehicleVidHash,
            contentHash,
            collectedAt: Date.now(),
            collectedBy,
            signature,
            merkleIndex: this.merkleLeaves.length
        };

        // 添加到 Merkle Tree
        this.merkleLeaves.push(contentHash);
        this.evidenceRecords.push(record);

        // 重建 Merkle Tree
        this.currentMerkleRoot = this.buildMerkleRoot(this.merkleLeaves);

        // 生成 Merkle Proof
        record.merkleProof = this.generateMerkleProof(record.merkleIndex!);

        return record;
    }

    /**
     * 构建 Merkle Root
     * 使用 SHA-256 哈希函数
     *
     * @param leaves 叶子节点哈希列表
     * @returns Merkle Root 哈希
     */
    public buildMerkleRoot(leaves: string[]): string {
        if (leaves.length === 0) return '';
        if (leaves.length === 1) return leaves[0];

        const nodes: string[] = [...leaves];

        // 如果奇数个节点，复制最后一个
        while (nodes.length > 1) {
            const nextLevel: string[] = [];
            for (let i = 0; i < nodes.length; i += 2) {
                const left = nodes[i];
                const right = i + 1 < nodes.length ? nodes[i + 1] : left;
                const combined = crypto.createHash('sha256')
                    .update(left + right)
                    .digest('hex');
                nextLevel.push(combined);
            }
            nodes.length = 0;
            nodes.push(...nextLevel);
        }

        return nodes[0];
    }

    /**
     * 生成 Merkle Proof（验证路径）
     * 用于证明某条证据确实存在于证据链中
     *
     * @param index 叶子节点索引
     * @returns Merkle Proof 路径
     */
    public generateMerkleProof(index: number): string[] {
        if (this.merkleLeaves.length <= 1) return [];

        const proof: string[] = [];
        let nodes = [...this.merkleLeaves];
        let currentIndex = index;

        while (nodes.length > 1) {
            // 获取兄弟节点
            const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
            if (siblingIndex < nodes.length) {
                proof.push(nodes[siblingIndex]);
            } else {
                proof.push(nodes[currentIndex]); // 复制自身（奇数情况）
            }

            // 构建下一层
            const nextLevel: string[] = [];
            for (let i = 0; i < nodes.length; i += 2) {
                const left = nodes[i];
                const right = i + 1 < nodes.length ? nodes[i + 1] : left;
                nextLevel.push(
                    crypto.createHash('sha256').update(left + right).digest('hex')
                );
            }
            nodes = nextLevel;
            currentIndex = Math.floor(currentIndex / 2);
        }

        return proof;
    }

    /**
     * 验证 Merkle Proof
     * 验证某条证据是否存在于证据链中且未被篡改
     *
     * @param contentHash 证据内容哈希
     * @param index 叶子节点索引
     * @param proof Merkle Proof 路径
     * @param expectedRoot 期望的 Merkle Root
     * @returns 验证是否通过
     */
    public verifyMerkleProof(
        contentHash: string,
        index: number,
        proof: string[],
        expectedRoot: string
    ): boolean {
        if (proof.length === 0 && this.merkleLeaves.length <= 1) {
            return contentHash === expectedRoot;
        }

        let computedHash = contentHash;
        let currentIndex = index;

        for (const sibling of proof) {
            if (currentIndex % 2 === 0) {
                computedHash = crypto.createHash('sha256')
                    .update(computedHash + sibling)
                    .digest('hex');
            } else {
                computedHash = crypto.createHash('sha256')
                    .update(sibling + computedHash)
                    .digest('hex');
            }
            currentIndex = Math.floor(currentIndex / 2);
        }

        return computedHash === expectedRoot;
    }

    /**
     * 获取当前 Merkle Root
     */
    public getMerkleRoot(): string {
        return this.currentMerkleRoot;
    }

    /**
     * 获取车辆相关的所有证据
     */
    public getVehicleEvidence(vehicleVidHash: string): EvidenceRecord[] {
        return this.evidenceRecords.filter(r => r.vehicleVidHash === vehicleVidHash);
    }

    /**
     * 获取指定类型的证据
     */
    public getEvidenceByType(type: EvidenceType): EvidenceRecord[] {
        return this.evidenceRecords.filter(r => r.type === type);
    }

    /**
     * 生成审计报告
     * 多 Agent 协同审计的结果汇总
     *
     * @param vehicleVidHash 被审计车辆 VID hash
     * @param auditorAgents 参与审计的 Agent ID 列表
     * @param conclusion 审计结论
     * @param signatures Agent 签名列表
     * @returns 审计报告
     */
    public generateAuditReport(
        vehicleVidHash: string,
        auditorAgents: string[],
        conclusion: AuditConclusion,
        signatures: { agentId: string; signature: string }[]
    ): AuditReport {
        const evidenceRecords = this.getVehicleEvidence(vehicleVidHash);
        const reportId = crypto.createHash('sha256')
            .update(`audit|${vehicleVidHash}|${Date.now()}`)
            .digest('hex')
            .substring(0, 32);

        const report: AuditReport = {
            reportId,
            vehicleVidHash,
            evidenceRecords,
            merkleRoot: this.currentMerkleRoot,
            auditorAgents,
            conclusion,
            generatedAt: Date.now(),
            signatures
        };

        this.auditReports.set(reportId, report);
        return report;
    }

    /**
     * 获取审计报告
     */
    public getAuditReport(reportId: string): AuditReport | undefined {
        return this.auditReports.get(reportId);
    }

    /**
     * 获取所有证据记录数量
     */
    public getEvidenceCount(): number {
        return this.evidenceRecords.length;
    }

    /**
     * 验证证据链完整性
     * 重新计算 Merkle Root 并与存储的 Root 比较
     *
     * @returns 证据链是否完整（未被篡改）
     */
    public verifyChainIntegrity(): boolean {
        if (this.merkleLeaves.length === 0) return true;

        const recomputedRoot = this.buildMerkleRoot(
            this.evidenceRecords.map(r => r.contentHash)
        );

        return recomputedRoot === this.currentMerkleRoot;
    }
}
