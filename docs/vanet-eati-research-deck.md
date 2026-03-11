# EATI 思路迁移到 VANET/IoV 的调研与 PPT 提纲

## 1. 结论先行
- **可以移植，但不建议“原样移植”**：更适合改造成“**VPKI + 边缘分发 + 条件追责 + 轻量可信日志**”的车联网版本。
- **实时撤销**的关键不在把更多密码学堆到 OBU，而在于：
  - 把**高频校验**做成 OBU 可承受的摘要/增量检查；
  - 把**重计算、全量列表、跨域同步**尽量放到 **RSU / MEC / 后台 PKI**；
  - 用**短期伪名证书 + 增量/分区撤销信息**控制通信与存储开销。
- **事后追责**建议采用“**默认匿名、依法/依规双授权解匿**”路线：日常消息仅暴露伪名；只有在事故、执法或仲裁场景下，才由分权机构完成身份还原。

## 2. 本次采用的真实资料（可在 PPT 末尾引用）
1. **BSI TR-03164 Part 1 (2021)**：Guidance for C-ITS, PKI operation；明确 EU CCMS、EC/AT、CRL/CTL、审计与运维要求。
2. **BSI TR-03164 Part 2 (2021)**：C-ITS stations special requirements；明确 pseudonymisation、stations/subscribers revocation、secure elements。
3. **Vanetza Security README**：开源 ETSI C-ITS 安全实现现状；已实现消息安全与证书校验，但将 revocation checks / enrolment / ticket request 列为未完成或复杂能力。
4. **Tim Weil, “VPKI Hits the Highway” (2017)**：US DOT Connected Vehicle Pilot Program 的公开介绍，展示 SCMS/VPKI 已进入真实试点。
5. **Tesei et al., “A Transparent Distributed Ledger-based Certificate Revocation Scheme for VANETs” (2020)**：指出工业标准对“及时撤销”覆盖不足，并提出透明账本式撤销分发思路。
6. **Muhammad & Safdar, “5G-based V2V broadcast communications: A security perspective” (2021)**：说明 5G-V2V 仍需上层 ITS 安全机制保障真实性、完整性与可追责，同时不能显著增加时延。
7. **Singh et al., “Blockchain Meets AI for Resilient and Intelligent Internet of Vehicles” (2021)**：AI 可做 misbehavior detection，区块链可增强 trust/availability，但更适合作为辅助层，而非逐包共识面。

## 3. 研究进展综述
### 3.1 已比较成熟 / 接近工程落地
- **伪名证书体系（EC + AT / pseudonym certificates）**：已在美欧标准与试点中形成共识。
- **分权 PKI 角色设计**：Enrollment / Authorization / Root / Misbehavior 角色分离已成为主流架构，用于平衡隐私与监管。
- **消息签名与证书校验**：已有标准和开源实现（如 Vanetza）。

### 3.2 仍在工程化攻坚
- **大规模、低开销、低时延的撤销分发**：尤其是 OBU 侧如何不拉全量 CRL、又能及时判断证书是否已撤销。
- **误报/恶意举报后的处置闭环**：从 misbehavior detection 到 authoritative revocation 的衔接仍复杂。
- **跨域追责与隐私保护边界**：如何做到“平时看不到、出事查得到、且有程序正义”。

### 3.3 学术界活跃方向
- 压缩/增量 CRL、区域化/时间片化撤销分发。
- Bloom Filter / 摘要型撤销索引。
- RSU/MEC 边缘协助校验。
- 区块链/透明日志用于 revocation transparency 和证据留存。
- AI/ML 做 misbehavior detection，但最终撤销仍要回到可审计的权威流程。

## 4. 对你的目标的可行性判断
### 目标 A：弱硬件场景下，大规模车辆的实时撤销，降低 OBU 通信开销
**可行，但前提是把系统切成三层：**
1. **车端（OBU）只做轻量判断**
   - 本地缓存当前活跃伪名证书与最近的增量撤销摘要；
   - 优先做“证书是否过期 / 是否命中摘要 / 是否需要向 RSU 请求详情”的三级判断；
   - 避免让 OBU 周期性拉取全量 CRL。
2. **路侧/边缘（RSU/MEC）做重任务**
   - 下发**区域化 / 时间片化 / 车型或车队分组**的撤销增量；
   - 提供全量查询、证明材料、热更新分发。
3. **后台 PKI / 监管侧做最终裁决**
   - 统一生成撤销事件；
   - 输出可验证的撤销版本链；
   - 负责全网同步与审计。

