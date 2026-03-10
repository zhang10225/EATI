# VANET 适配方案：将 EATI 移植到车联网弱硬件场景

## 可行性结论

**完全可行，但需要三项关键适配。**

VANET（Vehicular Ad-hoc Network）与 AI Agent 网络面临的信任挑战高度同构：

| 挑战维度 | EATI（Agent 网络）| VANET（车联网）|
|---------|------------------|--------------| 
| 身份可伪造 | Agent 冒用他人身份 | 车辆伪造 BSM 消息来源 |
| 行为可抵赖 | Agent 动作无法追溯 | 事故现场数据可删改 |
| 大规模撤销 | Agent 证书吊销 | 百万量级 OBU 证书撤销 |
| 隐私与追责 | Agent 匿名性 | 车辆位置隐私 vs 执法追责 |

EATI 的核心机制（PKI + 设备绑定 + 门限授权 + 不可抵赖审计）在 VANET 场景下可以**直接映射**，三项适配应对 OBU 弱硬件和 V2X 通信特性的差异。

---

## 与 EATI 的机制映射

| EATI 机制 | VANET 对应机制 | 映射说明 |
|----------|--------------|---------|
| AEID 设备指纹绑定 | linkageToken 加密绑定 | OBU 对应物理车辆，设备绑定换成加密令牌绑定（PCA 侧解密）|
| Keystore 私钥存储 | OBU TPM/HSM | 操作系统级 Keystore → 硬件安全元件，两者都实现"私钥不离设备"|
| AgentID | pseudoId（假名 ID）| 从永久身份变为短期轮换假名，对外不暴露真实身份 |
| GuardianID（监护人）| 授权机构列表（n 个）| 单一监护人 → 多方机构，防止单点权力滥用 |
| MPC 门限签名 | k-of-n 多方批准 | 思路一致：需要多方协作才能触发高权限操作 |
| 审计链（黑匣子）| evidenceHash + 追责链 | 事件证据哈希上链，不可抵赖，形成可仲裁证据 |
| CSR/证书生命周期 | 假名证书生命周期 | 周期从"年"缩短至"分钟"，增加不可链接性 |

---

## 三项关键适配

### 适配 1：算法轻量化（RSA-2048 → ECDSA P-256）

| 对比项 | EATI（Agent 用）| VANET 适配 |
|--------|---------------|-----------|
| 签名算法 | RSA-2048-SHA256 | ECDSA P-256（IEEE 1609.2 标准）|
| 密钥长度 | 2048 bit | 256 bit |
| 签名大小 | 256 bytes | 64 bytes |
| 签名速度（OBU）| ~几十毫秒 | <1 ms |
| 私钥存储 | 操作系统 Keystore | OBU TPM/HSM 安全元件 |

**原因**：OBU 基于 ARM Cortex-M 或 FPGA，算力约为 PC 的 1/100；DSRC/C-V2X 每 100 ms 广播一条 BSM，签名验证必须在几毫秒内完成；IEEE 1609.2 已将 ECDSA P-256 作为标准，与现有 V2X 基础设施兼容。

当前 VANET 模块（`PseudonymManager`）已使用 `crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' })` 实现 ECDSA P-256。

---

### 适配 2：实时撤销降低 OBU 通信开销（CRL → Bloom Filter）

#### 问题

百万辆 OBU 的传统 CRL（证书撤销列表）可达数 MB。DSRC/C-V2X 带宽有限，OBU 无法实时下载完整 CRL；EATI 当前无撤销机制，需为 VANET 场景新增。

#### Bloom Filter 方案（`BloomRevocationList`）

```
RSU（路侧单元）— 每小时更新
  │
  ├─ brl.add(revokedSerial)   // 将所有撤销证书序列号加入 filter
  └─ brl.export()             // 导出紧凑二进制（~18 KB / 万条撤销）
        │ DSRC/C-V2X 广播（约 1-2 秒传完）
        ↓
OBU（车载单元）— 本地持有 filter
  │
  └─ brl.mightBeRevoked(peerSerial)
        │ O(k) 本地查询，无需网络，<0.01 ms
        ├─ false → 确定未撤销，继续通信
        └─ true  → 可能已撤销，拒绝该消息或向 RSU 二次确认
```

#### 规模参数（0.1% 误判率）

| 撤销数量 | Filter 大小 | 哈希函数数 | 说明 |
|---------|------------|-----------|------|
| 1,000   | ~1.8 KB    | 10        | 小城市场景 |
| 10,000  | ~18 KB     | 10        | 大城市场景（推荐默认值）|
| 100,000 | ~180 KB    | 10        | 省级规模 |

#### 安全性质

- **无漏判（No False Negative）**：不会把真正撤销的证书判为有效，这是安全关键属性
- **极小误判（Low False Positive）**：0.1% FP 率意味着千分之一合法证书被误判；OBU 可向 RSU 发送单播确认请求
- **更新机制**：RSU 每隔固定周期（如 1 小时）广播新 filter，OBU 覆盖更新，旧 filter 自动失效

---

### 适配 3：隐私与追责均衡（假名证书 + 条件追踪）

#### 问题

- **隐私威胁**：车辆如果用固定真实身份广播 BSM，路边任何设备都能长期追踪其轨迹（违反 GDPR）
- **追责需求**：发生碰撞逃逸、虚假预警等恶意行为时，需要事后追溯真实车辆身份

#### 假名证书轮换（`PseudonymManager`）

```
OBU 每 5 分钟轮换一张假名证书：
  ├─ pseudoId = random 32-hex（公开，每次不同）
  ├─ ECDSA P-256 密钥对（短期，到期销毁）
  └─ linkageToken = AES-256-GCM(realVehicleId, pseudoId, IV=random)
                    ↑ 只有 PCA 持有解密密钥（linkageKey），OBU 自身无法解密

BSM 广播使用当前假名的私钥签名，接收方用假名公钥验签。
不同时段/不同地点的观察者无法将多个假名关联到同一车辆（不可链接性）。
```

