# 车联网追责与撤销方向：可复现实验清单与参考文献

# Vehicular Network Accountability & Revocation: Reproduction Experiment Checklist

> **范围**: 近五年（2021–2026）车联网（V2X）中证书撤销与行为追责相关的学术论文和会议论文  
> **目标**: 筛选可复现实验的论文，记录实验设置与复现难点，提出改进路径，整理为可执行清单  
> **关联**: 本仓库原型代码位于 `src/vehicular/`，研究路线图详见 [RESEARCH_ROADMAP.md](./RESEARCH_ROADMAP.md)

---

## 目录

1. [文献检索策略](#一文献检索策略)
2. [可复现论文详细记录](#二可复现论文详细记录)
3. [改进方案与复现路径](#三改进方案与复现路径)
4. [可执行复现实验清单](#四可执行复现实验清单)
5. [参考文献列表](#五参考文献列表)

---

## 一、文献检索策略

### 检索关键词

| 类别 | 中文关键词 | 英文关键词 |
|------|-----------|-----------|
| 核心主题 | 车联网、V2X、VANET | vehicular network, V2X, VANET, IoV |
| 撤销方向 | 证书撤销、CRL、撤销列表 | certificate revocation, CRL, revocation list |
| 追责方向 | 追责、追踪、问责 | accountability, traceability, auditing |
| 隐私保护 | 条件隐私、匿名认证 | conditional privacy, anonymous authentication |
| 技术手段 | 区块链、Bloom Filter、群签名 | blockchain, Bloom filter, group signature |
| Agent 协同 | 多Agent、边缘计算、联邦学习 | multi-agent, edge computing, federated learning |

### 检索数据库

- IEEE Xplore（IEEE 期刊与会议）
- ACM Digital Library（ACM 期刊与会议）
- Springer Link（Springer 期刊与会议）
- DBLP（综合计算机科学文献索引）
- Google Scholar（补充检索）

### 筛选标准

| 筛选条件 | 说明 |
|---------|------|
| 时间范围 | 2021 年 1 月 – 2026 年 3 月 |
| 论文类型 | 期刊论文（SCI/EI）、顶级会议论文（GlobeCom、ICC、INFOCOM、CCS、NDSS 等） |
| 可复现性 | 至少满足以下之一：提供开源代码、提供实验数据集、实验描述足够详细可独立复现 |
| 相关性 | 涉及车联网场景下的证书撤销或行为追责机制 |

---

## 二、可复现论文详细记录

### 论文 P1: 基于 Schnorr 的条件隐私保护认证与批量验证

| 项目 | 内容 |
|------|------|
| **标题** | Schnorr-based Conditional Privacy-Preserving Authentication Scheme with Multisignature and Batch Verification in VANET |
| **作者** | Imghoure, A., Omary, F., El-Yahyaoui, A. |
| **出处** | Internet of Things, vol. 23, 100850, 2023 |
| **DOI** | 10.1016/j.iot.2023.100850 |
| **方向** | 条件隐私保护认证 + Bloom Filter 高效撤销 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | Schnorr 签名 + 椭圆曲线（ECC, secp256k1） |
| 撤销机制 | Bloom Filter CRL (m=2^20, k=7) |
| 批量验证 | 支持，batch size: 50–500 |
| 仿真平台 | MIRACL 密码学库 + 自定义仿真 |
| 车辆规模 | 100–10,000 辆 |
| 安全级别 | 128-bit |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 签名时间 | 单次签名 ms | ECDSA, BLS |
| 验签时间 | 单次 + 批量验签 ms | 逐条验证 |
| 撤销查询时间 | Bloom Filter 查询 μs | 线性 CRL 搜索 |
| 通信开销 | 消息大小 bytes | 传统 PKI |
| 批量验证加速比 | batch/sequential | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 论文未开源；可使用 Python `cryptography` 库或 C `MIRACL` 库复现 Schnorr 签名 |
| 数据集 | 无公开数据集；可使用 SUMO 生成车辆轨迹数据 |
| 替代实现 | 本仓库 `src/vehicular/CertificateRevocationManager.ts` 已实现 Bloom Filter CRL 原型 |

#### 复现难点

1. **Schnorr 多签名**: 需正确实现 MuSig 或类似的多签名聚合方案，容易出现 rogue-key attack
2. **批量验证**: 随机线性组合的参数选取影响安全性与效率
3. **Bloom Filter 参数调优**: 假阳性率需要在存储空间与准确率间平衡
4. **缺少开源代码**: 需从论文算法描述独立实现，容易引入实现错误

---

### 论文 P2: 区块链支持的车联网认证密钥协商

| 项目 | 内容 |
|------|------|
| **标题** | Blockchain-Enabled Authenticated Key Agreement Scheme for Mobile Vehicles-Assisted Precision Agricultural IoT Networks |
| **作者** | Vangala, A., Das, A.K., Mitra, A., Das, S.K., Park, Y. |
| **出处** | IEEE Trans. Information Forensics and Security, vol. 18, pp. 904–919, 2023 |
| **DOI** | 10.1109/TIFS.2022.3231121 |
| **方向** | 区块链 + 去中心化撤销 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 区块链平台 | Ethereum (Solidity 智能合约) |
| 共识机制 | PoA (Proof of Authority) 轻量共识 |
| 密码学基础 | ECC + 哈希链 |
| 测试环境 | Ganache / Hardhat 本地测试链 |
| 存储 | IPFS 存储大规模 CRL |
| 安全模型 | Random Oracle Model + BAN Logic |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 计算开销 | 各操作执行时间 ms | ECQV, 传统 PKI |
| 通信开销 | 协议消息总 bytes | 同类方案 |
| 合约 Gas 消耗 | 上链操作 Gas 量 | N/A |
| 撤销延迟 | 从请求到生效 seconds | 集中式 CRL |
| 安全性 | AVISPA 工具形式化验证 | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 论文未公开完整源码；智能合约部分可基于 Solidity 模板复现 |
| 数据集 | 无公开数据集；可使用 Ganache 模拟链上状态 |
| 替代工具 | Python `web3.py` + `brownie` 框架进行合约交互测试 |

#### 复现难点

1. **智能合约设计**: 需要在 Gas 效率与功能完整性之间权衡
2. **IPFS 集成**: 链下存储的一致性与可用性问题
3. **安全性验证**: AVISPA / ProVerif 工具的学习曲线陡峭
4. **性能基线不统一**: 不同论文的测试环境差异较大，直接对比有困难

---

### 论文 P3: 区块链支持的智能交通系统分布式众包感知

| 项目 | 内容 |
|------|------|
| **标题** | Blockchain-Enabled Intelligent Transportation Systems: A Distributed Crowdsensing Framework |
| **作者** | Ning, Z., Sun, S., Wang, X., Guo, L., Guo, S., Hu, X., Hu, B., Kwok, R.Y.-K. |
| **出处** | IEEE Trans. Mobile Computing, vol. 21, no. 12, pp. 4201–4217, 2022 |
| **DOI** | 10.1109/TMC.2021.3079984 |
| **方向** | 区块链 + 众包感知 + 车辆信任管理 |
| **可复现性** | ★★★☆☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 仿真平台 | SUMO (交通仿真) + NS-3 (网络仿真) |
| 区块链模拟 | Hyperledger Fabric |
| 地图数据 | 真实城市路网 (OpenStreetMap) |
| 车辆数量 | 500–5,000 |
| 任务模型 | 众包感知任务分配与激励 |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 任务完成率 | 感知数据覆盖率 % | 集中式分配 |
| 数据质量 | 信任值加权数据准确率 | 无信任管理方案 |
| 区块链吞吐量 | TPS (transactions per second) | PoW 共识 |
| 通信延迟 | 端到端 ms | 无区块链方案 |
| 激励公平性 | Jain's fairness index | 均匀分配 |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未开源；需集成 SUMO + NS-3 + Hyperledger 三个平台 |
| 数据集 | OpenStreetMap 可获取真实路网；VeReMi 数据集可辅助测试 |
| 替代实现 | 可用 Python 仿真简化版代替完整 NS-3 仿真 |

#### 复现难点

1. **多平台集成**: SUMO + NS-3 + Hyperledger 的联合仿真配置复杂
2. **参数标定**: 交通仿真参数（车速分布、密度）需要校准
3. **Hyperledger 部署**: Fabric 网络配置和链码编写有较高门槛
4. **大规模仿真**: 5,000 辆车的仿真需要较大计算资源

---

### 论文 P4: 可证安全的树基认证密钥协商 (V2V/V2I)

| 项目 | 内容 |
|------|------|
| **标题** | Proven Secure Tree-Based Authenticated Key Agreement for Securing V2V and V2I Communications in VANETs |
| **作者** | Wei, L., Cui, J., Zhong, H., Xu, Y., Liu, L. |
| **出处** | IEEE Trans. Mobile Computing, vol. 21, no. 9, pp. 3280–3297, 2022 |
| **DOI** | 10.1109/TMC.2021.3056712 |
| **方向** | 树基密钥协商 + 认证 + 撤销支持 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | 双线性配对 (Bilinear Pairing, Type-A) |
| 密钥树结构 | 二叉树，深度 log(n) |
| 安全模型 | eCK (Extended Canetti-Krawczyk) |
| 实现库 | PBC Library / Charm-Crypto |
| 测试硬件 | Intel i7 + 模拟嵌入式 ARM (Raspberry Pi) |
| 安全级别 | 128-bit (MNT 曲线, embedding degree 6) |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 密钥协商时间 | 协商完成 ms | DH, ECIES |
| 树更新开销 | 节点加入/退出的重密钥时间 | 扁平方案 |
| 通信轮数 | 协议交互轮数 | 2-party DH |
| 存储开销 | 每节点密钥材料 bytes | 全连接密钥 |
| 前向/后向安全 | 安全性分析 | 形式化证明 |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开；可使用 `charm-crypto` (Python) 或 `PBC` (C) 库实现 |
| 数据集 | 无专用数据集；密码学性能测试为计算基准测试 |
| 替代实现 | 本仓库可扩展 `VehicleIdentityManager` 添加密钥协商模块 |

#### 复现难点

1. **双线性配对实现**: PBC 库编译需要 GMP 库，跨平台部署有困难
2. **eCK 安全模型理解**: 安全性证明需要深入理解 eCK 模型
3. **树结构动态维护**: 车辆频繁加入/退出时的树重平衡逻辑复杂
4. **嵌入式性能模拟**: 需要在资源受限环境（如 Raspberry Pi）上测试

---

### 论文 P5: 可证安全的车联网密钥更新协议

| 项目 | 内容 |
|------|------|
| **标题** | A Provably Secure and Efficient Cryptographic-Key Update Protocol for Connected Vehicles |
| **作者** | Baee, M.A.R., Simpson, L., Boyen, X., Foo, E., Pieprzyk, J. |
| **出处** | IEEE Trans. Dependable and Secure Computing, vol. 21, no. 4, pp. 4066–4083, 2024 |
| **DOI** | 10.1109/TDSC.2023.3345406 |
| **方向** | 密钥更新 + 证书撤销联动 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | ECC (NIST P-256) + HMAC |
| 密钥更新 | 前向安全密钥演进 |
| 撤销联动 | 密钥更新失败 → 自动撤销 |
| 安全模型 | UC (Universal Composability) 框架 |
| 测试平台 | OpenSSL + Python 包装器 |
| 场景模拟 | 城市路网 1,000 辆车 |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 密钥更新时间 | 单次更新 ms | 完整重协商 |
| 通信开销 | 更新消息 bytes | 证书重签发 |
| 撤销响应时间 | 异常到撤销 ms | 传统 CRL 发布周期 |
| 前向安全性 | 安全性分析 | 非前向安全方案 |
| 计算效率 | 对称/非对称操作计数 | 纯非对称方案 |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开；核心操作可基于 OpenSSL / Python `cryptography` 库实现 |
| 数据集 | 无专用数据集；密码学性能为计算基准测试 |
| 替代实现 | 可扩展本仓库 `CertificateRevocationManager` 添加密钥更新联动逻辑 |

#### 复现难点

1. **UC 框架理解**: Universal Composability 安全证明需较深理论基础
2. **前向安全密钥演进**: 密钥链的正确维护与状态管理
3. **撤销联动时序**: 密钥更新失败与撤销之间的时序逻辑容易出错
4. **测试环境一致性**: OpenSSL 版本差异可能影响性能测试结果

---

### 论文 P6: 基于联邦学习的 VANET 隐私聚合

| 项目 | 内容 |
|------|------|
| **标题** | Batch-Aggregate: Efficient Aggregation for Private Federated Learning in VANETs |
| **作者** | Feng, X., Liu, H., Yang, H., Xie, Q., Wang, L. |
| **出处** | IEEE Trans. Dependable and Secure Computing, vol. 21, no. 5, pp. 4939–4952, 2024 |
| **DOI** | 10.1109/TDSC.2024.3364371 |
| **方向** | 联邦学习 + Agent 协同信任管理 |
| **可复现性** | ★★★☆☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| ML 框架 | PyTorch / TensorFlow |
| 联邦学习 | FedAvg 变体 + 差分隐私 |
| 聚合策略 | Batch-Aggregate (论文提出) |
| 仿真环境 | SUMO + 自定义 Python 仿真 |
| 数据集 | VeReMi (VANET 不端行为数据) |
| 客户端数量 | 20–100 个车辆节点 |
| 训练轮数 | 100–500 轮 |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 模型精度 | 不端行为检测 F1 score | 集中式训练 |
| 聚合效率 | 单轮聚合时间 ms | FedAvg |
| 隐私保证 | (ε, δ)-差分隐私 | 无隐私方案 |
| 通信开销 | 每轮上传模型参数量 MB | 全参数上传 |
| 收敛速度 | 达到目标精度的轮数 | 标准 FL |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开完整代码 |
| VeReMi 数据集 | https://github.com/VeReMi-dataset/VeReMi — 开源 VANET 不端行为数据集 |
| FL 框架 | 可使用 `Flower` (https://flower.dev) 或 `PySyft` 作为联邦学习基础框架 |
| 替代实现 | 本仓库 `AgentCollaborativeTrust` 可扩展为 FL-based 信任评估 |

#### 复现难点

1. **Batch-Aggregate 算法**: 论文核心贡献的聚合算法细节需仔细理解
2. **差分隐私参数调优**: (ε, δ) 参数选择直接影响隐私-效用权衡
3. **非 IID 数据处理**: 车辆节点的数据异质性需要特殊处理
4. **仿真规模**: 100 客户端 × 500 轮训练的计算开销较大

---

### 论文 P7: VANETs 中消息可链接群签名与高效撤销

| 项目 | 内容 |
|------|------|
| **标题** | Message Linkable Group Signature With Information Binding and Efficient Revocation for Privacy-Preserving Announcement in VANETs |
| **作者** | Zhang, L., Li, J., Yang, Y. |
| **出处** | IEEE Trans. Dependable and Secure Computing, vol. 21, no. 5, pp. 5667–5680, 2024 |
| **DOI** | 10.1109/TDSC.2024.3381436 |
| **方向** | 群签名 + 可链接性 + 条件追责 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | BBS+ 群签名 + 双线性配对 |
| 可链接性 | 消息级可链接（同一消息可关联） |
| 撤销机制 | Verifier-Local Revocation (VLR) |
| 实现库 | Charm-Crypto / RELIC |
| 群大小 | 100–10,000 成员 |
| 安全级别 | 128-bit (BN254 曲线) |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 签名时间 | 群签名生成 ms | 标准 ECDSA |
| 验签时间 | 群签名验证 ms | BBS+, CL 签名 |
| 撤销检查 | VLR 验证 ms (vs 群大小) | 全 CRL 检查 |
| 打开时间 | Group Manager 身份恢复 ms | N/A |
| 签名大小 | 签名长度 bytes | 标准群签名 |
| 可链接性验证 | 链接判定时间 ms | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开；需基于 `charm-crypto` 或 `RELIC` 库实现 BBS+ 群签名 |
| 数据集 | 无专用数据集；密码学性能基准测试 |
| 参考实现 | RELIC 库 (https://github.com/relic-toolkit/relic) 提供了双线性配对原语 |

#### 复现难点

1. **BBS+ 签名方案**: 较复杂的配对密码学实现，需要理解 Type-3 配对
2. **VLR 撤销效率**: 撤销检查与群大小线性相关，大群时性能瓶颈
3. **可链接性与隐私权衡**: 需确保可链接性不泄露额外身份信息
4. **Charm-Crypto 依赖**: 该库对 Python 3.9+ 的支持不稳定

---

### 论文 P8: VANETs 中基于身份的广播代理重加密

| 项目 | 内容 |
|------|------|
| **标题** | Identity-Based Broadcast Proxy Re-Encryption for Flexible Data Sharing in VANETs |
| **作者** | Zhang, J., Su, S., Zhong, H., Cui, J., He, D. |
| **出处** | IEEE Trans. Information Forensics and Security, vol. 18, pp. 4830–4842, 2023 |
| **DOI** | 10.1109/TIFS.2023.3299466 |
| **方向** | 基于身份的代理重加密 + 追责 |
| **可复现性** | ★★★☆☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | 基于身份加密 (IBE) + 代理重加密 (PRE) |
| 配对类型 | Type-A 配对 (对称) |
| 广播加密 | 支持子集广播 |
| KGC | 可信密钥生成中心 |
| 安全模型 | CPA/CCA 安全在标准模型 |
| 实现库 | PBC Library |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 加密时间 | 单次加密 ms | 标准 IBE |
| 重加密时间 | 代理重加密 ms | 直接加密 |
| 解密时间 | 单次解密 ms | 标准 IBE |
| 密文大小 | 密文长度 bytes | 传统 BE |
| 重加密密钥大小 | 密钥长度 bytes | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开；需基于 PBC / Charm-Crypto 实现 |
| 数据集 | 无专用数据集 |
| 替代实现 | 可使用 `charm-crypto` ABE 模块作为基础扩展 |

#### 复现难点

1. **代理重加密模型**: PRE 的安全性定义和实现较为复杂
2. **广播加密扩展**: 将 PRE 与广播加密结合的方案理解门槛高
3. **KGC 信任假设**: 需要考虑 KGC 被攻破的安全影响
4. **PBC 库维护**: PBC 库更新不活跃，可能存在兼容性问题

---

### 论文 P9: 5G 车联网边缘计算安全视频上报

| 项目 | 内容 |
|------|------|
| **标题** | Secure Edge Computing-Assisted Video Reporting Service in 5G-Enabled Vehicular Networks |
| **作者** | Zhong, H., Wang, L., Cui, J., Zhang, J., Bolodurina, I. |
| **出处** | IEEE Trans. Information Forensics and Security, vol. 18, pp. 3774–3786, 2023 |
| **DOI** | 10.1109/TIFS.2023.3287731 |
| **方向** | 边缘计算 + 安全上报 + 追责 |
| **可复现性** | ★★★☆☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 网络架构 | 5G + MEC (Multi-access Edge Computing) |
| 安全机制 | 认证 + 加密 + 签名 |
| 视频处理 | 边缘节点预处理 |
| 仿真环境 | NS-3 + 自定义 MEC 仿真 |
| 5G 模型 | NR-V2X |
| 车辆规模 | 200–2,000 |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 端到端延迟 | 视频从采集到上报 ms | 无 MEC |
| 安全开销 | 认证/加密额外时间 ms | 无安全方案 |
| 吞吐量 | 并发视频流数 | 集中式处理 |
| 边缘节点负载 | CPU/内存利用率 % | N/A |
| 安全性 | 形式化验证 | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开 |
| 数据集 | 无公开数据集；可使用合成视频流数据 |
| NS-3 模块 | https://www.nsnam.org — NS-3 仿真器 |

#### 复现难点

1. **5G NR-V2X 仿真**: NS-3 的 5G NR 模块尚在开发中，配置复杂
2. **MEC 平台模拟**: 缺少标准化的 MEC 仿真工具
3. **视频流处理**: 真实视频处理与安全协议的集成需要额外工程量
4. **性能评估环境**: 5G 网络参数对结果影响大，需要仔细标定

---

### 论文 P10: 安全感知的协作感知消息验证

| 项目 | 内容 |
|------|------|
| **标题** | Security-Minded Verification of Cooperative Awareness Messages |
| **作者** | Farrell, M., Bradbury, M., Cardoso, R.C., Fisher, M., Dennis, L.A., Dixon, C., Sheik, A.T., Yuan, H., Maple, C. |
| **出处** | IEEE Trans. Dependable and Secure Computing, vol. 21, no. 4, pp. 4048–4065, 2024 |
| **DOI** | 10.1109/TDSC.2023.3345543 |
| **方向** | 协作感知消息 (CAM) 安全验证 + 不端行为检测 |
| **可复现性** | ★★★★☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 标准 | ETSI ITS / IEEE 1609 (CAM/BSM) |
| 验证方法 | 形式化验证 (Model Checking) |
| 工具 | MCAPL (Model Checking Agent Programming Languages) |
| 仿真 | Veins (OMNeT++ + SUMO) |
| 攻击模型 | Position spoofing, Sybil attack, replay attack |
| 车辆规模 | 50–500 |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 检测率 | True Positive Rate % | 无验证 |
| 误报率 | False Positive Rate % | 阈值检测 |
| 验证时间 | 单条 CAM 验证 ms | 无安全检查 |
| 形式化覆盖 | 验证的属性数量 | 手动测试 |
| 内存开销 | 状态空间大小 | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| MCAPL 框架 | https://github.com/mcapl/mcapl — 开源 Agent 编程语言模型检验框架 |
| VeReMi 数据集 | https://github.com/VeReMi-dataset/VeReMi — 可用于测试不端行为检测 |
| Veins 仿真 | https://veins.car2x.org — 开源 V2X 仿真框架 |

#### 复现难点

1. **MCAPL 工具链**: Agent 编程语言的模型检验工具学习成本较高
2. **形式化属性定义**: 需要精确定义待验证的安全属性
3. **Veins 集成**: OMNeT++ + SUMO + Veins 的安装配置较复杂
4. **状态爆炸**: 大规模场景的形式化验证面临状态空间爆炸问题

---

### 论文 P11: VeReMi Extension 不端行为检测数据集

| 项目 | 内容 |
|------|------|
| **标题** | VeReMi Extension: A Dataset for Comparable Evaluation of Misbehavior Detection in VANETs |
| **作者** | Kamel, J., Wolf, M., van der Heijden, R., Kaiser, A., Urien, P., Kargl, F. |
| **出处** | ICC 2020 – IEEE International Conference on Communications, pp. 1–6, 2020 (扩展版持续更新至 2023) |
| **DOI** | 10.1109/ICC40277.2020.9149132 |
| **方向** | 不端行为检测基准数据集 + 评测框架 |
| **可复现性** | ★★★★★ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 仿真平台 | Veins (OMNeT++ + SUMO) |
| 场景 | Luxembourg SUMO Traffic (LuST) |
| 攻击类型 | 5 类：Constant, ConstantOffset, Random, RandomOffset, EventualStop |
| 正常车辆 | ~1,200 辆 |
| 攻击车辆 | 0–30% 攻击比例 |
| 消息类型 | BSM (Basic Safety Message) |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 检测精度 | Precision, Recall, F1 | 多种检测器对比 |
| 检测延迟 | 从攻击开始到检测 s | N/A |
| 攻击类型区分 | 分类准确率 % | N/A |
| 可扩展性 | 不同攻击比例下的性能 | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 完整数据集 | https://github.com/VeReMi-dataset/VeReMi — 开源数据集 |
| 扩展版数据 | https://github.com/VeReMi-dataset/VeReMi-Extension |
| 检测器基线 | 数据集仓库内含多种基线检测器实现 |
| 仿真配置 | Veins + SUMO 配置文件包含在仓库中 |

#### 复现难点

1. **数据规模**: 完整数据集较大（数 GB），下载和处理需要时间
2. **Veins 环境**: 需要 OMNeT++ + SUMO + Veins 完整工具链
3. **版本兼容**: SUMO 和 OMNeT++ 版本更新可能导致兼容性问题
4. **GPU 需求**: 使用 ML 检测器时需要 GPU 加速

---

### 论文 P12: 车辆网络匿名支付与可更新凭证

| 项目 | 内容 |
|------|------|
| **标题** | AnoPay: Anonymous Payment for Vehicle Parking With Updatable Credential |
| **作者** | Yang, Y., Xue, W., Zhan, Y., Huang, M., Li, Y., Deng, R.H. |
| **出处** | IEEE Trans. Dependable and Secure Computing, vol. 21, no. 3, pp. 1621–1638, 2024 |
| **DOI** | 10.1109/TDSC.2023.3287228 |
| **方向** | 匿名凭证 + 可更新 + 追责 |
| **可复现性** | ★★★☆☆ |

#### 实验设置

| 参数 | 值 |
|------|-----|
| 密码学基础 | 匿名凭证 (Anonymous Credentials) + BBS+ |
| 可更新性 | 凭证可在不暴露身份的情况下更新 |
| 支付模型 | 匿名停车支付 |
| 追责机制 | 可信第三方可在争议时揭示身份 |
| 安全模型 | Game-based security |
| 实现 | Charm-Crypto |

#### 性能指标

| 指标 | 测量方法 | 基线对比 |
|------|---------|---------|
| 凭证签发时间 | ms | 标准签名 |
| 凭证验证时间 | ms | BBS+ 标准验证 |
| 凭证更新时间 | ms | 重签发 |
| 凭证大小 | bytes | 标准证书 |
| 追责（身份揭示）时间 | ms | N/A |

#### 代码与数据

| 资源 | 链接/说明 |
|------|----------|
| 原始代码 | 未公开 |
| 替代框架 | `charm-crypto` 提供了 BBS+ 基础实现 |
| Hyperledger Ursa | https://github.com/hyperledger/ursa — 可作为匿名凭证实现参考 |

#### 复现难点

1. **匿名凭证系统**: 可更新匿名凭证的设计和实现较为复杂
2. **BBS+ 扩展**: 在标准 BBS+ 上增加可更新性需要额外协议设计
3. **支付集成**: 与实际支付系统的集成需要额外工程工作
4. **形式化安全证明**: Game-based 安全证明的验证需要较深密码学背景

---

## 三、改进方案与复现路径

### 3.1 各论文改进方案总结

| 论文 | 原始方案局限 | EATI 结合的改进方向 | 改进优先级 |
|------|------------|-------------------|-----------|
| P1 (Schnorr CPPA) | 单一 TA 撤销决策，单点故障 | Agent 协同撤销投票替代单 TA + EATI 设备指纹二级绑定 | ★★★★★ |
| P2 (区块链认证) | 区块链共识延迟高 | 轻量 Agent 协同代替全链共识 + EATI 审计链增强透明性 | ★★★★☆ |
| P3 (分布式众包) | 多平台集成复杂 | 简化为 Agent 通信框架 + EATI 信任基础设施 | ★★★☆☆ |
| P4 (树基密钥协商) | 树维护开销大 | Agent 管理密钥树分片 + EATI 身份绑定加速认证 | ★★★★☆ |
| P5 (密钥更新) | 撤销联动机制不透明 | EATI 证据链记录更新/撤销全过程 + Agent 监控异常 | ★★★★★ |
| P6 (联邦学习) | 收敛速度慢 | Agent 优先级调度聚合 + EATI 身份可信度加权 | ★★★☆☆ |
| P7 (群签名撤销) | VLR 与群大小线性相关 | Bloom Filter 加速撤销检查 + Agent 分布式 VLR | ★★★★★ |
| P8 (代理重加密) | KGC 单点信任问题 | 多 Agent 分布式密钥生成 + EATI 审计链记录密钥操作 | ★★★☆☆ |
| P9 (边缘安全上报) | MEC 缺乏标准化 | EATI Agent 框架标准化 MEC 安全模块 | ★★★☆☆ |
| P10 (CAM 验证) | 形式化验证状态爆炸 | Agent 分层验证 + EATI 信任简化状态空间 | ★★★★☆ |
| P11 (VeReMi) | 数据集攻击类型有限 | 添加 Agent 协同攻击场景 + 追责场景数据 | ★★★★☆ |
| P12 (AnoPay) | 凭证系统复杂 | EATI 简化身份管理 + Agent 自动化凭证更新 | ★★★☆☆ |

### 3.2 可行复现改进路径

#### 路径 A: Bloom Filter 撤销 + Agent 协同（推荐首选）

**对应论文**: P1 + P7  
**改进核心**: 将 Bloom Filter CRL 与多 Agent 协同撤销投票结合  
**可行性**: ★★★★★  
**理由**: 本仓库已有 `CertificateRevocationManager`（Bloom Filter）和 `AgentCollaborativeTrust`（投票机制）原型

```
复现步骤:
1. 基于 P1 实现 Schnorr/ECDSA 签名验签基准测试
2. 基于 P7 实现 BBS+ 群签名（使用 charm-crypto）
3. 集成本仓库 Bloom Filter CRL 替代线性 CRL
4. 集成本仓库 Agent 协同投票替代单 TA 决策
5. 性能对比: 签名时间 / 撤销查询时间 / 协同决策延迟
```

#### 路径 B: 密钥更新 + 追责证据链

**对应论文**: P5 + P4  
**改进核心**: 将前向安全密钥更新与 Merkle Tree 追责证据链结合  
**可行性**: ★★★★☆  
**理由**: 本仓库已有 `AccountabilityTracer`（Merkle Tree）原型

```
复现步骤:
1. 基于 P5 实现 ECC 密钥更新协议
2. 基于 P4 实现树基密钥协商
3. 集成本仓库 Merkle Tree 追责模块记录全部密钥操作
4. 实现密钥更新失败 → Agent 检测 → 撤销 → 追责的完整流程
5. 性能对比: 密钥更新时间 / 追责查询时间 / 证据链验证时间
```

#### 路径 C: 联邦学习 + 不端行为检测

**对应论文**: P6 + P11 + P10  
**改进核心**: 使用 VeReMi 数据集 + 联邦学习框架 + Agent 信任加权  
**可行性**: ★★★☆☆  
**理由**: 需要额外的 ML 框架和较大计算资源

```
复现步骤:
1. 下载 VeReMi Extension 数据集
2. 基于 P6 实现 Batch-Aggregate 联邦学习
3. 基于 P10 集成 CAM 安全验证逻辑
4. 使用本仓库 Agent 信任模块进行加权聚合
5. 性能对比: 检测 F1 / 聚合效率 / 收敛速度
```

---

## 四、可执行复现实验清单

### 清单说明

以下清单按优先级排序，每个实验项包含前置条件、步骤和预期产出。

### 实验 E1: Bloom Filter CRL 基准测试

- [ ] **前置条件**: Node.js 18+, 本仓库代码
- [ ] **步骤 1**: 运行 `npx jest tests/vehicular/CertificateRevocationManager.test.ts` 验证现有 Bloom Filter 实现
- [ ] **步骤 2**: 扩展测试，添加大规模性能基准（1K / 10K / 100K 证书）
- [ ] **步骤 3**: 测量 Bloom Filter 查询时间 vs 线性 CRL 搜索时间
- [ ] **步骤 4**: 测量不同参数 (m, k) 下的假阳性率
- [ ] **预期产出**: 性能对比表，证明 O(1) 查询优势

### 实验 E2: Agent 协同撤销投票测试

- [ ] **前置条件**: 实验 E1 完成
- [ ] **步骤 1**: 运行 `npx jest tests/vehicular/AgentCollaborativeTrust.test.ts` 验证现有投票机制
- [ ] **步骤 2**: 扩展测试，模拟 5/10/20 个 RSU Agent 的投票场景
- [ ] **步骤 3**: 测量不同阈值 (t-of-n) 下的决策延迟
- [ ] **步骤 4**: 模拟恶意 Agent 场景（Byzantine fault tolerance 测试）
- [ ] **预期产出**: 协同决策延迟对比，Byzantine 容错能力分析

### 实验 E3: Merkle Tree 追责证据链测试

- [ ] **前置条件**: 实验 E1, E2 完成
- [ ] **步骤 1**: 运行 `npx jest tests/vehicular/AccountabilityTracer.test.ts` 验证现有 Merkle Tree 实现
- [ ] **步骤 2**: 扩展测试，添加大规模证据链（1K / 10K 条证据）
- [ ] **步骤 3**: 测量 Merkle Proof 生成与验证时间
- [ ] **步骤 4**: 测试完整流程：恶意行为 → Agent 检测 → 投票撤销 → 证据记录 → 审计报告
- [ ] **预期产出**: 端到端追责流程演示，性能指标

### 实验 E4: ECC 签名验签性能基准

- [ ] **前置条件**: Python 3.9+ 或 Node.js 18+, `cryptography` 库
- [ ] **步骤 1**: 实现 ECDSA (secp256k1) 签名/验签
- [ ] **步骤 2**: 实现批量验证（Batch Verification）
- [ ] **步骤 3**: 对比不同曲线（P-256, secp256k1, BN254）的性能
- [ ] **步骤 4**: 与论文 P1, P5 的报告数据进行对比
- [ ] **预期产出**: 签名/验签时间对比表，批量验证加速比

### 实验 E5: BBS+ 群签名原型实现

- [ ] **前置条件**: Python 3.8+, `charm-crypto` 或 `py_ecc` 库
- [ ] **步骤 1**: 实现 BBS+ 群签名的签名/验签
- [ ] **步骤 2**: 实现 Verifier-Local Revocation (VLR)
- [ ] **步骤 3**: 集成 Bloom Filter 加速撤销检查
- [ ] **步骤 4**: 与论文 P7 的报告数据进行对比
- [ ] **预期产出**: 群签名性能对比，Bloom Filter 加速效果

### 实验 E6: 密钥更新与撤销联动

- [ ] **前置条件**: 实验 E4 完成
- [ ] **步骤 1**: 基于 P5 实现前向安全密钥更新协议
- [ ] **步骤 2**: 实现密钥更新失败的自动撤销逻辑
- [ ] **步骤 3**: 集成 Merkle Tree 记录密钥更新历史
- [ ] **步骤 4**: 测试完整密钥生命周期：生成 → 更新 → 异常 → 撤销 → 追责
- [ ] **预期产出**: 密钥更新-撤销联动演示，时序分析

### 实验 E7: 区块链撤销原型

- [ ] **前置条件**: Node.js 18+, Hardhat/Ganache, Solidity
- [ ] **步骤 1**: 编写证书撤销智能合约（基于 P2）
- [ ] **步骤 2**: 在 Hardhat 本地网络部署和测试
- [ ] **步骤 3**: 集成 Agent 协同投票作为撤销触发条件
- [ ] **步骤 4**: 测量合约 Gas 消耗和撤销延迟
- [ ] **预期产出**: 智能合约代码，Gas 消耗分析

### 实验 E8: VeReMi 数据集不端行为检测

- [ ] **前置条件**: Python 3.9+, PyTorch, VeReMi 数据集
- [ ] **步骤 1**: 下载 VeReMi Extension 数据集
- [ ] **步骤 2**: 实现基线检测器（阈值检测、SVM、MLP）
- [ ] **步骤 3**: 实现联邦学习版本检测器（基于 P6）
- [ ] **步骤 4**: 集成 Agent 信任加权聚合
- [ ] **预期产出**: 检测器性能对比（F1, Precision, Recall），联邦学习收敛曲线

### 实验 E9: 端到端集成测试

- [ ] **前置条件**: 实验 E1–E3 完成
- [ ] **步骤 1**: 设计完整场景：车辆注册 → 正常通信 → 恶意行为 → Agent 检测 → 协同撤销 → 追责
- [ ] **步骤 2**: 使用本仓库全部 4 个模块（VehicleIdentityManager, CertificateRevocationManager, AgentCollaborativeTrust, AccountabilityTracer）
- [ ] **步骤 3**: 测量端到端延迟和各阶段耗时
- [ ] **步骤 4**: 生成完整审计报告
- [ ] **预期产出**: 端到端演示，完整性能报告，可用于论文实验部分

---

## 五、参考文献列表

### 核心参考文献（按论文编号排序）

**[P1]** Imghoure, A., Omary, F., and El-Yahyaoui, A. "Schnorr-based conditional privacy-preserving authentication scheme with multisignature and batch verification in VANET." *Internet of Things*, vol. 23, 100850, 2023. DOI: [10.1016/j.iot.2023.100850](https://doi.org/10.1016/j.iot.2023.100850)

**[P2]** Vangala, A., Das, A.K., Mitra, A., Das, S.K., and Park, Y. "Blockchain-Enabled Authenticated Key Agreement Scheme for Mobile Vehicles-Assisted Precision Agricultural IoT Networks." *IEEE Trans. Information Forensics and Security*, vol. 18, pp. 904–919, 2023. DOI: [10.1109/TIFS.2022.3231121](https://doi.org/10.1109/TIFS.2022.3231121)

**[P3]** Ning, Z., Sun, S., Wang, X., Guo, L., Guo, S., Hu, X., Hu, B., and Kwok, R.Y.-K. "Blockchain-Enabled Intelligent Transportation Systems: A Distributed Crowdsensing Framework." *IEEE Trans. Mobile Computing*, vol. 21, no. 12, pp. 4201–4217, 2022. DOI: [10.1109/TMC.2021.3079984](https://doi.org/10.1109/TMC.2021.3079984)

**[P4]** Wei, L., Cui, J., Zhong, H., Xu, Y., and Liu, L. "Proven Secure Tree-Based Authenticated Key Agreement for Securing V2V and V2I Communications in VANETs." *IEEE Trans. Mobile Computing*, vol. 21, no. 9, pp. 3280–3297, 2022. DOI: [10.1109/TMC.2021.3056712](https://doi.org/10.1109/TMC.2021.3056712)

**[P5]** Baee, M.A.R., Simpson, L., Boyen, X., Foo, E., and Pieprzyk, J. "A Provably Secure and Efficient Cryptographic-Key Update Protocol for Connected Vehicles." *IEEE Trans. Dependable and Secure Computing*, vol. 21, no. 4, pp. 4066–4083, 2024. DOI: [10.1109/TDSC.2023.3345406](https://doi.org/10.1109/TDSC.2023.3345406)

**[P6]** Feng, X., Liu, H., Yang, H., Xie, Q., and Wang, L. "Batch-Aggregate: Efficient Aggregation for Private Federated Learning in VANETs." *IEEE Trans. Dependable and Secure Computing*, vol. 21, no. 5, pp. 4939–4952, 2024. DOI: [10.1109/TDSC.2024.3364371](https://doi.org/10.1109/TDSC.2024.3364371)

**[P7]** Zhang, L., Li, J., and Yang, Y. "Message Linkable Group Signature With Information Binding and Efficient Revocation for Privacy-Preserving Announcement in VANETs." *IEEE Trans. Dependable and Secure Computing*, vol. 21, no. 5, pp. 5667–5680, 2024. DOI: [10.1109/TDSC.2024.3381436](https://doi.org/10.1109/TDSC.2024.3381436)

**[P8]** Zhang, J., Su, S., Zhong, H., Cui, J., and He, D. "Identity-Based Broadcast Proxy Re-Encryption for Flexible Data Sharing in VANETs." *IEEE Trans. Information Forensics and Security*, vol. 18, pp. 4830–4842, 2023. DOI: [10.1109/TIFS.2023.3299466](https://doi.org/10.1109/TIFS.2023.3299466)

**[P9]** Zhong, H., Wang, L., Cui, J., Zhang, J., and Bolodurina, I. "Secure Edge Computing-Assisted Video Reporting Service in 5G-Enabled Vehicular Networks." *IEEE Trans. Information Forensics and Security*, vol. 18, pp. 3774–3786, 2023. DOI: [10.1109/TIFS.2023.3287731](https://doi.org/10.1109/TIFS.2023.3287731)

**[P10]** Farrell, M., Bradbury, M., Cardoso, R.C., Fisher, M., Dennis, L.A., Dixon, C., Sheik, A.T., Yuan, H., and Maple, C. "Security-Minded Verification of Cooperative Awareness Messages." *IEEE Trans. Dependable and Secure Computing*, vol. 21, no. 4, pp. 4048–4065, 2024. DOI: [10.1109/TDSC.2023.3345543](https://doi.org/10.1109/TDSC.2023.3345543)

**[P11]** Kamel, J., Wolf, M., van der Heijden, R., Kaiser, A., Urien, P., and Kargl, F. "VeReMi Extension: A Dataset for Comparable Evaluation of Misbehavior Detection in VANETs." *ICC 2020 – IEEE International Conference on Communications*, pp. 1–6, 2020. DOI: [10.1109/ICC40277.2020.9149132](https://doi.org/10.1109/ICC40277.2020.9149132)

**[P12]** Yang, Y., Xue, W., Zhan, Y., Huang, M., Li, Y., and Deng, R.H. "AnoPay: Anonymous Payment for Vehicle Parking With Updatable Credential." *IEEE Trans. Dependable and Secure Computing*, vol. 21, no. 3, pp. 1621–1638, 2024. DOI: [10.1109/TDSC.2023.3287228](https://doi.org/10.1109/TDSC.2023.3287228)

### 补充参考文献

**[S1]** Saputra, Y.M., Nguyen, D.N., Hoang, D.T., Vu, T.X., Dutkiewicz, E., and Chatzinotas, S. "Federated Learning Meets Contract Theory: Economic-Efficiency Framework for Electric Vehicle Networks." *IEEE Trans. Mobile Computing*, vol. 21, no. 8, pp. 2803–2817, 2022. DOI: [10.1109/TMC.2020.3045987](https://doi.org/10.1109/TMC.2020.3045987)

**[S2]** Ali, M., Kaddoum, G., Li, W.-T., Yuen, C., Tariq, M., and Poor, H.V. "A Smart Digital Twin Enabled Security Framework for Vehicle-to-Grid Cyber-Physical Systems." *IEEE Trans. Information Forensics and Security*, vol. 18, pp. 5258–5271, 2023. DOI: [10.1109/TIFS.2023.3305916](https://doi.org/10.1109/TIFS.2023.3305916)

**[S3]** Yin, Z., Cheng, N., Luan, T.H., Song, Y., and Wang, W. "DT-Assisted Multi-Point Symbiotic Security in Space-Air-Ground Integrated Networks." *IEEE Trans. Information Forensics and Security*, vol. 18, pp. 5721–5734, 2023. DOI: [10.1109/TIFS.2023.3313326](https://doi.org/10.1109/TIFS.2023.3313326)

### 开源工具与数据集参考

| 工具/数据集 | 链接 | 用途 |
|------------|------|------|
| VeReMi 数据集 | https://github.com/VeReMi-dataset/VeReMi | 不端行为检测基准数据 |
| VeReMi Extension | https://github.com/VeReMi-dataset/VeReMi-Extension | 扩展攻击类型数据 |
| MCAPL 框架 | https://github.com/mcapl/mcapl | Agent 模型检验 |
| RELIC 密码学库 | https://github.com/relic-toolkit/relic | 双线性配对原语 |
| Veins 仿真器 | https://veins.car2x.org | V2X 网络仿真 |
| SUMO 交通仿真 | https://www.eclipse.org/sumo | 车辆交通仿真 |
| NS-3 网络仿真 | https://www.nsnam.org | 网络协议仿真 |
| Charm-Crypto | https://github.com/JHUISI/charm | Python 密码学库 |
| Flower (FL) | https://flower.dev | 联邦学习框架 |
| Hardhat | https://hardhat.org | Ethereum 开发环境 |
| 本仓库原型 | `src/vehicular/` | EATI 车联网原型代码 |

---

## 附录：复现优先级排序

| 优先级 | 实验 | 所需时间 | 依赖 | 论文产出价值 |
|--------|------|---------|------|------------|
| 🔴 P0 | E1 (Bloom Filter 基准) | 1 天 | 无 | 基础数据 |
| 🔴 P0 | E2 (Agent 协同投票) | 1 天 | 无 | 基础数据 |
| 🔴 P0 | E3 (Merkle Tree 追责) | 1 天 | 无 | 基础数据 |
| 🟡 P1 | E4 (ECC 签名基准) | 2 天 | 无 | 性能对比 |
| 🟡 P1 | E9 (端到端集成) | 2 天 | E1–E3 | 完整演示 |
| 🟢 P2 | E5 (BBS+ 群签名) | 3–5 天 | E4 | 核心创新 |
| 🟢 P2 | E6 (密钥更新联动) | 3–5 天 | E4, E3 | 核心创新 |
| 🔵 P3 | E7 (区块链撤销) | 5–7 天 | E1, E2 | 扩展方案 |
| 🔵 P3 | E8 (VeReMi ML 检测) | 5–7 天 | VeReMi 数据 | 扩展方案 |
