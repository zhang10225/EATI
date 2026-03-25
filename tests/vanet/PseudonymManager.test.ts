import { PseudonymManager } from '../../src/vanet/PseudonymManager';
import * as crypto from 'crypto';

describe('PseudonymManager', () => {
    const TEST_VEHICLE_ID = 'vehicle-cn-皖A12345';
    let linkageKey: Buffer;
    let pm: PseudonymManager;

    beforeEach(() => {
        linkageKey = Buffer.alloc(32, 0x42); // 固定测试密钥
        pm = new PseudonymManager(TEST_VEHICLE_ID, linkageKey);
    });

    describe('generatePseudonym', () => {
        it('should generate a pseudonym with ECDSA P-256 keys', () => {
            const cert = pm.generatePseudonym();

            expect(cert.pseudoId).toHaveLength(32); // 16 random bytes encoded as 32 hex characters
            expect(cert.publicKey).toContain('BEGIN PUBLIC KEY');
            expect(cert.privateKey).toContain('BEGIN PRIVATE KEY');
        });

        it('should embed an encrypted linkage token', () => {
            const cert = pm.generatePseudonym();

            expect(cert.linkageToken).toBeDefined();
            expect(cert.linkageToken.length).toBeGreaterThan(0);
            // token 是 base64 编码的密文
            const raw = Buffer.from(cert.linkageToken, 'base64');
            // IV(12) + authTag(16) + ciphertext(>0) = at least 29 bytes
            expect(raw.length).toBeGreaterThan(28);
        });

        it('should generate different pseudoIds each time', () => {
            const cert1 = pm.generatePseudonym();
            const cert2 = pm.generatePseudonym();

            expect(cert1.pseudoId).not.toBe(cert2.pseudoId);
        });

        it('should generate different key pairs for each pseudonym', () => {
            const cert1 = pm.generatePseudonym();
            const cert2 = pm.generatePseudonym();

            expect(cert1.publicKey).not.toBe(cert2.publicKey);
            expect(cert1.privateKey).not.toBe(cert2.privateKey);
        });

        it('should set correct expiry time', () => {
            const durationMs = 60_000;
            const before = Date.now();
            const cert = pm.generatePseudonym(durationMs);
            const after = Date.now();

            expect(cert.expiresAt).toBeGreaterThanOrEqual(before + durationMs);
            expect(cert.expiresAt).toBeLessThanOrEqual(after + durationMs);
        });
    });

    describe('getCurrentPseudonym', () => {
        it('should return null when no pseudonyms exist', () => {
            expect(pm.getCurrentPseudonym()).toBeNull();
        });

        it('should return a valid pseudonym after generation', () => {
            pm.generatePseudonym(60_000);
            const current = pm.getCurrentPseudonym();

            expect(current).not.toBeNull();
            expect(current!.expiresAt).toBeGreaterThan(Date.now());
        });

        it('should return the most recently created valid pseudonym', () => {
            const cert1 = pm.generatePseudonym(60_000);
            const cert2 = pm.generatePseudonym(60_000);
            const current = pm.getCurrentPseudonym();

            // 应返回最新的
            expect(current!.pseudoId).toBe(cert2.pseudoId);
            expect(current!.pseudoId).not.toBe(cert1.pseudoId);
        });

        it('should not return an expired pseudonym', async () => {
            pm.generatePseudonym(1); // 1ms 有效期，马上过期
            await new Promise(r => setTimeout(r, 50));
            expect(pm.getCurrentPseudonym()).toBeNull();
        });
    });

    describe('decodeLinkageToken (PCA side)', () => {
        it('should decode linkage token with correct key', () => {
            const cert = pm.generatePseudonym();
            const decoded = PseudonymManager.decodeLinkageToken(cert.linkageToken, linkageKey);

            expect(decoded).not.toBeNull();
            expect(decoded!.realVehicleId).toBe(TEST_VEHICLE_ID);
            expect(decoded!.pseudoId).toBe(cert.pseudoId);
            expect(decoded!.issuedAt).toBeGreaterThan(0);
        });

        it('should link each pseudonym to the same real vehicle ID', () => {
            const cert1 = pm.generatePseudonym();
            const cert2 = pm.generatePseudonym();

            const d1 = PseudonymManager.decodeLinkageToken(cert1.linkageToken, linkageKey);
            const d2 = PseudonymManager.decodeLinkageToken(cert2.linkageToken, linkageKey);

            // 两张假名证书都指向同一真实车辆
            expect(d1!.realVehicleId).toBe(TEST_VEHICLE_ID);
            expect(d2!.realVehicleId).toBe(TEST_VEHICLE_ID);
            // 但假名 ID 不同（确保不可链接性）
            expect(d1!.pseudoId).not.toBe(d2!.pseudoId);
        });

        it('should return null with wrong key (AES-GCM auth failure)', () => {
            const cert = pm.generatePseudonym();
            const wrongKey = Buffer.alloc(32, 0x00);
            const decoded = PseudonymManager.decodeLinkageToken(cert.linkageToken, wrongKey);

            expect(decoded).toBeNull();
        });

        it('should return null for tampered token', () => {
            const cert = pm.generatePseudonym();
            // 篡改 GCM auth tag（字节 12-27）中的字节 14，直接修改原始字节确保触发校验失败
            const raw = Buffer.from(cert.linkageToken, 'base64');
            raw[14] ^= 0xFF; // flip bits at byte 14 within the GCM auth tag (bytes 12-27)
            const tampered = raw.toString('base64');
            const decoded = PseudonymManager.decodeLinkageToken(tampered, linkageKey);

            expect(decoded).toBeNull();
        });

        it('should return null for malformed token', () => {
            expect(PseudonymManager.decodeLinkageToken('not-valid-base64!!', linkageKey)).toBeNull();
            expect(PseudonymManager.decodeLinkageToken('', linkageKey)).toBeNull();
        });
    });

    describe('purgeExpired', () => {
        it('should remove expired pseudonyms and keep valid ones', async () => {
            pm.generatePseudonym(1);       // expires immediately
            pm.generatePseudonym(60_000);  // valid for 1 min

            await new Promise(r => setTimeout(r, 50));

            const removed = pm.purgeExpired();
            expect(removed).toBe(1);
            expect(pm.getAllPseudonyms()).toHaveLength(1);
            expect(pm.getAllPseudonyms()[0].expiresAt).toBeGreaterThan(Date.now());
        });

        it('should return 0 when nothing is expired', () => {
            pm.generatePseudonym(60_000);
            pm.generatePseudonym(60_000);

            expect(pm.purgeExpired()).toBe(0);
            expect(pm.getAllPseudonyms()).toHaveLength(2);
        });
    });

    describe('getLinkageKey', () => {
        it('should return the linkage key used for encryption', () => {
            const key = pm.getLinkageKey();
            expect(key).toEqual(linkageKey);
        });

        it('should auto-generate a random key when none provided', () => {
            const pm1 = new PseudonymManager('vehicle-1');
            const pm2 = new PseudonymManager('vehicle-2');

            // 两个不同实例应有不同的随机密钥
            expect(pm1.getLinkageKey().equals(pm2.getLinkageKey())).toBe(false);
        });
    });

    describe('privacy properties', () => {
        it('linkage token should be different for each pseudonym (randomized IV)', () => {
            const cert1 = pm.generatePseudonym();
            const cert2 = pm.generatePseudonym();

            // 每次加密都使用随机 IV，密文应不同
            expect(cert1.linkageToken).not.toBe(cert2.linkageToken);
        });

        it('OBU itself cannot decode its own linkage token without the PCA key', () => {
            const otherKey = crypto.randomBytes(32);
            const cert = pm.generatePseudonym();

            // 用错误密钥（模拟 OBU 不知道 PCA key）
            const decoded = PseudonymManager.decodeLinkageToken(cert.linkageToken, otherKey);
            expect(decoded).toBeNull();
        });
    });
});