### 目标 B：恶意车辆的事后追责，平衡隐私与监管
**可行，并且与现有 VPKI/SCMS 思路天然契合。**
- 日常广播用**短期伪名证书**，外部观察者无法直接还原真实身份；
- 身份映射由**分权机构**持有，不由单一平台独占；
- 当满足事故调查、司法或监管流程时，才触发**双授权解匿**；
- 证据不建议全上链，而是“**车端签名日志 + 关键摘要上链/入透明日志**”。

## 5. 建议采用的“EATI → VANET”架构映射
| EATI 原思路 | VANET/IoV 对应形态 | 迁移建议 |
|---|---|---|
| EAID / 人-机-证绑定 | 车辆/设备长期注册身份（Enrollment Credential） | 绑定 OEM / T-Box / Secure Element，而不是驾驶人长期裸露身份 |
| X.509 + 可验证身份 | EC + Authorization Ticket / pseudonym certificate | 保留 X.509/PKI 主线，必要时再叠加 VC 给车队/政企场景 |
| 可信执行（TEE） | 车端 Secure Element / HSM；边缘侧 TEE 可选 | 对 OBU 不强推 TEE，优先 Secure Element；TEE 先落在 RSU/MEC |
| 黑匣子 + 透明日志 | T-Box 审计日志 + revocation transparency log | 只记录摘要/索引，避免把敏感轨迹直接公开 |
| 监管追溯 | Misbehavior Authority + 双授权解匿 | 组织上做 separation of duty，防止平台单点滥权 |

## 6. 推荐的实现路线
### Phase 0：先做可验证 PoC（1~2 个月）
- 选定协议基线：**IEEE 1609.2 / ETSI TS 102 941 + 103 097**。
- 用 OBU 模拟器 + RSU 模拟器跑通：
  - 伪名证书签发；
  - 增量撤销列表分发；
  - 车端轻量判断与边缘补查；
  - 事后解匿流程。
- 输出 KPI：
  - 单车日均撤销同步流量；
  - 车端内存占用；
  - 撤销生效时延；
  - 误拒绝率 / 漏拒绝率。

### Phase 1：再做“边缘友好型撤销”
- CRL 改成**区域 + 时间 + 证书批次**三维切片；
- OBU 仅保留当前区域/时间窗的撤销摘要；
- RSU 定期广播增量版本号，车辆按需拉取差分；
- 对离线场景保留“短期证书自然失效”兜底。

### Phase 2：做“可监管但不裸奔”的追责闭环
- 车辆关键事件（急刹、碰撞、异常广播）进入**签名审计日志**；
- 日志正文本地保留，**只把 hash / receipt / case ID** 上送监管透明日志；
- 触发调查时，由 OEM / CA / 监管三方按流程完成身份还原与证据包生成。

### Phase 3：把 AI/规则引擎接进来
- AI/ML 只负责发现可疑行为、排序告警；
- 真正的 revocation 仍由权威 PKI/监管动作触发；
- 避免“模型误报 = 直接封车”。

## 7. 关键设计原则
1. **不要把区块链放在逐包通信面**：会伤害时延和成本。
2. **不要让 OBU 承担全量 CRL 负担**：优先摘要、增量、分区与边缘补查。
3. **不要把可追责做成可随时监控**：解匿必须有触发条件和流程留痕。
4. **不要把“检测”与“裁决”混在一起**：AI/规则只做发现，CA/监管做最终裁决。

## 8. 最适合的首发场景
- **营运车队 / 两客一危 / 港口物流 / 矿区/园区车联网**：
  - 车辆边界清晰；
  - RSU/MEC 可控；
  - 监管链路明确；
  - 更容易先把“实时撤销 + 追责”跑通。
- 之后再扩展到开放道路的大规模社会车辆。

## 9. PPT 建议页结构
1. 封面：研究目标与结论
2. 你的问题拆解（实时撤销 + 事后追责）
3. 现有真实进展：标准 / 试点 / 开源 / 论文
4. 为什么车联网撤销难（OBU、广播、时延、密度）
5. 当前主流做法：VPKI / EC + AT / 条件匿名
6. 研究热点：增量 CRL / 摘要撤销 / 边缘协助 / 透明日志
7. 可行性判断：哪些现在能做、哪些要谨慎
8. EATI→VANET 架构映射
9. 分阶段实现路线图
10. 风险与边界
11. 参考资料
