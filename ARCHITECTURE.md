# EATI 项目主要实现思路

## 1. 整体设计思路

EATI（Esign Agent Trust Infrastructure）的核心目标是为 AI Agent 提供**可信身份**、**可验证执行**与**监管追溯**能力。SDK 以 PKI（公钥基础设施）为基础，结合设备指纹绑定技术，实现"密钥不离设备、身份不可伪造、行为可被追溯"三个核心性质。

整体分为四个层次：

```
┌─────────────────────────────────────────┐
│           CLI / 外部应用                 │  ← 用户入口（Commander.js）
├─────────────────────────────────────────┤
│       EsignAgentTrust（主类）            │  ← SDK 门面，编排各模块
├──────────┬──────────┬────────┬──────────┤
│KeyManager│CSRGener- │Cert-   │Signature │  ← 核心功能模块
│          │ator      │Manager │Service   │
├──────────┴──────────┴────────┴──────────┤
│        DeviceFingerprint（AEID）         │  ← 设备绑定基础层
└─────────────────────────────────────────┘
```

---

## 2. 模块职责

### 2.1 `EsignAgentTrust`（主类，`src/index.ts`）

**门面模式（Facade）**：对外屏蔽内部模块细节，提供四个核心接口：

| 接口 | 说明 |
|------|------|
| `initAgent(agentName)` | 生成 RSA 密钥对 + AEID + CSR，保存私钥到系统 Keystore |
| `importAgentCertificate(agentName, certPath)` | 验证证书与 AgentName 一致性 + 设备绑定，加载私钥，激活签名服务 |
| `signByAgent(agentName, content)` | 加载凭证后执行 RSA-SHA256 签名 |
| `removeAgent(agentName)` | 清除私钥（Keystore）+ 证书 + CSR + 公钥文件 |

### 2.2 `KeyManager`（`src/core/KeyManager.ts`）

**私钥零暴露**：私钥从不以明文形式在内存以外存在。

- 使用 `node-forge` 在内存中生成 2048-bit RSA 密钥对
- 通过 `keytar` 将私钥 PEM 写入操作系统 Keystore：
  - macOS → Keychain
  - Windows → Credential Manager
  - Linux → Secret Service API（libsecret）
- `listStoredAgents()` 通过 `keytar.findCredentials()` 枚举已注册 Agent，实现去重检查

### 2.3 `DeviceFingerprint`（`src/core/DeviceFingerprint.ts`）

**AEID（Agent Entity ID）**：设备绑定的核心机制。

采集设备信息生成确定性指纹，分为两个独立部分：

```
MAC 地址  ──┐
设备ID     ──┴──→ 规范化字符串 ──→ MD5 哈希 ──→ 32 位小写 hex（AEID Hash）

IP 指纹    ──→ 存入 AEID 对象（不参与 AEID Hash 计算）
```

其中：
- **deviceId** 由 hostname、platform、arch、CPU 型号、总内存计算得到（不涉及 IP）
- **IP 指纹** 独立采集，保存在 AEID 对象的 `ipFingerprint` 字段中，但 **不参与** AEID Hash 的计算
- **AEID Hash** 的规范化格式为 `v1|mac=<mac>|did=<deviceId>`，仅由 MAC 地址和 deviceId 决定

**抗时序攻击**：`verifyAEIDHash()` 使用 `crypto.timingSafeEqual()` 比对哈希，防止基于响应时间的旁路攻击。

### 2.4 `CSRGenerator`（`src/core/CSRGenerator.ts`）

CSR 的 CN（CommonName）字段承载所有 Agent 元数据，格式为：

```
AgentID | GuardianID | AEID_Hash | FrameworkType | Purpose
```

- AEID Hash 嵌入 CN，使证书与设备强绑定
- 使用私钥对 CSR 进行 SHA-256 自签名，证明申请者持有对应私钥
- CN 长度校验（≤ 100 字符），防止字段溢出

### 2.5 `CertificateManager`（`src/core/CertificateManager.ts`）

- 解析证书 CN 字段，提取 AgentName 和 AEID Hash
- `verifyDeviceBinding()`：从证书中取出 AEID Hash，与当前设备实时计算的 Hash 比对，确保"证书绑定设备"
- 证书文件以 `0o600` 权限（仅 owner 可读写）存储在 `~/.esign-agent/`

### 2.6 `SignatureService`（`src/core/SignatureService.ts`）

每次签名前强制执行设备绑定验证（`verifyDevice: boolean = true`），流程：

```
sign(data)
  ├── verifyDeviceBinding()  ← 设备不匹配则抛出错误
  ├── getPrivateKey()        ← 从内存获取已加载的私钥
  ├── SHA-256(data)          ← 计算数据摘要
  └── RSA-PKCS1(摘要)        ← 私钥加密摘要，Base64 编码输出
```

---

## 3. 关键生命周期：Agent 身份的建立与使用

### 3.1 初始化阶段（`initAgent`）

