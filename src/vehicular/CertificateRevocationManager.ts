import * as crypto from 'crypto';
import {
    RevocationRecord,
    RevocationReason,
    BloomFilterConfig,
    CertificateStatus,
    PseudonymCertificate,
    AgentVote
} from './types';

/**
 * Bloom Filter 实现
 * 用于高效的证书撤销查询 (O(1) 查询复杂度)
 * 适合车联网资源受限的 OBU 环境
 */
export class BloomFilter {
    private readonly bitArray: Uint8Array;
    private readonly bitArraySize: number;
    private readonly hashFunctionCount: number;

    constructor(config: BloomFilterConfig) {
        // 计算最优位数组大小: m = -(n * ln(p)) / (ln(2)^2)
        this.bitArraySize = config.bitArraySize ||
            Math.ceil(-(config.expectedElements * Math.log(config.falsePositiveRate)) / (Math.log(2) ** 2));

        // 计算最优哈希函数数量: k = (m/n) * ln(2)
        this.hashFunctionCount = config.hashFunctionCount ||
            Math.round((this.bitArraySize / config.expectedElements) * Math.log(2));

        // 确保最少 1 个哈希函数
        if (this.hashFunctionCount < 1) {
            this.hashFunctionCount = 1;
        }

        this.bitArray = new Uint8Array(Math.ceil(this.bitArraySize / 8));
    }

    /**
     * 添加元素到 Bloom Filter
     */
    public add(element: string): void {
        const positions = this.getHashPositions(element);
        for (const pos of positions) {
            const byteIndex = Math.floor(pos / 8);
            const bitIndex = pos % 8;
            this.bitArray[byteIndex] |= (1 << bitIndex);
        }
    }