#### 条件隐私追踪（`ConditionalTracer`）

```
发生恶意行为后的追责流程（k-of-n = 2-of-3 示例）：

  ① 执法方采集证据（dashcam、RSU 日志）→ evidenceHash 上链（不可抵赖）
  ② 执法方向追踪系统提交 createRequest(pseudoId, incident, evidenceHash)
  ③ 3 个授权机构独立审核（交警、法院、交通部门）
  ④ 2 个机构批准 → 达到门限
  ⑤ PCA 收到批准信号，用 linkageKey 解密 linkageToken → 得到 realVehicleId
  ⑥ 执法方获得真实车牌，完成追责

  门限未达到 → PCA 不解密，隐私保护生效
  单一机构无法单独揭示任何车辆身份（防止权力滥用）
```

---

## 完整架构图

```
┌───────────────────────────────────────────────────────────────┐
│                      VANET 信任基础设施                         │
├──────────────┬─────────────────┬──────────────┬───────────────┤
│  PCA          │  RSU            │  OBU         │  执法/监管方   │
│（假名 CA）    │（路侧单元）      │（车载单元）   │               │
├──────────────┼─────────────────┼──────────────┼───────────────┤
│ 持有 linkageKey│ 维护撤销 filter │ 存储假名私钥  │ 发起追责请求  │
│ 颁发假名证书  │ 每小时广播 filter│ 每 5min 轮换  │ 提供 evidence │
│ 事后解密 token│ 转发 V2X 消息   │ 本地撤销查询  │ 参与 k-of-n   │
└──────────────┴─────────────────┴──────────────┴───────────────┘

信任数据流：
  PCA ──[下发假名证书]──→ OBU
  RSU ──[广播 Bloom Filter]──→ OBU
  OBU ──[BSM + 假名签名]──→ 周围车辆 & RSU
  执法方 ──[追责请求]──→ ConditionalTracer ──[k-of-n 批准]──→ PCA ──[解密 token]──→ realVehicleId
```

---

## 代码模块说明

### `src/vanet/BloomRevocationList.ts`

轻量级撤销检查，适配 OBU 受限环境：

```typescript
// RSU 侧：构建 filter 并广播
const brl = new BloomRevocationList(143776, 10); // ~18 KB，适合 1 万条撤销
brl.add('cert-serial-001'); // 加入已撤销证书
const filterData = brl.export();    // 导出 base64，通过 DSRC/C-V2X 广播

// OBU 侧：接收 filter 并本地查询
const localFilter = BloomRevocationList.import(filterData);
if (localFilter.mightBeRevoked(peerCertSerial)) {
    // 拒绝通信或向 RSU 二次确认
}
```

### `src/vanet/PseudonymManager.ts`

假名证书生命周期管理：

```typescript
// OBU 初始化时（PCA 下发 linkageKey 给 PCA 自己保管，此处仅演示）
const pm = new PseudonymManager('vehicle-皖A12345', linkageKey);

// 每 5 分钟轮换假名
const cert = pm.generatePseudonym(5 * 60 * 1000);
// cert.publicKey  → BSM 中广播，让接收方验签
// cert.privateKey → 用于对 BSM 签名（存在 OBU TPM 中）
// cert.linkageToken → 嵌入假名证书，仅 PCA 可解密

// PCA 侧解密（追责时）
const identity = PseudonymManager.decodeLinkageToken(cert.linkageToken, linkageKey);
// identity.realVehicleId === 'vehicle-皖A12345'
```

### `src/vanet/ConditionalTracer.ts`

k-of-n 条件隐私追踪：

```typescript
const tracer = new ConditionalTracer(2, ['traffic-police', 'court', 'transport-ministry']);

// 执法方创建追责请求
const req = tracer.createRequest(pseudoId, '虚假碰撞预警', evidenceHash);

// 各机构独立审批后汇总
const result = tracer.resolveTracing(req, approvals, cert.linkageToken, linkageKey);
if (result.success) {
    console.log(result.realVehicleId); // 真实车牌
}
```

---

## 局限性与生产建议

| 项目 | 当前 VANET 模块 | 生产部署建议 |
|------|--------------|------------|
| 假名颁发 | OBU 自生成（演示用）| PCA 通过安全信道预下发一批假名证书 |
| linkageKey 保管 | 构造函数参数（演示）| PCA 严格保管，绝不下发 OBU，使用 HSM 存储 |
| 私钥存储 | 进程内存 | OBU 内置 TPM 2.0 或 SE（安全元件）|
| Bloom Filter 广播 | Base64 字符串 | 封装为 IEEE 1609.2 消息，通过 DSRC/C-V2X 广播 |
| 授权机构审批 | 内存中的 Map | 需要分布式签名验证 + 链上存证 |
| 假名轮换时机 | 固定时间间隔 | 结合行驶状态（停车/转弯时轮换，减少关联）|

---

## 扩展路径

| 阶段 | 技术 | 对应 EATI 扩展路径 |
|------|------|------------------|
| v1.1 | OCSP Stapling（短时效在线验证）| 与 Bloom Filter 互补，用于高价值交易场景 |
| v1.2 | Group Signature / Ring Signature | 更强的不可链接性，无需频繁轮换 |
| v2.0 | 区块链撤销日志 + zk-SNARK 证明 | 链上不可篡改撤销，零知识证明身份有效性 |
| v3.0 | 联邦 PCA（多国互信）| 跨境车辆信任，对应 EATI 的 DID/VC 跨生态互认 |