```
initAgent("MyAgent")
  │
  ├─ 检查去重（keytar.findCredentials）
  ├─ generateKeyPair()          → 内存中生成 RSA 密钥对
  ├─ savePrivateKey("MyAgent")  → 私钥 PEM 写入系统 Keystore
  ├─ generateAEID()             → 采集 MAC + DeviceID + IP 生成设备指纹
  ├─ generateAEIDHash(aeid)     → MD5 压缩为 32 位 hex
  ├─ createCSR(subject, keys)   → 生成含 AEID Hash 的 CSR，自签名
  ├─ saveCSR → ~/.esign-agent/MyAgent.pem        (0o600)
  └─ savePublicKey → ~/.esign-agent/MyAgent.pub  (0o644)
```

### 3.2 证书导入阶段（`importAgentCertificate`）

```
importAgentCertificate("MyAgent", "cert.pem")
  │
  ├─ hasPrivateKey("MyAgent")       → 确认私钥已在 Keystore
  ├─ loadCertificateFromFile()      → 解析 X.509 证书
  ├─ getAgentId()                   → 从证书 CN 提取 AgentName
  ├─ 一致性校验：传入名称 == 证书名称
  ├─ verifyDeviceBinding()          → AEID Hash 比对
  ├─ loadPrivateKey("MyAgent")      → 从 Keystore 加载私钥到内存
  ├─ derivePublicKey()              → 从私钥派生公钥
  ├─ saveCertificate("MyAgent")     → 保存证书文件
  └─ new SignatureService(...)      → 签名服务就绪，initialized = true
```

### 3.3 签名阶段（`signByAgent`）

```
signByAgent("MyAgent", content)
  │
  ├─ load("MyAgent")
  │   ├─ loadCertificate()       → 加载证书文件
  │   ├─ hasPrivateKey()         → 确认私钥存在
  │   ├─ verifyDeviceBinding()   → 设备绑定校验
  │   └─ loadPrivateKey()        → 加载私钥到内存
  │
  └─ sign(content)
      ├─ verifyDeviceBinding()   → 二次校验（签名时实时验证）
      ├─ SHA-256 摘要
      ├─ RSA-PKCS1 签名
      └─ Base64 编码返回
```

---

## 4. 核心安全机制

### 4.1 设备绑定（防私钥复制滥用）

AEID Hash 在 CSR 生成时嵌入证书请求，CA 签发的证书中同样包含该 Hash。每次**导入证书**和**执行签名**时，SDK 都会实时重新采集当前设备指纹并与证书中的 Hash 比对。私钥即使被复制到其他设备，也无法通过设备绑定校验。

### 4.2 私钥零暴露

私钥仅在以下两个时间点短暂存在于进程内存：
1. 密钥对生成后（等待写入 Keystore）
2. 签名操作期间（从 Keystore 加载后使用）

私钥从不写入普通文件系统。

### 4.3 文件权限控制

| 文件 | 权限 | 说明 |
|------|------|------|
| `~/.esign-agent/` | `0o700` | 目录仅 owner 可访问 |
| `*.pem`（CSR/证书） | `0o600` | 仅 owner 可读写 |
| `*.pub`（公钥） | `0o644` | owner 可读写，group 和 others 可读 |

### 4.4 抗时序攻击

AEID Hash 比对使用 `crypto.timingSafeEqual()`，确保无论哈希是否匹配，比较时间恒定，防止旁路攻击。

---

## 5. 模块依赖关系

```
EsignAgentTrust
  ├── KeyManager
  │     └── node-forge (RSA)
  │     └── keytar (系统 Keystore)
  ├── DeviceFingerprint
  │     └── os (网络接口/主机信息)
  │     └── crypto (MD5/SHA-256)
  ├── CSRGenerator
  │     ├── node-forge (CSR 构建/签名)
  │     └── DeviceFingerprint
  ├── CertificateManager
  │     ├── node-forge (X.509 解析)
  │     └── DeviceFingerprint
  └── SignatureService
        ├── KeyManager
        ├── CertificateManager
        └── DeviceFingerprint
```

---

## 6. 扩展路径

当前 v1.0 实现了 L1/L2 层能力（身份 + 签名 + 设备绑定）。后续版本扩展方向：

| 层次 | 技术 | 实现思路 |
|------|------|----------|
| L3 可信执行 | TEE + Remote Attestation | SGX（进程级隔离）、SEV（VM 内存加密）、TDX（VM 级机密计算）三者实现方式不同，需分别适配；在 `SignatureService` 中增加 Attestation Report 生成与验证钩子 |
| 审计链 | Merkle 透明日志 + OpenTelemetry | 在每次签名后将事件哈希提交到审计链 |
| MPC 门限签名 | 私钥分片 + 多方协同签名 | 替换 `KeyManager` 的单机私钥存储方案 |
| 证书自动续期 | ACME 协议 | 在 `CertificateManager` 中增加有效期监控与自动续期逻辑 |