    /**
     * 查询元素是否可能存在
     * @returns true = 可能存在（有误判率），false = 一定不存在
     */
    public mightContain(element: string): boolean {
        const positions = this.getHashPositions(element);
        for (const pos of positions) {
            const byteIndex = Math.floor(pos / 8);
            const bitIndex = pos % 8;
            if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * 使用多个哈希函数计算位置
     * 基于 double hashing 技术: h_i(x) = (h1(x) + i * h2(x)) mod m
     */
    private getHashPositions(element: string): number[] {
        const h1 = this.hash(element, 'sha256');
        const h2 = this.hash(element, 'md5');
        const positions: number[] = [];

        for (let i = 0; i < this.hashFunctionCount; i++) {
            const position = Math.abs((h1 + i * h2) % this.bitArraySize);
            positions.push(position);
        }

        return positions;
    }

    /**
     * 计算哈希值（返回数值）
     */
    private hash(data: string, algorithm: string): number {
        const hashHex = crypto.createHash(algorithm).update(data).digest('hex');
        // 取前 8 个十六进制字符（32 位）转为数值
        return parseInt(hashHex.substring(0, 8), 16);
    }

    /**
     * 获取 Bloom Filter 状态信息
     */
    public getStats(): { bitArraySize: number; hashFunctionCount: number; fillRatio: number } {
        let setBits = 0;
        for (let i = 0; i < this.bitArray.length; i++) {
            // Count set bits using Brian Kernighan's algorithm
            let byte = this.bitArray[i];
            while (byte) {
                setBits++;
                byte &= byte - 1;
            }
        }

        return {
            bitArraySize: this.bitArraySize,
            hashFunctionCount: this.hashFunctionCount,
            fillRatio: setBits / this.bitArraySize
        };
    }
}

/**
 * 证书撤销管理器
 * 核心创新：结合 Bloom Filter + Agent 协同投票的高效撤销机制
 *
 * 对应 EATI 的 CertificateManager 扩展，增加了:
 * 1. Bloom Filter CRL - O(1) 撤销查询
 * 2. 撤销记录管理
 * 3. 撤销投票结果处理
 */
export class CertificateRevocationManager {
    /** Bloom Filter 用于快速撤销查询 */
    private bloomFilter: BloomFilter;
    /** 完整撤销记录列表 */
    private revocationRecords: Map<string, RevocationRecord> = new Map();
    /** 证书存储 */
    private certificates: Map<string, PseudonymCertificate> = new Map();
    /** 撤销阈值 (t-of-n 中的 t) */
    private readonly revocationThreshold: number;

    constructor(
        bloomFilterConfig: BloomFilterConfig = {
            expectedElements: 10000,
            falsePositiveRate: 0.001
        },
        revocationThreshold: number = 0.6
    ) {
        this.bloomFilter = new BloomFilter(bloomFilterConfig);
        this.revocationThreshold = revocationThreshold;
    }

    /**
     * 注册证书到管理器
     */
    public registerCertificate(cert: PseudonymCertificate): void {
        this.certificates.set(cert.certId, cert);
    }

    /**
     * 快速检查证书是否被撤销
     * 使用 Bloom Filter 实现 O(1) 查询
     * 注意：Bloom Filter 可能有误判（false positive），但不会漏判（no false negative）
     *
     * @param certId 证书 ID
     * @returns true = 可能被撤销（需要进一步确认），false = 一定未被撤销
     */
    public isRevoked(certId: string): boolean {
        return this.bloomFilter.mightContain(certId);
    }

    /**
     * 精确检查证书撤销状态
     * 在 Bloom Filter 返回 true 后，使用精确查询确认
     *
     * @param certId 证书 ID
     * @returns 撤销记录或 undefined
     */
    public getRevocationRecord(certId: string): RevocationRecord | undefined {
        return this.revocationRecords.get(certId);
    }

    /**
     * 执行证书撤销
     * 基于 Agent 协同投票结果的撤销执行
     *
     * @param certId 目标证书 ID
     * @param reason 撤销原因
     * @param revokedBy 撤销执行者 Agent ID
     * @param votes Agent 投票列表
     * @param totalAgents 参与投票的 Agent 总数
     * @returns 撤销记录，如果投票未达阈值则返回 null
     */
    public revokeCertificate(
        certId: string,
        reason: RevocationReason,
        revokedBy: string,
        votes: AgentVote[],
        totalAgents: number
    ): RevocationRecord | null {
        // 计算同意撤销的票数
        const approvalVotes = votes.filter(v => v.decision === true);
        const approvalRatio = approvalVotes.length / totalAgents;

        // 检查是否达到撤销阈值
        if (approvalRatio < this.revocationThreshold) {
            return null; // 投票未达阈值，撤销失败
        }

        // 添加到 Bloom Filter
        this.bloomFilter.add(certId);

        // 创建撤销记录
        const record: RevocationRecord = {
            certId,
            reason,
            revokedAt: Date.now(),
            revokedBy,
            voteCount: approvalVotes.length,
            voteThreshold: Math.ceil(totalAgents * this.revocationThreshold),
            votes,
            evidenceHashes: votes
                .filter(v => v.evidenceHash)
                .map(v => v.evidenceHash as string)
        };

        this.revocationRecords.set(certId, record);

        // 更新证书状态
        const cert = this.certificates.get(certId);
        if (cert) {
            cert.status = CertificateStatus.REVOKED;
        }

        return record;
    }

    /**
     * 获取所有撤销记录
     */
    public getAllRevocationRecords(): RevocationRecord[] {
        return Array.from(this.revocationRecords.values());
    }

    /**
     * 获取撤销记录数量
     */
    public getRevocationCount(): number {
        return this.revocationRecords.size;
    }

    /**
     * 获取 Bloom Filter 统计信息
     */
    public getBloomFilterStats(): { bitArraySize: number; hashFunctionCount: number; fillRatio: number } {
        return this.bloomFilter.getStats();
    }

    /**
     * 批量检查证书撤销状态
     * 适用于车辆收到多条 V2X 消息时的批量验证场景
     *
     * @param certIds 证书 ID 列表
     * @returns 每个证书的撤销状态
     */
    public batchCheckRevocation(certIds: string[]): Map<string, boolean> {
        const results = new Map<string, boolean>();
        for (const certId of certIds) {
            results.set(certId, this.isRevoked(certId));
        }
        return results;
    }

    /**
     * 获取撤销阈值
     */
    public getRevocationThreshold(): number {
        return this.revocationThreshold;
    }
}
