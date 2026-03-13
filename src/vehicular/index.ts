/**
 * 车联网撤销与追责模块
 * Vehicular Network Revocation & Accountability with Agent Collaboration
 *
 * 基于 EATI (Esign Agent Trust Infrastructure) 信任基础设施思想
 * 适配到车联网 (V2X) 场景，实现：
 * 1. 车辆身份管理 (Vehicle Identity Manager)
 * 2. 证书撤销管理 (Certificate Revocation Manager with Bloom Filter)
 * 3. Agent 协同信任 (Multi-Agent Collaborative Trust)
 * 4. 追责与证据链 (Accountability Tracer with Merkle Tree)
 *
 * @see docs/RESEARCH_ROADMAP.md 研究路线图与论文推荐
 */

export { VehicleIdentityManager } from './VehicleIdentityManager';
export { CertificateRevocationManager, BloomFilter } from './CertificateRevocationManager';
export { AgentCollaborativeTrust } from './AgentCollaborativeTrust';
export { AccountabilityTracer } from './AccountabilityTracer';
export { PerformanceBenchmark } from './PerformanceBenchmark';
export { IntegrationScenario } from './IntegrationScenario';

export * from './types';
