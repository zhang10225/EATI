import * as crypto from 'crypto';
import { PseudonymCert } from './types';

/**
 * 假名证书管理器
 *
 * VANET 隐私适配背景：
 *   - 车辆持续广播 BSM（Basic Safety Message），直接绑定真实身份会暴露完整行驶轨迹
 *   - 假名方案：OBU 频繁轮换短期假名证书，不同观察者无法将不同时段的假名关联到同一车辆
 *   - 可追责性：每张假名证书内含"连接令牌"（linkageToken），仅 PCA 持有解密密钥
 *
 * 与 EATI 的映射：
 *   - AEID 设备绑定       → linkageToken（PCA 加密绑定，仅事后追责时解密）
 *   - Keystore（私钥存储）→ OBU 的 TPM/HSM 硬件安全元件
 *   - RSA-2048            → ECDSA P-256（IEEE 1609.2 标准，签名 64 bytes，OBU 验签 <1ms）
 *   - AEID Hash 嵌入 CN   → linkageToken 嵌入假名证书扩展字段
 *
 * 生产部署注意事项：
 *   - linkageKey 应由 PCA 严格保管，绝不下发 OBU
 *   - 假名证书应由 PCA 通过安全信道预先下发，而非 OBU 自签
 *   - 私钥应存储在 OBU 内的 TPM/SE（安全元件），而非普通内存
 */
export class PseudonymManager {
    private readonly realVehicleId: string;
    private readonly linkageKey: Buffer;
    private readonly pseudonyms: Map<string, PseudonymCert>;

    /**
     * @param realVehicleId 车辆长期身份（由 PCA 管理）
     * @param linkageKey    AES-256 连接密钥（生产环境中应由 PCA 持有，不下发 OBU）
     */
    constructor(realVehicleId: string, linkageKey?: Buffer) {
        this.realVehicleId = realVehicleId;
        this.linkageKey = linkageKey ?? crypto.randomBytes(32);
        this.pseudonyms = new Map();
    }

    /**
     * 生成一张新的短期假名证书
     * 使用 ECDSA P-256（IEEE 1609.2 推荐），公钥 64 bytes，签名 64 bytes
     *
     * @param validDurationMs 有效期（毫秒），默认 5 分钟
     * @returns 假名证书条目
     */
    public generatePseudonym(validDurationMs: number = 5 * 60 * 1000): PseudonymCert {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
            namedCurve: 'P-256',
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        const pseudoId = crypto.randomBytes(16).toString('hex');
        const linkageToken = this.createLinkageToken(pseudoId);

        const entry: PseudonymCert = {
            pseudoId,
            publicKey,
            privateKey,
            linkageToken,
            expiresAt: Date.now() + validDurationMs,
            createdAt: Date.now()
        };

        this.pseudonyms.set(pseudoId, entry);
        return entry;
    }

    /**
     * 获取当前有效的假名证书
     * 按创建时间倒序排列，时间相同时以插入顺序（后插入的优先）作为稳定的次级排序依据
     * @returns 有效的假名证书，或 null（需立即申请新假名）
     */
    public getCurrentPseudonym(): PseudonymCert | null {
        const now = Date.now();
        // Map 保留插入顺序；先 reverse 使后插入的排在前面，再做稳定排序
        const valid = [...this.pseudonyms.values()]
            .filter(p => p.expiresAt > now)
            .reverse(); // 让后插入的条目在同 createdAt 时优先
        valid.sort((a, b) => b.createdAt - a.createdAt);
        return valid[0] ?? null;
    }

    /**
     * 获取所有假名（含过期的）
     */
    public getAllPseudonyms(): PseudonymCert[] {
        return [...this.pseudonyms.values()];
    }

    /**
     * 清除所有已过期的假名，释放 OBU 内存
     * @returns 被清除的假名数量
     */
    public purgeExpired(): number {
        const now = Date.now();
        let removed = 0;
        for (const [id, entry] of this.pseudonyms) {
            if (entry.expiresAt <= now) {
                this.pseudonyms.delete(id);
                removed++;
            }
        }
        return removed;
    }

    /**
     * 获取连接密钥（仅用于测试/演示，生产环境 PCA 不对外暴露此密钥）
     */
    public getLinkageKey(): Buffer {
        return Buffer.from(this.linkageKey);
    }

    /**
     * [PCA 侧] 解密连接令牌，揭示假名证书对应的真实车辆身份
     * 仅在 k-of-n 授权机构批准后，由 PCA 执行此操作
     *
     * @param token      linkageToken（来自假名证书）
     * @param linkageKey PCA 保管的 AES-256 连接密钥
     * @returns 解密成功返回绑定信息，失败返回 null
     */
    public static decodeLinkageToken(
        token: string,
        linkageKey: Buffer
    ): { realVehicleId: string; pseudoId: string; issuedAt: number } | null {
        try {
            const raw = Buffer.from(token, 'base64');
            const iv = raw.subarray(0, 12);       // 12 bytes GCM IV
            const authTag = raw.subarray(12, 28); // 16 bytes GCM auth tag
            const ciphertext = raw.subarray(28);

            const decipher = crypto.createDecipheriv('aes-256-gcm', linkageKey, iv);
            decipher.setAuthTag(authTag);
            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return JSON.parse(plaintext.toString('utf8'));
        } catch {
            return null;
        }
    }

    // ---- 私有方法 ----

    /**
     * 创建加密连接令牌
     * 格式：IV(12B) || GCM_TAG(16B) || AES-256-GCM(payload)
     */
    private createLinkageToken(pseudoId: string): string {
        const payload = JSON.stringify({
            realVehicleId: this.realVehicleId,
            pseudoId,
            issuedAt: Date.now()
        });

        const iv = crypto.randomBytes(12); // GCM 推荐 96-bit IV
        const cipher = crypto.createCipheriv('aes-256-gcm', this.linkageKey, iv);
        const ciphertext = Buffer.concat([
            cipher.update(payload, 'utf8'),
            cipher.final()
        ]);
        const authTag = cipher.getAuthTag();

        return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    }
}
