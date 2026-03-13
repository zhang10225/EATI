import { VehicleIdentityManager } from '../../src/vehicular/VehicleIdentityManager';
import { CertificateStatus } from '../../src/vehicular/types';

describe('VehicleIdentityManager', () => {
    let manager: VehicleIdentityManager;

    beforeEach(() => {
        manager = new VehicleIdentityManager();
    });

    describe('OBU Fingerprint Generation', () => {
        it('should generate consistent OBU fingerprint for same inputs', () => {
            const fp1 = manager.generateOBUFingerprint('OBU-001', 'HW-ABC');
            const fp2 = manager.generateOBUFingerprint('OBU-001', 'HW-ABC');
            expect(fp1).toBe(fp2);
        });

        it('should generate different fingerprints for different inputs', () => {
            const fp1 = manager.generateOBUFingerprint('OBU-001', 'HW-ABC');
            const fp2 = manager.generateOBUFingerprint('OBU-002', 'HW-DEF');
            expect(fp1).not.toBe(fp2);
        });

        it('should return a 32-character hex string', () => {
            const fp = manager.generateOBUFingerprint('OBU-001', 'HW-ABC');
            expect(fp).toMatch(/^[0-9a-f]{32}$/);
        });
    });

    describe('Network Fingerprint Generation', () => {
        it('should generate consistent network fingerprint', () => {
            const fp1 = manager.generateNetworkFingerprint('STATION-001', 'AA:BB:CC:DD:EE:FF');
            const fp2 = manager.generateNetworkFingerprint('STATION-001', 'AA:BB:CC:DD:EE:FF');
            expect(fp1).toBe(fp2);
        });

        it('should return a 16-character hex string', () => {
            const fp = manager.generateNetworkFingerprint('STATION-001', 'AA:BB:CC:DD:EE:FF');
            expect(fp).toMatch(/^[0-9a-f]{16}$/);
        });
    });

    describe('Vehicle Registration', () => {
        it('should register a vehicle successfully', () => {
            const identity = manager.registerVehicle(
                'VIN-12345', 'OBU-001', 'HW-ABC', 'STATION-001', 'AA:BB:CC:DD:EE:FF'
            );

            expect(identity.vin).toBe('VIN-12345');
            expect(identity.obuFingerprint).toMatch(/^[0-9a-f]{32}$/);
            expect(identity.networkFingerprint).toMatch(/^[0-9a-f]{16}$/);
            expect(identity.registrationTimestamp).toBeGreaterThan(0);
        });

        it('should track registered vehicle count', () => {
            expect(manager.getRegisteredVehicleCount()).toBe(0);

            manager.registerVehicle('VIN-1', 'OBU-1', 'HW-1', 'ST-1', 'AA:BB:CC:DD:EE:01');
            expect(manager.getRegisteredVehicleCount()).toBe(1);

            manager.registerVehicle('VIN-2', 'OBU-2', 'HW-2', 'ST-2', 'AA:BB:CC:DD:EE:02');
            expect(manager.getRegisteredVehicleCount()).toBe(2);
        });

        it('should check if vehicle is registered', () => {
            expect(manager.isRegistered('VIN-12345')).toBe(false);
            manager.registerVehicle('VIN-12345', 'OBU-001', 'HW-ABC', 'ST-001', 'AA:BB:CC:DD:EE:FF');
            expect(manager.isRegistered('VIN-12345')).toBe(true);
        });
    });

    describe('VID Hash', () => {
        it('should generate VID hash for registered vehicle', () => {
            const identity = manager.registerVehicle(
                'VIN-12345', 'OBU-001', 'HW-ABC', 'STATION-001', 'AA:BB:CC:DD:EE:FF'
            );
            const vidHash = manager.generateVIDHash(identity);

            expect(vidHash.version).toBe('v1');
            expect(vidHash.hash).toMatch(/^[0-9a-f]{64}$/);
            expect(vidHash.generatedAt).toBeGreaterThan(0);
        });

        it('should verify VID hash correctly (timing-safe)', () => {
            const identity = manager.registerVehicle(
                'VIN-12345', 'OBU-001', 'HW-ABC', 'STATION-001', 'AA:BB:CC:DD:EE:FF'
            );
            const vidHash = manager.generateVIDHash(identity);

            expect(manager.verifyVIDHash(identity, vidHash.hash)).toBe(true);
        });

        it('should reject incorrect VID hash', () => {
            const identity = manager.registerVehicle(
                'VIN-12345', 'OBU-001', 'HW-ABC', 'STATION-001', 'AA:BB:CC:DD:EE:FF'
            );
            const wrongHash = '0'.repeat(64);

            expect(manager.verifyVIDHash(identity, wrongHash)).toBe(false);
        });
    });

    describe('Pseudonym Certificate', () => {
        it('should issue pseudonym certificate for registered vehicle', () => {
            manager.registerVehicle('VIN-12345', 'OBU-001', 'HW-ABC', 'ST-001', 'AA:BB:CC:DD:EE:FF');
            const cert = manager.issuePseudonymCertificate('VIN-12345', 'TA-001');

            expect(cert.certId).toMatch(/^[0-9a-f]{32}$/);
            expect(cert.status).toBe(CertificateStatus.ACTIVE);
            expect(cert.issuerId).toBe('TA-001');
            expect(cert.publicKey).toContain('BEGIN PUBLIC KEY');
            expect(cert.expiresAt).toBeGreaterThan(cert.issuedAt);
        });

        it('should throw error for unregistered vehicle', () => {
            expect(() => {
                manager.issuePseudonymCertificate('VIN-UNKNOWN', 'TA-001');
            }).toThrow('Vehicle not registered: VIN-UNKNOWN');
        });

        it('should return active certificates', () => {
            manager.registerVehicle('VIN-12345', 'OBU-001', 'HW-ABC', 'ST-001', 'AA:BB:CC:DD:EE:FF');
            manager.issuePseudonymCertificate('VIN-12345', 'TA-001');
            manager.issuePseudonymCertificate('VIN-12345', 'TA-001');

            const activeCerts = manager.getActiveCertificates('VIN-12345');
            expect(activeCerts.length).toBe(2);
        });
    });

    describe('Identity Resolution (TA only)', () => {
        it('should resolve VID hash to VIN', () => {
            const identity = manager.registerVehicle(
                'VIN-12345', 'OBU-001', 'HW-ABC', 'STATION-001', 'AA:BB:CC:DD:EE:FF'
            );
            const vidHash = manager.generateVIDHash(identity);
            const resolvedVin = manager.resolveIdentity(vidHash.hash);

            expect(resolvedVin).toBe('VIN-12345');
        });

        it('should return undefined for unknown VID hash', () => {
            const result = manager.resolveIdentity('unknown_hash');
            expect(result).toBeUndefined();
        });
    });
});
