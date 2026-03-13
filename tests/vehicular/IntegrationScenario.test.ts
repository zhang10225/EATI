import { IntegrationScenario, ScenarioStep } from '../../src/vehicular/IntegrationScenario';
import { RevocationRequestStatus, CertificateStatus } from '../../src/vehicular/types';

describe('IntegrationScenario', () => {
    describe('Misbehavior Detection Scenario', () => {
        it('should complete all steps successfully', () => {
            const scenario = new IntegrationScenario();
            const result = scenario.runMisbehaviorScenario('VIN_TEST_001', 5);

            expect(result.scenarioName).toContain('Misbehavior');
            expect(result.steps.length).toBe(10);
            expect(result.allPassed).toBe(true);
            expect(result.totalDurationMs).toBeGreaterThan(0);
        });

        it('should follow the correct step order', () => {
            const scenario = new IntegrationScenario();
            const result = scenario.runMisbehaviorScenario();

            const expectedSteps = [
                ScenarioStep.VEHICLE_REGISTRATION,
                ScenarioStep.CERTIFICATE_ISSUANCE,
                ScenarioStep.AGENT_SETUP,
                ScenarioStep.MISBEHAVIOR_DETECTION,
                ScenarioStep.TRUST_EVALUATION,
                ScenarioStep.COLLABORATIVE_REVOCATION,
                ScenarioStep.REVOCATION_EXECUTION,
                ScenarioStep.EVIDENCE_COLLECTION,
                ScenarioStep.ACCOUNTABILITY_AUDIT,
                ScenarioStep.IDENTITY_RESOLUTION
            ];

            expect(result.steps.map(s => s.step)).toEqual(expectedSteps);
        });

        it('should actually revoke the certificate', () => {
            const scenario = new IntegrationScenario();
            scenario.runMisbehaviorScenario('VIN_REVOKE_TEST', 5);

            const { revocationManager } = scenario.getManagers();
            // The certificate should be in the Bloom Filter
            expect(revocationManager.getRevocationCount()).toBe(1);
        });

        it('should collect evidence on the Merkle chain', () => {
            const scenario = new IntegrationScenario();
            scenario.runMisbehaviorScenario('VIN_EVIDENCE_TEST', 5);

            const { tracer } = scenario.getManagers();
            expect(tracer.getEvidenceCount()).toBeGreaterThanOrEqual(4);
            expect(tracer.verifyChainIntegrity()).toBe(true);
            expect(tracer.getMerkleRoot()).toBeTruthy();
        });

        it('should resolve attacker identity', () => {
            const scenario = new IntegrationScenario();
            scenario.runMisbehaviorScenario('VIN_RESOLVE_TEST', 3);

            const { idManager } = scenario.getManagers();
            expect(idManager.isRegistered('VIN_RESOLVE_TEST')).toBe(true);

            const identity = idManager.getVehicleIdentity('VIN_RESOLVE_TEST')!;
            const vidHash = idManager.generateVIDHash(identity);
            expect(idManager.resolveIdentity(vidHash.hash)).toBe('VIN_RESOLVE_TEST');
        });

        it('should work with minimum 3 agents', () => {
            const scenario = new IntegrationScenario();
            const result = scenario.runMisbehaviorScenario('VIN_MIN_AGENTS', 3);

            expect(result.allPassed).toBe(true);
        });
    });

    describe('Sybil Attack Scenario', () => {
        it('should complete all steps successfully', () => {
            const scenario = new IntegrationScenario();
            const result = scenario.runSybilAttackScenario('VIN_SYBIL_001', 3);

            expect(result.scenarioName).toContain('Sybil');
            expect(result.allPassed).toBe(true);
            expect(result.totalDurationMs).toBeGreaterThan(0);
        });

        it('should revoke all Sybil certificates', () => {
            const scenario = new IntegrationScenario();
            scenario.runSybilAttackScenario('VIN_SYBIL_002', 4);

            const { revocationManager } = scenario.getManagers();
            // All fake certificates should be revoked
            expect(revocationManager.getRevocationCount()).toBe(4);
        });

        it('should identify Sybil attacker through identity resolution', () => {
            const scenario = new IntegrationScenario();
            scenario.runSybilAttackScenario('VIN_SYBIL_003', 2);

            const { idManager } = scenario.getManagers();
            const identity = idManager.getVehicleIdentity('VIN_SYBIL_003')!;
            const vidHash = idManager.generateVIDHash(identity);
            expect(idManager.resolveIdentity(vidHash.hash)).toBe('VIN_SYBIL_003');
        });
    });

    describe('Scenario Step Timing', () => {
        it('should record timing for each step', () => {
            const scenario = new IntegrationScenario();
            const result = scenario.runMisbehaviorScenario();

            for (const step of result.steps) {
                expect(step.durationMs).toBeGreaterThanOrEqual(0);
                expect(step.details).toBeTruthy();
            }
        });
    });
});
