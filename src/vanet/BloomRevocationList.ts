import * as crypto from 'crypto';
import { BloomFilterExport } from './types';

/**
 * 基于 Bloom Filter 的轻量级撤销列表
 *
 * VANET 适配背景：
 *   - 传统 CRL 可达 MB 级别，OBU 带宽受限（DSRC/C-V2X ~6 Mbps，时延敏感）
 *   - Bloom Filter 将百万级撤销压缩至数十 KB，OBU 本地查询 O(k) 时间，无需网络
 *   - 允许极小概率误判（false positive），方向安全：误判为"已撤销"比漏判更安全
 *   - 无漏判（false negative）：不会把真正撤销的证书判为有效
 *
 * 与 EATI 的映射：
 *   - EATI CertificateManager.isCertificateValid() → mightBeRevoked()（本地撤销判断）
 *   - EATI 证书存储（文件系统）→ 广播 Bloom Filter（V2X 无线信道）
 *
 * 典型规模参数（0.1% FP 率）：
 *   n = 1,000  → size ≈  14,378 bits  ( ~1.8 KB), k = 10
 *   n = 10,000 → size ≈ 143,776 bits  (~18  KB), k = 10
 *   n = 100,000→ size ≈ 1,437,760 bits (~180 KB), k = 10
 */
export class BloomRevocationList {
    private readonly bits: Uint8Array;
    private readonly size: number;      // 总位数
    private readonly hashCount: number; // 哈希函数个数
    private count: number = 0;          // 已添加的撤销条目数

    /**
     * @param size      filter 总位数，默认 143,776 bits (~18 KB)，适合 1 万条撤销
     * @param hashCount 哈希函数个数，默认 10（对应 0.1% FP 率）
     */
    constructor(size: number = 143776, hashCount: number = 10) {
        this.size = size;
        this.bits = new Uint8Array(Math.ceil(size / 8));
        this.hashCount = hashCount;
    }

    /**
     * 将已撤销证书的序列号加入 filter（RSU 侧调用）
     * @param serialNumber 证书序列号
     */
    public add(serialNumber: string): void {
        for (let i = 0; i < this.hashCount; i++) {
            const bitIndex = this.hash(serialNumber, i) % this.size;
            this.bits[Math.floor(bitIndex / 8)] |= (1 << (bitIndex % 8));
        }
        this.count++;
    }

    /**
     * 检查证书是否可能已撤销（OBU 侧本地调用，O(k) 时间）
     * @returns true  = 可能已撤销（存在极小误判率，可向 RSU 进一步确认）
     * @returns false = 确定未撤销（无漏判）
     */
    public mightBeRevoked(serialNumber: string): boolean {
        for (let i = 0; i < this.hashCount; i++) {
            const bitIndex = this.hash(serialNumber, i) % this.size;
            if (!(this.bits[Math.floor(bitIndex / 8)] & (1 << (bitIndex % 8)))) {
                return false; // 确定未撤销
            }
        }
        return true; // 可能已撤销
    }

    /** 已加入的撤销条目数量 */
    public getCount(): number {
        return this.count;
    }

    /**
     * 估算当前 false positive 率
     * 公式：p ≈ (1 - e^(-k*n/m))^k
     */
    public estimateFalsePositiveRate(): number {
        const k = this.hashCount;
        const n = this.count;
        const m = this.size;
        if (n === 0) return 0;
        return Math.pow(1 - Math.exp(-k * n / m), k);
    }

    /**
     * 导出紧凑二进制表示，供 RSU 通过 DSRC/C-V2X 广播给 OBU
     */
    public export(): BloomFilterExport {
        return {
            data: Buffer.from(this.bits).toString('base64'),
            size: this.size,
            hashCount: this.hashCount,
            version: 1,
            timestamp: Date.now()
        };
    }

    /**
     * 从 RSU 广播数据还原 filter（OBU 侧调用）
     */
    public static import(exported: BloomFilterExport): BloomRevocationList {
        const brl = new BloomRevocationList(exported.size, exported.hashCount);
        const data = Buffer.from(exported.data, 'base64');
        const dest = Buffer.from(brl.bits.buffer as ArrayBuffer);
        data.copy(dest);
        return brl;
    }

    /**
     * 使用 seed 区分的 SHA-256 进行哈希，产生 k 个独立哈希函数
     */
    private hash(value: string, seed: number): number {
        const buf = crypto.createHash('sha256')
            .update(`${seed}:${value}`, 'utf8')
            .digest();
        return buf.readUInt32BE(0); // 取前 4 字节作为 uint32
    }
}
