import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { VehicleIdentity, VehicleIdentityHash, PseudonymCertificate, CertificateStatus } from './types';

/**
 * 车辆身份管理器
 * 基于 EATI 的 KeyManager + DeviceFingerprint 思想
 * 适配到车联网 OBU 指纹绑定场景
 *
 * 核心功能:
 * 1. 生成车辆唯一身份标识 (VID) - 对应 EATI 的 AEID
 * 2. OBU 硬件指纹绑定 - 对应 EATI 的设备指纹
 * 3. 假名证书生命周期管理
 * 4. VID 哈希生成与验证（恒定时间比较）
 */
export class VehicleIdentityManager {
    /** 已注册的车辆身份 */
    private vehicles: Map<string, VehicleIdentity> = new Map();
    /** 假名证书池 */
    private certificates: Map<string, PseudonymCertificate[]> = new Map();
    /** VID hash 到真实身份的映射（仅 TA 可访问） */
    private vidHashToIdentity: Map<string, string> = new Map();
    /** VID hash 版本 */
    private readonly vidVersion = 'v1';

    /**
     * 生成 OBU 硬件指纹
     * 对应 EATI 的 DeviceFingerprint.generateAEID()
     * 在实际部署中，这些值来自 OBU 硬件的安全模块 (HSM/TPM)
     *
     * @param obuSerial OBU 序列号
     * @param hardwareId OBU 硬件 ID
     * @returns OBU 指纹哈希
     */
    public generateOBUFingerprint(obuSerial: string, hardwareId: string): string {
        const data = `obu|${obuSerial}|${hardwareId}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * 生成网络标识指纹
     * 对应 EATI 的 DeviceFingerprint.getIpFingerprint()
     * 基于 V2X 通信特征生成
     *
     * @param v2xStationId V2X Station ID
     * @param macAddress 通信接口 MAC 地址
     * @returns 网络指纹哈希
     */
    public generateNetworkFingerprint(v2xStationId: string, macAddress: string): string {
        const data = `net|${v2xStationId}|${macAddress}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    /**
     * 注册车辆身份
     * 对应 EATI 的 initAgent() 流程
     *
     * @param vin 车辆识别号
     * @param obuSerial OBU 序列号
     * @param hardwareId OBU 硬件 ID
     * @param v2xStationId V2X Station ID
     * @param macAddress 通信接口 MAC
     * @returns 注册的车辆身份信息
     */
    public registerVehicle(
        vin: string,
        obuSerial: string,
        hardwareId: string,
        v2xStationId: string,
        macAddress: string
    ): VehicleIdentity {
        const obuFingerprint = this.generateOBUFingerprint(obuSerial, hardwareId);
        const networkFingerprint = this.generateNetworkFingerprint(v2xStationId, macAddress);

        const identity: VehicleIdentity = {
            vin,
            obuFingerprint,
            networkFingerprint,
            registrationTimestamp: Date.now()
        };

        this.vehicles.set(vin, identity);

        // 建立 VID hash 到真实身份的映射
        const vidHash = this.generateVIDHash(identity);
        this.vidHashToIdentity.set(vidHash.hash, vin);

        return identity;
    }

    /**
     * 生成 VID 哈希
     * 对应 EATI 的 DeviceFingerprint.generateAEIDHash()
     * 使用规范化格式确保一致性
     *
     * @param identity 车辆身份
     * @returns VID 哈希对象
     */
    public generateVIDHash(identity: VehicleIdentity): VehicleIdentityHash {
        const canonical = `${this.vidVersion}|vin=${identity.vin}|obu=${identity.obuFingerprint}|net=${identity.networkFingerprint}`;
        const hash = crypto.createHash('sha256').update(canonical).digest('hex');

        return {
            version: this.vidVersion,
            hash,
            generatedAt: Date.now()
        };
    }

    /**
     * 验证 VID 哈希（恒定时间比较）
     * 对应 EATI 的 DeviceFingerprint.verifyAEIDHash()
     * 使用 timing-safe 比较防止时序攻击
     *
     * @param identity 车辆身份
     * @param expectedHash 期望的哈希值
     * @returns 是否匹配
     */
    public verifyVIDHash(identity: VehicleIdentity, expectedHash: string): boolean {
        const vidHash = this.generateVIDHash(identity);
        const actualBuffer = Buffer.from(vidHash.hash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');

        if (actualBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
    }

    /**
     * 为车辆生成假名证书
     * 车联网特有功能：隐私保护的假名机制
     *
     * @param vin 车辆识别号
     * @param issuerId 颁发者 (TA) ID
     * @param validityPeriodMs 有效期（毫秒）
     * @returns 假名证书
     */
    public issuePseudonymCertificate(
        vin: string,
        issuerId: string,
        validityPeriodMs: number = 3600000 // 默认 1 小时
    ): PseudonymCertificate {
        const identity = this.vehicles.get(vin);
        if (!identity) {
            throw new Error(`Vehicle not registered: ${vin}`);
        }

        const vidHash = this.generateVIDHash(identity);
        const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
        const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

        const now = Date.now();
        const certId = crypto.createHash('sha256')
            .update(`${vidHash.hash}|${now}|${crypto.randomBytes(16).toString('hex')}`)
            .digest('hex')
            .substring(0, 32);

        const cert: PseudonymCertificate = {
            certId,
            vidHash: vidHash.hash,
            publicKey: publicKeyPem,
            issuedAt: now,
            expiresAt: now + validityPeriodMs,
            issuerId,
            status: CertificateStatus.ACTIVE
        };

        // 存储证书
        const certs = this.certificates.get(vin) || [];
        certs.push(cert);
        this.certificates.set(vin, certs);

        return cert;
    }

    /**
     * 获取车辆的活跃假名证书
     */
    public getActiveCertificates(vin: string): PseudonymCertificate[] {
        const certs = this.certificates.get(vin) || [];
        const now = Date.now();
        return certs.filter(c =>
            c.status === CertificateStatus.ACTIVE && c.expiresAt > now
        );
    }

    /**
     * 通过 VID hash 查找真实身份 (仅 TA 可用)
     * 这是追责机制的关键：在需要时可以恢复真实身份
     *
     * @param vidHash VID 哈希
     * @returns 车辆 VIN 或 undefined
     */
    public resolveIdentity(vidHash: string): string | undefined {
        return this.vidHashToIdentity.get(vidHash);
    }

    /**
     * 获取已注册车辆数量
     */
    public getRegisteredVehicleCount(): number {
        return this.vehicles.size;
    }

    /**
     * 检查车辆是否已注册
     */
    public isRegistered(vin: string): boolean {
        return this.vehicles.has(vin);
    }

    /**
     * 获取车辆身份信息
     */
    public getVehicleIdentity(vin: string): VehicleIdentity | undefined {
        return this.vehicles.get(vin);
    }
}
