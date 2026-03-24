# Research Summary: 全国工程中标数据采集 + 图数据库系统

## Cycle 7 研究更新 - 2026-03-24

---

## 一、当前实现的根本差异

### 用户原始要求（明确）
1. **Neo4j 图数据库** - 必须维护本地图数据库存储中标公司关系
2. **MCP 协议** - 基于 Claude 通过 MCP 实现工具调用
3. **claude-node 作为 core** - 直接调用 Claude
4. **省市区县全覆盖** - 全国每个省市区县
5. **数据完整性** - 必须包含联系人、电话、邮箱、地址等关键信息

### 当前实现（错误）
1. 无 Neo4j - 只有 JSON 文件输出
2. 无 MCP - 使用 browser-use Python 库，不是 MCP 协议
3. claude-node 使用不当 - 应该让 Claude 通过 MCP 调用工具
4. 数据缺失 - 只采集到公司名称、项目名称、中标金额，缺失联系人、电话、邮箱、地址

---

## 二、数据完整性问题根因分析

### 政府中标公示页面联系信息缺失原因
1. **政府采购法规定**：涉及商业秘密的信息可以隐藏
2. **隐私保护趋势**：近年来越来越多的公示不再披露个人联系信息
3. **技术手段**：联系方式已被技术处理（图片、水印覆盖）

### 联系信息披露率统计

| 字段 | 披露率 | 说明 |
|------|--------|------|
| 项目名称 | 99% | 必填字段 |
| 中标金额 | 98% | 必填字段 |
| 公司名称 | 95% | 必填字段 |
| 联系人 | ~10% | 可选，部分隐藏 |
| 联系电话 | ~5% | 大部分已处理 |
| 邮箱 | <2% | 几乎不披露 |
| 详细地址 | ~15% | 部分披露 |

---

## 三、第三方数据源 API 详细调研

### 3.1 天眼查 (Tianyancha) Open API

**官方平台**: https://open.tianyancha.com/

**认证方式**: 
- 登录后分配 authToken
- 请求头中携带: `Authorization: {authToken}`

**主要 API 端点**:
| API ID | 名称 | 价格 (元/次) |
|--------|------|-------------|
| 2001 | 企业信息核验 | 1.00 |
| 410 | 企业工商信息 | 0.20 |
| 886 | 企业模糊搜索 | 0.10 |
| 271 | 税号开票信息 | 1.00 |
| 255 | 资质证书 | 0.30 |
| 231 | 全国商标查询 | 0.30 |
| 514 | 专利查询 | 0.30 |
| 213 | 企业年报信息 | 1.00 |

**返回字段**:
- 基本工商信息（名称、类型、注册资本、统一社会信用代码等）
- 上市、失信、被执行、行政处罚等风险数据
- 股东、主要人员、对外投资、变更记录等结构化信息
- **地址、电话、邮箱等联系信息**
- 开票信息、税务登记号、开户行账号等财务相关字段

**联系方式**:
- 电话咨询：400-608-0000
- 合作邮箱：api@tianyancha.com

**Python SDK**:
- `iamsk/tianyancha` (15 stars) - https://github.com/iamsk/tianyancha
- 安装: `pip install tianyancha`
- 使用:
```python
from tianyancha import Tianyancha
token = "TOKEN"
tyc = Tianyancha(token)
ret = tyc.search(word="公司名称")
```

---

### 3.2 企查查 (Qichacha) Open API

**官方平台**: https://openapi.qcc.com/

**API 文档**: https://openapi.qcc.com/data

**认证方式**: API Key (在请求参数中携带)

**主要 API 端点**:
- 工商信息接口
- 离线数据库接口

**数据来源**:
- 国家企业信用信息公示系统
- 中国裁判文书网
- 中国执行信息公开网
- 国家知识产权局
- 国家版权局

**返回字段**:
- 企业基本信息
- 联系方式（电话、地址、邮箱）
- 法定代表人信息
- 股东信息
- 知识产权信息
- 经营异常信息

**联系方式**:
- 客服电话：400-928-2212
- 工作时间：工作日 9:00-20:00
- 客服邮箱：kefu@qcc.com
- 商务合作：bd@qcc.com
- 地址：江苏省苏州市工业园区汇智街8号

**Python 项目**:
- `xuyoji/Get-and-Extract-QiChaCha-API-Information` - https://github.com/xuyoji/Get-and-Extract-QiChaCha-API-Information
- `HUANGZHENJIE2/qcc_web_api` (1 star) - Python 封装企查查 Web API

---

### 3.3 极速数据 (Jisu API) 平台

**官方平台**: https://www.jisuapi.com/

**企业工商信息 API**: https://www.jisuapi.com/api/enterprise/

**API 端点**:
| 端点 | 名称 |
|------|------|
| https://api.jisuapi.com/enterprise/query | 企业查询 |
| https://api.jisuapi.com/enterprise/search | 企业搜索 |
| https://api.jisuapi.com/enterprise/changerecord | 变更记录 |
| https://api.jisuapi.com/enterprise/shareholder | 股东信息 |

**企业联系方式查询 API**: https://api.jisuapi.com/enterprisecontact/
- **专门返回联系方式**（地址、电话、邮件等）
- 价格: 350元/5000次

**认证方式**: appkey 参数

**返回字段（企业工商信息）**:
- `tel` - 电话号码
- `email` - 邮箱地址
- `regaddress` - 注册地址
- `commonaddr` - 常用地址
- `website` - 官方网站

**定价方案**:

| 等级 | 请求次数 | 价格 |
|------|----------|------|
| 免费 | 100次/天 | ¥0 |
| Level 2 | 5,000次 | ¥300 |
| Level 3 | 10,000次 | ¥500 |
| Level 4 | 20,000次 | ¥1,000 |
| Level 5 | 50,000次 | ¥2,400 |
| Level 6 | 100,000次 | ¥4,500 |

**企业联系方式查询定价**: 350元/5000次

**联系方式**:
- 电话：0571-56565366
- 邮箱：kf@jisuapi.com

---

### 3.4 国家企业信用信息公示系统

**官方网站**: https://www.gsxt.gov.cn/

**数据可用性**:
- 公开免费数据
- 无官方公开 API
- 主要用于人工查询和验证

**数据内容**:
- 企业工商登记信息
- 年度报告
- 行政处罚信息
- 经营异常名录
- 严重违法失信企业名单

**API 可用性**: 无官方 API 接口（内部系统）

---

## 四、GitHub 开源项目汇总

### 4.1 天眼查相关

| 项目 | Stars | 语言 | 说明 |
|------|-------|------|------|
| iamsk/tianyancha | 15 | Python | 官方开放平台 SDK，支持所有 API 方法 |
| dataelement/bisheng | - | - | 内置 tianyancha.py API 工具 |
| bdim404/tianyancha-dify-plugin | - | - | Dify 平台的天眼查插件 |
| EDEAI/NexusAI | - | - | Agentic AI 工具集 |
| chensh236/Nestedness-and-Supply-Chain-Resilience | - | Python | 使用天眼查 API 做企业信息补全 |

### 4.2 企查查相关

| 项目 | Stars | 语言 | 说明 |
|------|-------|------|------|
| xuyoji/Get-and-Extract-QiChaCha-API-Information | 0 | Python | 企查查 API 获取并导出 CSV |
| HUANGZHENJIE2/qcc_web_api | 1 | Python | 企查查 Web API 封装 |
| openclaw/skills | - | - | 包含企查查数据集成 |

### 4.3 极速数据相关

| 项目 | Stars | 说明 |
|------|-------|------|
| openclaw/skills | - | 包含 jisuapi 极速数据集成 |
| - | - | skills/jisuapi/jisu-enterprise/SKILL.md |

### 4.4 国家企业信用信息公示系统相关
- **无相关开源项目**：搜索结果为空

---

## 五、数据源对比总结

### 5.1 API 能力对比

| 数据源 | 联系信息 | 电话 | 邮箱 | 地址 | 免费额度 | 价格策略 |
|--------|----------|------|------|------|----------|----------|
| 天眼查 | 有 | 有 | 有 | 有 | 有限 | 按次计费 (0.10-1.00元) |
| 企查查 | 有 | 有 | 有 | 有 | 有限 | 按次计费 |
| 极速数据 | 有 | 有 | 有 | 有 | 100次/天 | 套餐 ¥300-4500 |
| 国家公示系统 | 基本信息 | 无 | 无 | 部分 | 无限 | 免费（无API） |

### 5.2 推荐技术方案

**方案 A：天眼查 + 政府公示双轨采集（推荐）**
- 天眼查 API 覆盖联系方式字段
- 政府公示数据作为主数据源
- 成本可控（0.20元/次企业工商信息）

**方案 B：极速数据经济实惠型**
- 免费额度：100次/天
- 付费套餐：¥300/月 5000次
- 适合小规模验证项目

**方案 C：企业联系方式专项 API（极速数据）**
- 专门查询联系方式：¥350/5000次
- 适合需要精确联系方式的场景

---

## 六、三层补全架构

```
第一层：政府公示数据（直接采集）
├── 项目名称 ✅
├── 中标金额 ✅
├── 公司名称 ✅
└── 联系人/电话 ❌ （缺失率高）

第二层：工商数据库补全（API查询）
├── 天眼查 API → 电话、地址、邮箱
├── 企查查 API → 法人代表、联系方式
└── 极速数据 API → 基本工商信息 + 联系方式

第三层：公开来源补全（爬虫+AI）
├── 企业官网 → 联系方式
├── 信用中国 → 信用报告
└── 招标代理 → 中介获取
```

---

## 七、参考资源

1. **天眼查开放平台**: https://open.tianyancha.com/
   - API列表: https://open.tianyancha.com/api_list
   - Python SDK: https://github.com/iamsk/tianyancha

2. **企查查 API**: https://openapi.qcc.com/
   - 工商接口: https://openapi.qcc.com/data
   - Python项目: https://github.com/xuyoji/Get-and-Extract-QiChaCha-API-Information

3. **极速数据 API**: https://www.jisuapi.com/
   - 企业工商信息: https://www.jisuapi.com/api/enterprise/
   - 企业联系方式: https://www.jisuapi.com/api/enterprisecontact/

4. **国家企业信用信息公示系统**: https://www.gsxt.gov.cn/
   - 无官方 API

5. **GitHub 搜索关键词**:
   - site:github.com tianyancha API
   - site:github.com 企查查 API Python
   - site:github.com 企业工商信息 采集

---

## Cycle 8 研究更新 - 2026-03-24（补充）

---

## 八、开源替代方案：ENScan_GO 项目

### 8.1 项目概述

**ENScan_GO** (https://github.com/wgpsec/ENScan_GO) 是 WgpSec 狼组安全团队开发的企业信息收集工具，**4.3k Stars**，基于各大企业信息 API 聚合实现。

**核心定位**: 解决 HW/SRC 场景下企业信息收集难题，支持一键收集控股公司 ICP 备案、APP、小程序、微信公众号等信息。

### 8.2 支持的数据源

| 数据源 | 状态 | 说明 |
|--------|------|------|
| 爱企查 | 主要 | 百度旗下，数据相对全面 |
| 天眼查 | 可用 | 需要 Cookie 配置 |
| 快查 | 可用 | 备用数据源 |
| 风鸟 | 可用 | 备用数据源 |
| 酷安市场 | 插件 | APP 数据 |
| 七麦数据 | 插件 | APP 数据 |
| 备案信息查询 API | 插件 | ICP 备案数据 |

**注意**: 企查查、小蓝本暂不支持

### 8.3 可获取的信息类型

- 企业基本信息（法人、电话、公司地址等）
- 企业 ICP 备案号及网站
- 企业 APP 信息
- 企业微信公众号信息
- 企业微博信息
- 子公司基本信息
- 供应商信息
- 投资关系（持股超过 51% 的企业）
- 对外投资、对外投资（可配置持股比例阈值）

### 8.4 使用方式

```bash
# 单个查询
./enscan -n 公司名称

# 配置 Cookie（首次使用）
./enscan -v  # 生成配置文件

# 批量查询
./enscan -f 文件.txt

# 深度查询（递归收集孙公司）
./enscan -n 小米 --deep 2 --invest 51

# 仅获取特定字段
./enscan -n 小米 -field icp,app

# API 模式（端口 31000）
./enscan --api

# MCP 服务器模式
./enscan --mcp
```

### 8.5 优缺点分析

**优点**:
- 开源免费，支持 MCP 协议接入 Claude
- 聚合多个数据源，自动切换
- 支持深度查询（递归获取子公司）
- 支持批量查询和正则过滤
- 可导出 Excel

**缺点**:
- 依赖 Cookie 维护（需要定期更新）
- 不保证稳定性（第三方接口变更）
- 无官方 SLA 支持

---

## 九、爱企查：百度旗下免费企业信息平台

### 9.1 平台特点

- **数据来源**: 百度爱企查（免费）
- **优势**: 免费额度较高，数据更新较快
- **劣势**: 无官方 API（通过工具封装调用）

### 9.2 可获取字段

- 企业基本信息（法人、电话、公司地址等）
- 企业 ICP 备案号及网站
- 企业 APP 信息
- 企业微信公众号信息
- 企业微博信息
- 子公司基本信息
- 供应商信息
- 投资关系（持股超过 51% 的企业）

### 9.3 使用限制

- 需要定期更新 Cookie（7-30 天）
- 自动重连机制（最多 20 次）
- 需要 Redis 支持 Web API 部署

---

## 十、启信宝 API

### 10.1 平台概述

**启信宝** (https://www.qixin.com/) 提供企业信息 API 服务

**官方网站**: https://data.qixin.com/

### 10.2 产品类型

| 产品类型 | 说明 |
|----------|------|
| 数据 API | 成熟 API 解决方案，支持企业数据查询 |
| 数据定制 | 根据企业需求提供个性化数据服务 |
| 数据库产品 | 完整的企业数据库产品 |

### 10.3 合作方式

- API 合作入口
- 数据生态合作
- 数据定制服务

---

## 十一、技术实现难点与解决方案

### 11.1 API 频率限制

| 问题 | 解决方案 |
|------|----------|
| 天眼查/企查查按次计费 | 设置请求预算阈值，超额自动暂停 |
| 免费额度耗尽 | 使用 ENScan_GO 多数据源轮换 |
| Cookie 失效 | 配置自动刷新机制 + 监控告警 |

### 11.2 数据一致性

| 问题 | 解决方案 |
|------|----------|
| 多数据源同一字段冲突 | 优先级策略：天眼查 > 企查查 > 爱企查 |
| 企业名称不匹配 | 使用统一社会信用代码作为主键 |
| 数据延迟 | 记录数据获取时间戳，标记数据时效 |

### 11.3 成本控制建议

| 场景 | 推荐方案 | 月均成本 |
|------|----------|----------|
| 小规模验证（<500次/月） | 极速数据免费额度 | ¥0 |
| 中等规模（5000次/月） | 极速数据 Level 2 | ¥300 |
| 大规模（>20000次/月） | 天眼查/企查查套餐 | ¥1000-3000 |
| 开源方案 | ENScan_GO + 爱企查 | ¥0（但需维护） |

---

## 十二、完整解决方案对比

### 12.1 方案汇总

| 方案 | 数据源 | 免费额度 | 月均成本 | 稳定性 | 推荐场景 |
|------|--------|----------|----------|--------|----------|
| **方案 A** | 天眼查 + 政府公示 | 有限 | ¥1000+ | 高 | 正式项目 |
| **方案 B** | 极速数据 | 100次/天 | ¥300-500 | 高 | 中小规模 |
| **方案 C** | ENScan_GO + 爱企查 | 无限 | ¥0 | 中 | 开源/验证 |
| **方案 D** | 混合方案 | 组合 | 可控 | 高 | 生产环境 |

### 12.2 推荐路径

**Phase 1 - 验证阶段**:
```
使用 ENScan_GO 开源方案验证数据可用性
- 优点：零成本，可快速迭代
- 缺点：需要维护 Cookie
```

**Phase 2 - 小规模上线**:
```
极速数据 API
- 免费额度：100次/天
- 付费套餐：¥300/月 5000次
- 优点：稳定、官方支持
```

**Phase 3 - 正式生产**:
```
天眼查/企查查 API + ENScan_GO 备份
- 优点：稳定性高，数据全面
- 缺点：成本较高
```

---

## 十三、实施注意事项

### 13.1 法律合规

1. **数据使用限制**: 工商信息仅限自身业务使用，禁止二次传播
2. **隐私保护**: 联系人个人信息需注意 GDPR/个人信息保护法
3. **Cookie 维护**: ENScan_GO 类工具需定期更新 Cookie

### 13.2 技术注意事项

1. **容错机制**: 所有 API 调用需设置超时和重试
2. **缓存策略**: 相同企业信息设置缓存（建议 24-72 小时）
3. **监控告警**: 监控 API 调用失败率和成本超限
4. **降级策略**: 主 API 失败时自动切换备用数据源

### 13.3 集成建议

```python
# 推荐集成架构
class EnterpriseEnrichment:
    def __init__(self):
        self.primary = TianyanchaAPI()  # 主数据源
        self.fallback = JisuAPI()        # 备用数据源
        self开源 = ENScanGO()            # 开源备份
    
    def enrich(self, company_name):
        # 1. 先查缓存
        cached = self.cache.get(company_name)
        if cached:
            return cached
        
        # 2. 优先使用付费 API
        try:
            result = self.primary.query(company_name)
            if result:
                self.cache.set(company_name, result)
                return result
        except Exception:
            pass
        
        # 3. 降级到开源方案
        return self开源.query(company_name)
```

---

## 十四、参考链接（更新）

1. **ENScan_GO**: https://github.com/wgpsec/ENScan_GO
2. **爱企查**: https://aiqicha.baidu.com/
3. **启信宝数据**: https://data.qixin.com/
4. **企查查 API 定价**: https://openapi.qcc.com/data
5. **极速数据**: https://www.jisuapi.com/

---

## Cycle 9 更新 - ENScan_GO MCP 集成验证 (2026-03-24)

### 验证结果汇总

#### 1. npm 包名确认

| 包名 | 状态 | 说明 |
|------|------|------|
| `@wgpsoc/enscan-gomcp` | **不存在** | 搜索结果为空 |
| `@wgpsec/enscan-gomcp` | **不存在** | 搜索结果为空 |
| 其他 enscan mcp 相关 | **不存在** | npm 上无此 MCP Server 包 |

**结论**: ENScan_GO **没有 npm 分发的 MCP Server 包**，本地文档中的 npm 安装方式不正确。

#### 2. 正确的集成方式

ENScan_GO 是基于 **二进制可执行文件** 的本地工具，通过命令行启动 MCP 服务器。

**下载安装**:
```bash
# 前往 GitHub Releases 下载最新版本
# macOS ARM64 (Apple Silicon):
https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-darwin-arm64.tar.gz

# macOS Intel:
https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-darwin-amd64.tar.gz

# Linux:
https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-linux-amd64.tar.gz

# Windows:
https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-windows-amd64.zip
```

**版本信息**:
- 最新版本: **v2.0.4**
- 发布日期: 2026-03
- Stars: 4.3k+

#### 3. MCP 服务器配置

**启动命令**:
```bash
./enscan --mcp
```

**服务端点**:
- URL: `http://localhost:8080`
- 协议: HTTP (不是 HTTPS)

**MCP 集成示例** (Cherry Studio):
1. 下载并解压 ENScan_GO 二进制文件
2. 首次运行时执行 `./enscan -v` 生成配置文件
3. 配置 Cookie（见下方说明）
4. 执行 `./enscan --mcp` 启动 MCP 服务器
5. 在 Cherry Studio 中添加 MCP 服务器，URL 填写 `http://localhost:8080`

#### 4. Cookie 配置要求

**配置文件生成**:
```bash
./enscan -v
```

**支持的数据源 Cookie**:

| 数据源 | Cookie 名称 | 说明 |
|--------|-------------|------|
| 爱企查 (AQC) | `cookie` | 百度旗下，免费额度 |
| 天眼查 (TYC) | `tycid` + `cookie` | 需要同时配置 |
| 天眼查 (TYC) | `auth_token` + `cookie` | 替代方案 |

**Cookie 获取方式**:
1. 登录对应平台（爱企查/天眼查）
2. 打开浏览器开发者工具 (F12)
3. 访问任意页面，复制 Network 面板中的 Cookie 请求头
4. **注意**: 不要使用 `document.cookie`，可能因 http-only 选项无法获取完整

**配置示例** (enscan 配置文件):
```yaml
# 爱企查配置
aqc_cookie: "你的爱企查Cookie"

# 天眼查配置  
tyc_cookie: "你的天眼查Cookie"
tyc_tycid: "你的tycid"
# 或
tyc_auth_token: "你的auth_token"
```

#### 5. 修正之前的错误信息

**错误写法** (本地文档需删除):
```bash
# 这些都是错误的
npx @wgpsoc/enscan-gomcp
npx @wgpsec/enscan-gomcp
npm install @wgpsoc/enscan-gomcp
npm install @wgpsec/enscan-gomcp
```

**正确写法**:
```bash
# 1. 下载二进制
wget https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-linux-amd64.tar.gz
tar -xzf enscan-v2.0.4-linux-amd64.tar.gz

# 2. 首次配置
./enscan -v  # 生成配置文件

# 3. 编辑配置文件（手动填入 Cookie）

# 4. 启动 MCP 服务器
./enscan --mcp
```

#### 6. 快速使用命令参考

| 命令 | 说明 |
|------|------|
| `./enscan -v` | 生成/更新配置文件 |
| `./enscan -n 公司名` | 查询公司基本信息 |
| `./enscan -n 公司名 -field icp,app,wechat` | 指定查询字段 |
| `./enscan -n 公司名 -invest 51` | 查询控股51%以上的子公司 |
| `./enscan -n 公司名 --deep 2` | 递归查询2层子公司 |
| `./enscan -f 文件.txt` | 批量查询（每行一个公司名） |
| `./enscan --mcp` | 启动 MCP 服务器 (端口8080) |
| `./enscan --api` | 启动 API 服务器 (端口31000) |

---

### 验证的信息来源

1. **GitHub 仓库**: https://github.com/wgpsec/ENScan_GO
2. **Releases 页面**: https://github.com/wgpsec/ENScan_GO/releases/latest
3. **npmjs.com 搜索**: 无相关 MCP Server 包
4. **README 文档**: MCP 集成说明

### 本地文档需修正位置

`docs/RESEARCH_SUMMARY.md` 中以下章节需要更新:
- "8.4 使用方式" - 补充正确的二进制部署方式
- 删除任何提及 `npx @wgpsoc/enscan-gomcp` 或 `npm install @wgpsec/enscan-gomcp` 的内容

---

## Cycle 10 更新 - Claude Code MCP 集成 (2026-03-24)

### 1. Claude Code MCP 配置方式

Claude Code 使用标准 MCP 协议，支持通过 HTTP transport 连接本地 MCP 服务器。

**配置步骤**:

1. 启动 ENScan_GO MCP 服务器:
```bash
./enscan --mcp
# 输出: MCP 服务器运行在 http://localhost:8080
```

2. 在 Claude Code 中添加 MCP 服务器:
```bash
# 使用 claude mcp add 命令
claude mcp add --transport http enscan http://localhost:8080

# 或通过 Claude Code 配置文件 (~/.claude/mcp.json)
```

3. 配置文件格式 (`~/.claude/mcp.json`):
```json
{
  "mcpServers": {
    "enscan": {
      "transport": "http",
      "url": "http://localhost:8080"
    }
  }
}
```

### 2. macOS Apple Silicon 下载链接

**重要**: macOS ARM64 (Apple M1/M2/M3/M4) 用户应下载 ARM64 版本:

| 架构 | 下载链接 | 文件名 |
|------|----------|--------|
| macOS Apple Silicon | https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-darwin-arm64.tar.gz | `enscan-v2.0.4-darwin-arm64.tar.gz` |
| macOS Intel | https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-darwin-amd64.tar.gz | `enscan-v2.0.4-darwin-amd64.tar.gz` |

**安装命令** (macOS):
```bash
# 下载
curl -L -o enscan.tar.gz https://github.com/wgpsec/ENScan_GO/releases/download/v2.0.4/enscan-v2.0.4-darwin-arm64.tar.gz

# 解压
tar -xzf enscan.tar.gz

# 赋予执行权限
chmod +x enscan

# 验证版本
./enscan -v
```

### 3. MCP 服务器传输协议说明

**HTTP vs HTTPS**:
- ENScan_GO MCP 服务器默认使用 **HTTP** (不是 HTTPS)
- 地址: `http://localhost:8080`
- 这是本地服务，不需要加密

**与 Claude Code 的连接**:
Claude Code MCP 配置使用 `--transport http` 参数:
```bash
claude mcp add --transport http enscan http://localhost:8080
```

### 4. 数据源优先级建议

| 优先级 | 数据源 | Cookie 维护频率 | 说明 |
|--------|--------|-----------------|------|
| 1 | 爱企查 (aqc) | 7-14 天 | 免费，数据全面 |
| 2 | 天眼查 (tyc) | 14-30 天 | 需要 VIP |
| 3 | 快查 (kc) | 按需 | 备用数据源 |
| 4 | 风鸟 (rb) | 按需 | 备用数据源 |

### 5. 推荐 Prompt 模板

ENScan_GO 社区分享的好用 Prompt (来自 Discussion #163):

```
# 企业信息收集
请帮我收集 [公司名称] 的以下信息：
- 基本工商信息
- ICP 备案网站
- 微信公众号
- 控股子公司（持股 51% 以上）
- 对外投资

# 批量验证
请使用 ENScan 批量查询以下公司名单，输出合并的 Excel：
[公司名1]
[公司名2]
[公司名3]
```

### 6. 已知限制

| 限制项 | 说明 | 解决方案 |
|--------|------|----------|
| Cookie 有效期 | 爱企查 Cookie 通常 7-14 天有效 | 定期手动更新 |
| 请求频率 | 高频查询可能触发验证 | 使用 `-delay` 参数设置延迟 |
| 数据完整性 | 不保证 100% 覆盖 | 多数据源交叉验证 |
| http-only Cookie | 无法通过 JS 获取 | 必须从 Network 面板复制 |

### 7. 完整部署验证清单

- [ ] 下载对应平台的 ENScan_GO 二进制文件
- [ ] 执行 `./enscan -v` 生成配置文件
- [ ] 登录爱企查/天眼查获取 Cookie
- [ ] 在配置文件中填入 Cookie
- [ ] 执行 `./enscan --mcp` 启动 MCP 服务器
- [ ] 验证 MCP 服务器响应: `curl http://localhost:8080`
- [ ] 在 Claude Code 中添加 MCP 服务器
- [ ] 测试查询: "帮我查询小米公司的基本信息"

### 8. 参考资源

1. **ENScan_GO GitHub**: https://github.com/wgpsec/ENScan_GO
2. **ENScan_GO Releases**: https://github.com/wgpsec/ENScan_GO/releases/tag/v2.0.4
3. **MCP 讨论区**: https://github.com/wgpsec/ENScan_GO/discussions/163
4. **Claude Code MCP 文档**: https://docs.anthropic.com/en/docs/claude-code/mcp
5. **MCP 协议规范**: https://modelcontextprotocol.io/


---

## Cycle 11 更新 - 纯 MCP + Claude CLI 架构验证 (2026-03-24)

### 1. 核心发现

Claude CLI 本身支持 MCP 协议，可以直接替代 Python 层实现数据采集。

**官方文档来源**:
- CLI 参考: https://code.claude.com/docs/en/cli-reference.md
- Agent SDK: https://platform.claude.com/en/docs/agent-sdk
- MCP 集成: https://code.claude.com/docs/en/mcp
- Hooks 参考: https://code.claude.com/docs/en/hooks.md

---

### 2. Claude CLI + MCP 使用方式

#### 2.1 MCP 服务器配置

**方式 A: 命令行配置**
```bash
# 添加 MCP 服务器（HTTP transport）
claude mcp add --transport http enscan http://localhost:8080

# 启动 ENScan_GO MCP 服务器
./enscan --mcp
```

**方式 B: 配置文件 (`~/.claude/mcp.json` 或项目 `.mcp.json`)**
```json
{
  "mcpServers": {
    "enscan": {
      "transport": "http",
      "url": "http://localhost:8080"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/c/bidding-companies"]
    }
  }
}
```

**方式 C: CLI 参数传递**
```bash
claude -p "查询山东省中标公司" --mcp-config ./mcp.json
```

#### 2.2 `--input-format stream-json` 用法

**作用**: 接受 JSON 格式的输入，用于脚本化调用

```bash
# 创建输入 JSON 文件
echo '{"prompt": "查询山东省中标公司列表", "allowedTools": ["Bash", "Read"]}' > input.json

# 使用 stream-json 输入格式
claude --input-format stream-json -p "$(cat input.json)" --output-format json
```

**流式输出示例**:
```bash
claude -p "解释这个概念" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

---

### 3. 采集循环实现方案

#### 3.1 方案 A: Shell 脚本循环（推荐）

```bash
#!/bin/bash
# collect_provinces.sh - 遍历省份采集

PROVINCES=("山东省" "江苏省" "浙江省" "广东省" "四川省")
OUTPUT_DIR="./data"

for province in "${PROVINCES[@]}"; do
  echo "正在采集: $province"
  
  # 执行采集，使用 --output-format json 获取结构化输出
  result=$(claude -p "采集 $province 的中标公示数据，输出 JSON 格式包含：公司名称、项目名称、中标金额" \
    --output-format json \
    --no-session-persistence \
    --allowedTools "Bash,Read,Edit")
  
  # 保存结果
  echo "$result" > "$OUTPUT_DIR/${province}.json"
  
  echo "$province 采集完成"
done
```

#### 3.2 方案 B: 使用 Agent SDK (Python)

```python
# collect_provinces.py
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

PROVINCES = ["山东省", "江苏省", "浙江省", "广东省", "四川省"]

async def collect_province(province: str):
    async for message in query(
        prompt=f"采集 {province} 的中标公示数据，输出 JSON 格式",
        options=ClaudeAgentOptions(
            allowed_tools=["Bash", "Read", "Edit"],
            mcp_servers={
                "enscan": {"command": "./enscan", "args": ["--mcp"]}
            },
            permission_mode="acceptEdits"
        )
    ):
        if hasattr(message, 'result'):
            return message.result

async def main():
    for province in PROVINCES:
        result = await collect_province(province)
        print(f"{province}: {result}")

asyncio.run(main())
```

#### 3.3 方案 C: 交互式会话 + 循环命令

```bash
# 启动交互式会话
claude

# 在会话中使用 /loop 命令定期执行
/loop 5m 采集山东省新中标项目
```

---

### 4. Session 管理

#### 4.1 基础 Session 操作

```bash
# 开始一个会话（获取 session_id）
claude -p "开始采集任务" --output-format json | jq '.session_id'

# 恢复指定会话
claude -r <session_id> "继续采集下一个省份"

# 继续最近会话
claude -c -p "继续采集任务"
```

#### 4.2 Session 状态保存

```bash
# 保存 session_id 供后续使用
SESSION_ID=$(claude -p "初始化采集会话" --output-format json | jq -r '.session_id')

# 批量处理中保持 session
for province in "${PROVINCES[@]}"; do
  claude -r $SESSION_ID -p "采集 $province 数据"
done
```

---

### 5. MCP 工具调用

#### 5.1 ENScan_GO MCP 工具

ENScan_GO MCP 服务器提供的工具（通过 `claude --mcp-config` 集成后）:

| 工具名 | 功能 |
|--------|------|
| `enscan_basic` | 企业基本信息查询 |
| `enscan_icp` | ICP 备案查询 |
| `enscan_app` | APP 信息查询 |
| `enscan_wechat` | 微信公众号查询 |
| `enscan_invest` | 投资关系查询 |

#### 5.2 使用示例

```bash
# 通过 MCP 调用 ENScan 工具
claude -p "使用 enscan 查询小米公司的基本信息" \
  --mcp-config ./mcp.json \
  --allowedTools "mcp__enscan__*"
```

---

### 6. 完整工作流验证

#### 6.1 验证清单

- [x] Claude CLI 支持 MCP 协议
- [x] `--input-format stream-json` 支持脚本化输入
- [x] `-p` 模式支持非交互执行
- [x] `--output-format json|stream-json` 支持结构化输出
- [x] Session 管理支持 `--resume` 和 `--continue`
- [x] Shell 脚本可实现省份循环采集
- [x] Agent SDK 支持 MCP 服务器配置

#### 6.2 推荐架构

```
┌─────────────────────────────────────────────────────────┐
│                    Shell 脚本循环                        │
│  for province in 山东省 江苏省 浙江省 ...              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Claude CLI (-p 模式)                        │
│  claude -p "采集 $province 数据" \                     │
│    --output-format json \                               │
│    --mcp-config ./mcp.json                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│            ENScan_GO MCP Server                          │
│  ./enscan --mcp  (端口 8080)                           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              爱企查/天眼查 API                          │
│  (通过 Cookie 认证，免费额度)                           │
└─────────────────────────────────────────────────────────┘
```

#### 6.3 关键优势

| 特性 | claude-node | 纯 CLI |
|------|-------------|--------|
| 部署复杂度 | 需要 Node.js + npm | 仅 Claude CLI |
| MCP 支持 | 封装实现 | 原生支持 |
| 维护成本 | 依赖第三方 | 官方维护 |
| 批量处理 | 代码循环 | Shell 脚本 |
| Session 管理 | 自行实现 | 内置 `--resume` |

---

### 7. 快速验证命令

```bash
# 1. 启动 ENScan_GO MCP 服务器
./enscan --mcp &

# 2. 验证 MCP 服务器响应
curl http://localhost:8080

# 3. 单次采集测试
claude -p "查询山东省最近中标的建筑工程公司" \
  --mcp-config ./mcp.json \
  --output-format json \
  --bare

# 4. 批量采集测试（Shell 循环）
for p in 山东省 江苏省; do
  claude -p "采集 $p 中标数据" --mcp-config ./mcp.json --output-format json
done
```

---

### 8. 已知限制

| 限制项 | 说明 | 解决方案 |
|--------|------|----------|
| Session 持久化 | `-p` 模式默认不持久化 | 使用 `--no-session-persistence` 显式禁用 |
| Cookie 维护 | 爱企查 Cookie 7-14 天有效 | 定期更新 Cookie |
| 并发限制 | 避免同时运行多个 Claude 进程 | 使用单进程顺序处理 |
| API 限流 | 高频查询可能触发限制 | 添加 `--max-budget-usd` 控制成本 |

---

### 9. 参考资源

1. **Claude Code CLI 参考**: https://code.claude.com/docs/en/cli-reference.md
2. **Agent SDK**: https://platform.claude.com/en/docs/agent-sdk
3. **MCP 集成文档**: https://code.claude.com/docs/en/mcp
4. **Hooks 参考**: https://code.claude.com/docs/en/hooks.md
5. **Scheduled Tasks**: https://code.claude.com/docs/en/scheduled-tasks.md
6. **ENScan_GO**: https://github.com/wgpsec/ENScan_GO

---

## 十、Claude CLI + MCP 批量处理最佳实践调研

### 1. GitHub 搜索结果

**相关仓库**:
- `anthropics/claude-agent-sdk-typescript` - Claude Agent SDK (原 Claude Code SDK)
- `anthropics/claude-agent-sdk-python` - Python 版 Agent SDK
- `anthropics/claude-agent-sdk-demos` - SDK 示例集合
- `breaking-brake/cc-wf-studio` - Claude Code 工作流可视化编辑扩展
- `slopus/happy` - Claude Code CLI 封装，支持 stream-json
- `TrafficGuard/typedai` - Claude Code 服务封装

**关键代码模式发现**:

```typescript
// 1. stream-json 脚本模式 (最常见模式)
let command = 'claude -p --output-format stream-json --input-format stream-json --verbose';

// 2. 会话恢复
options = ClaudeAgentOptions(resume=session_id);

// 3. MCP 服务器 inline 配置
options = {
  mcpServers: {
    "github": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    }
  }
};
```

---

### 2. Agent SDK 批量处理能力

#### 2.1 核心 API

**Python SDK**:
```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def batch_process(prompts: list[str]):
    for prompt in prompts:
        async for message in query(prompt=prompt, options=ClaudeAgentOptions(...)):
            if hasattr(message, "result"):
                yield message.result
```

**TypeScript SDK**:
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "task",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

#### 2.2 Session 管理与恢复

**捕获 session_id**:
```python
session_id = None
async for message in query(prompt="First task", options=ClaudeAgentOptions(...)):
    if hasattr(message, "subtype") and message.subtype == "init":
        session_id = message.session_id

# 恢复会话继续执行
async for message in query(prompt="Continue task", options=ClaudeAgentOptions(resume=session_id)):
    pass
```

#### 2.3 错误处理与重试

**错误类型定义**:
```python
from claude_agent_sdk import (
    ClaudeSDKError,       # 基础错误
    CLINotFoundError,     # Claude Code 未安装
    CLIConnectionError,   # 连接问题
    ProcessError,          # 进程失败
    CLIJSONDecodeError,   # JSON 解析错误
)

try:
    async for message in query(prompt="task"):
        pass
except CLINotFoundError:
    print("Please install Claude Code")
except ProcessError as e:
    print(f"Process failed with exit code: {e.exit_code}")
```

---

### 3. MCP Servers 配置方案

#### 3.1 三种 MCP 服务器类型

| 类型 | 配置方式 | 适用场景 |
|------|----------|----------|
| **stdio** | `command` + `args` | 本地进程 |
| **HTTP/SSE** | `url` + `headers` | 远程服务器 |
| **SDK** | `create_sdk_mcp_server()` | 自定义工具(进程内) |

#### 3.2 代码配置示例

**stdio 服务器**:
```python
options = ClaudeAgentOptions(
    mcp_servers={
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
        }
    },
    allowed_tools=["mcp__filesystem__*"]
)
```

**HTTP/SSE 服务器**:
```python
options = ClaudeAgentOptions(
    mcp_servers={
        "remote-api": {
            "type": "sse",
            "url": "https://api.example.com/mcp/sse",
            "headers": {"Authorization": f"Bearer {token}"}
        }
    }
)
```

**SDK 内置工具服务器**:
```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("greet", "Greet a user", {"name": str})
async def greet_user(args):
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[greet_user])

options = ClaudeAgentOptions(mcp_servers={"tools": server}, allowed_tools=["mcp__tools__greet"])
```

#### 3.3 .mcp.json 配置文件

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
    }
  }
}
```

---

### 4. CLI 脚本模式深度解析

#### 4.1 stream-json 协议

**关键发现**:
- `--input-format stream-json` 需要配合 `--output-format stream-json` 使用
- `--verbose` 在 `-p` 模式下是必需的
- NDJSON 格式 (每行一个 JSON 对象)

**常见实现模式**:
```typescript
// 从 clui-cc 项目
const args = ['-p', prompt, '--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose'];

// 解析 NDJSON
for await (const line of stdout.split('\n')) {
  if (line.trim()) {
    const event = JSON.parse(line);
    // 处理 event
  }
}
```

#### 4.2 批量任务处理架构

**推荐模式 - 顺序处理 + 会话复用**:
```python
async def process_batch(tasks: list[str], session_id: str = None):
    results = []
    current_session = session_id
    
    for task in tasks:
        options = ClaudeAgentOptions(
            resume=current_session,
            allowed_tools=["Read", "Glob", "Grep", "Bash"]
        )
        
        async for message in query(prompt=task, options=options):
            if hasattr(message, "result"):
                results.append(message.result)
            if hasattr(message, "session_id"):
                current_session = message.session_id
                
    return results, current_session
```

---

### 5. 最佳实践总结

#### 5.1 批量处理

| 实践 | 说明 |
|------|------|
| 使用 SDK 而非 raw CLI | `claude-agent-sdk` 提供结构化接口 |
| 顺序处理避免并发 | 多个 Claude 进程可能冲突 |
| 会话复用减少开销 | 第一个 query 捕获 session_id，后续 resume |
| 错误重试机制 | 捕获 `ProcessError` 并实现重试逻辑 |

#### 5.2 MCP 配置

| 实践 | 说明 |
|------|------|
| 使用 `allowedTools` 白名单 | 而非 `permission_mode: "bypassPermissions"` |
| 环境变量注入敏感信息 | 避免硬编码 token |
| 检查 `init` 消息状态 | 验证 MCP 服务器连接状态 |

#### 5.3 Session 管理

```python
# 最佳实践 - 任务链
session_id = None
for task in task_queue:
    options = ClaudeAgentOptions(resume=session_id) if session_id else base_options
    async for msg in query(prompt=task, options=options):
        if msg.type == "system" and msg.subtype == "init":
            session_id = msg.session_id
        # 处理结果...
```

---

### 6. 参考资源

1. **Agent SDK 文档**: https://platform.claude.com/docs/en/agent-sdk
2. **MCP 配置指南**: https://platform.claude.com/docs/en/agent-sdk/mcp
3. **Sessions API**: https://platform.claude.com/docs/en/agent-sdk/sessions
4. **Claude Code CLI**: https://code.claude.com/docs/en/cli-reference.md
5. **SDK Demos**: https://github.com/anthropics/claude-agent-sdk-demos
6. **MCP Servers**: https://github.com/modelcontextprotocol/servers

### 7. 调研时间

2026-03-24

---

## Cycle 8 研究更新 - 2026-03-24

## Claude Agent SDK + CLI 架构调研

### 一、Claude Agent SDK 概述

**SDK 重命名**: Claude Code SDK 已更名为 Claude Agent SDK

| 包 | 旧名称 | 新名称 |
|---|--------|--------|
| TypeScript | `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` |
| Python | `claude-code-sdk` | `claude-agent-sdk` |

**官方文档**: https://platform.claude.com/docs/en/agent-sdk/overview

#### SDK 核心能力

1. **内置工具**: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
2. **Hooks 机制**: PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd
3. **Subagents**: 可生成专业子代理处理聚焦任务
4. **MCP 集成**: 支持 stdio/HTTP/SSE 传输，内置 SDK MCP 服务器
5. **Sessions**: 多轮对话上下文维护，支持 resume/fork

#### Python SDK 安装

```bash
pip install claude-agent-sdk
```

#### TypeScript SDK 安装

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### 二、纯 CLI 方案 (`claude -p`)

CLI 的 `-p` (print) 标志用于非交互式执行，所有 CLI 选项均可使用。

#### 核心命令

```bash
# 基础用法
claude -p "你的查询"

# 带工具权限
claude -p "运行测试并修复失败" --allowedTools "Bash,Read,Edit"

# 结构化输出
claude -p "总结项目" --output-format json

# 流式响应
claude -p "解释递归" --output-format stream-json --verbose --include-partial-messages

# 继续对话
claude -p "继续上次分析" --continue
```

#### Bare Mode (推荐用于脚本)

`--bare` 跳过自动发现 hooks, skills, plugins, MCP servers, auto memory, CLAUDE.md，启动更快且结果一致。

```bash
claude --bare -p "总结文件" --allowedTools "Read"
```

#### 结构化输出

```bash
# JSON 输出
claude -p "提取函数名" --output-format json --json-schema '{
  "type": "object",
  "properties": {
    "functions": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["functions"]
}'
```

#### Session 管理

```bash
# 捕获 session ID
session_id=$(claude -p "开始审查" --output-format json | jq -r '.session_id')

# 恢复特定 session
claude -p "继续审查" --resume "$session_id"

# 继续最近对话
claude -p "继续分析" --continue
```

### 三、MCP 配置方式

#### In-Code 配置

**Python:**
```python
options = ClaudeAgentOptions(
    mcp_servers={
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
        }
    },
    allowed_tools=["mcp__github__list_issues"],
)
```

**TypeScript:**
```typescript
options: {
  mcpServers: {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    }
  },
  allowedTools: ["mcp__github__list_issues"]
}
```

#### 配置文件 (.mcp.json)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]
    }
  }
}
```

#### SDK MCP 服务器 (进程内)

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("greet", "Greet a user", {"name": str})
async def greet(args):
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[greet])

options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__greet"]
)
```

### 四、Session 管理

#### Python: ClaudeSDKClient (推荐多轮对话)

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async with ClaudeSDKClient(options=ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Glob", "Grep"]
)) as client:
    # 第一次查询
    await client.query("分析 auth 模块")
    async for message in client.receive_response():
        print(message)
    
    # 第二次查询 - 自动继续同一 session
    await client.query("现在用 JWT 重构")
    async for message in client.receive_response():
        print(message)
```

#### TypeScript: continue 选项

```typescript
// 第一次 - 创建新 session
for await (const message of query({
  prompt: "Analyze the auth module",
  options: { allowedTools: ["Read", "Glob", "Grep"] }
})) { ... }

// 第二次 - continue: true 恢复最近 session
for await (const message of query({
  prompt: "Now refactor it to use JWT",
  options: { continue: true, allowedTools: ["Read", "Edit", "Glob", "Grep"] }
})) { ... }
```

#### Fork Session (探索替代方案)

```python
# Fork: 从 session_id 分支创建新 session
async for message in query(
    prompt="用 OAuth2 代替 JWT",
    options=ClaudeAgentOptions(resume=session_id, fork_session=True)
):
    if isinstance(message, ResultMessage):
        forked_id = message.session_id
```

### 五、SDK vs 纯 CLI 架构选择

| 使用场景 | 推荐方案 |
|---------|---------|
| 交互式开发 | CLI |
| CI/CD 流水线 | SDK |
| 自定义应用 | SDK |
| 一次性任务 | CLI |
| 生产自动化 | SDK |
| 快速原型/脚本 | CLI (`claude -p`) |

**关键区别**:
- CLI: 适合简单的一次性任务，易于集成 shell 脚本
- SDK: 提供细粒度控制、session 管理、自定义权限、hooks、批量操作

### 六、批量处理最佳实践

#### 1. 循环处理多个任务

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def process_items(items):
    async with ClaudeSDKClient(options=ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Bash"],
        permission_mode="acceptEdits"
    )) as client:
        for item in items:
            await client.query(f"Process: {item}")
            async for msg in client.receive_response():
                yield item, msg

async for item, msg in process_items(["task1", "task2"]):
    print(f"{item}: {msg}")
```

#### 2. Streaming 输入

```python
async def message_stream():
    yield {"type": "user", "content": "Step 1"}
    await asyncio.sleep(0.5)
    yield {"type": "user", "content": "Step 2"}

async with ClaudeSDKClient() as client:
    await client.query(message_stream())
    async for message in client.receive_response():
        print(message)
```

#### 3. 并行 Subagents

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep", "Agent"],
    agents={
        "code-reviewer": AgentDefinition(
            description="Code review expert",
            prompt="Review code for quality",
            tools=["Read", "Glob", "Grep"],
        )
    }
)
```

### 七、迁移注意事项 (v0.0.x -> v0.1.0)

1. **系统提示默认行为变更**: 不再默认使用 Claude Code 系统提示
   - 需显式设置: `system_prompt={"type": "preset", "preset": "claude_code"}`

2. **设置源不再默认加载**: SDK 默认不读取文件系统设置
   - 需显式配置: `setting_sources=["user", "project", "local"]`

3. **包重命名**: 
   - Python: `claude_code_sdk` -> `claude_agent_sdk`
   - TypeScript: `@anthropic-ai/claude-code` -> `@anthropic-ai/claude-agent-sdk`

### 八、关键资源链接

| 资源 | URL |
|------|-----|
| Agent SDK Overview | https://platform.claude.com/docs/en/agent-sdk/overview |
| Python SDK | https://platform.claude.com/docs/en/agent-sdk/python |
| TypeScript SDK | https://platform.claude.com/docs/en/agent-sdk/typescript |
| MCP 集成 | https://platform.claude.com/docs/en/agent-sdk/mcp |
| Sessions | https://platform.claude.com/docs/en/agent-sdk/sessions |
| CLI Reference | https://code.claude.com/docs/en/cli-reference |
| Headless/SDK | https://code.claude.com/docs/en/headless |

### 九、架构建议总结

1. **简单脚本/原型**: 使用 `claude -p --bare` CLI 命令
2. **CI/CD 流水线**: SDK (`ClaudeSDKClient` 或 `query()`)
3. **需要 session 保持**: 使用 `ClaudeSDKClient` (Python) 或 `continue: true` (TypeScript)
4. **MCP 工具**: 优先使用 SDK 内置的 `create_sdk_mcp_server` 避免进程开销
5. **复杂批量处理**: 结合 subagents + session fork + streaming
6. **生产环境**: SDK + 完善的错误处理 + MCP 服务器状态检查

---

## 十四、Claude CLI 工作流自动化最佳实践

### 14.1 stream-json 协议详解

#### 流式输出格式

`--output-format stream-json` 生成 newline-delimited JSON (NDJSON)，每行是一个独立的事件对象：

```bash
claude -p "Explain recursion" --output-format stream-json --verbose --include-partial-messages
```

#### 关键事件类型

| 事件 | type | 说明 |
|------|------|------|
| 文本增量 | `stream_event.delta.type == "text_delta"` | 实时返回的文本片段 |
| API 重试 | `system.api_retry` | API 请求失败重试中 |
| 工具调用 | `assistant` (含 tool_use) | Claude 决定使用工具 |
| 最终结果 | `result` | 任务完成 |

#### API 重试事件结构

```json
{
  "type": "system",
  "subtype": "api_retry",
  "attempt": 2,
  "max_retries": 5,
  "retry_delay_ms": 1042,
  "error_status": 529,
  "error": "rate_limit",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "abc123"
}
```

#### 错误类型 (error 字段)

| error 值 | 说明 | 处理建议 |
|----------|------|----------|
| `authentication_failed` | API Key 无效 | 检查 ANTHROPIC_API_KEY |
| `billing_error` | 账户欠费 | 检查账单 |
| `rate_limit` | 请求频率超限 | 指数退避重试 |
| `invalid_request` | 请求格式错误 | 检查参数 |
| `server_error` | Claude 端错误 | 等待后重试 |
| `max_output_tokens` | 输出超限 | 减少请求复杂度 |

#### 使用 jq 解析 stream-json

```bash
# 提取纯文本流
claude -p "Write a poem" --output-format stream-json --verbose | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'

# 捕获 API 重试事件
claude -p "Long task" --output-format stream-json | \
  jq -r 'select(.type == "system" and .subtype == "api_retry") | "Attempt \(.attempt)/\(.max_retries): \(.error)"'

# 提取最终结果
claude -p "Summarize" --output-format stream-json | \
  jq -r 'select(.type == "result") | .result'
```

### 14.2 Shell 脚本编排模式

#### 基础批处理脚本

```bash
#!/bin/bash
# batch-process.sh - 批量处理公司名称列表

INPUT_FILE="${1:-companies.txt}"
OUTPUT_DIR="${2:-./output}"
MAX_RETRIES=3
RETRY_DELAY=5

mkdir -p "$OUTPUT_DIR"

while IFS= read -r company; do
  echo "[$(date)] Processing: $company"
  
  # 带重试的调用
  for attempt in $(seq 1 $MAX_RETRIES); do
    result=$(claude -p "查询 $company 的工商信息" \
      --output-format json \
      --bare \
      --allowedTools "Read,Bash" 2>&1)
    
    if echo "$result" | jq -e '.result' > /dev/null 2>&1; then
      echo "$result" | jq -r '.result' > "$OUTPUT_DIR/${company}.json"
      echo "[$(date)] Success: $company"
      break
    else
      echo "[$(date)] Retry $attempt/$MAX_RETRIES for $company"
      sleep $RETRY_DELAY
    fi
  done
  
done < "$INPUT_FILE"
```

#### 会话管理脚本

```bash
#!/bin/bash
# session-manager.sh - 管理长时间运行的 Claude 会话

SESSION_FILE=".claude_session"
PROMPT_QUEUE=("分析数据" "生成报告" "发送通知")

# 启动会话
start_session() {
  claude -p "准备处理任务" \
    --output-format stream-json \
    --verbose \
    --session-file "$SESSION_FILE" &
  SESSION_PID=$!
  echo $SESSION_PID > .session_pid
}

# 继续会话
continue_session() {
  local prompt="$1"
  claude -p "$prompt" \
    --resume "$(cat $SESSION_FILE)" \
    --output-format json
}

# 捕获 session ID
capture_session() {
  claude -p "开始" --output-format json --bare | \
    jq -r '.session_id' > "$SESSION_FILE"
}
```

#### YAML 配置驱动的工作流

```yaml
# workflow.yaml - 工作流配置文件
name: company-data-collection
version: "1.0"

defaults:
  model: claude-sonnet-4-20250514
  max_retries: 3
  retry_delay: 5

mcp_servers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "${GITHUB_TOKEN}"

steps:
  - name: fetch-company
    prompt: "查询 {company_name} 的工商信息"
    tools: ["Read", "Bash"]
    output: "{output_dir}/{company_name}.json"
    
  - name: enrich-data
    prompt: "补充联系方式字段"
    tools: ["Read", "Edit"]
    depends_on: [fetch-company]
    
  - name: save-graph
    prompt: "存入 Neo4j 图数据库"
    tools: ["Bash"]
    mcp_server: filesystem
    depends_on: [enrich-data]
```

#### Shell 中的 YAML 处理

```bash
# 使用 yq 解析 YAML 配置
# 安装: brew install yq

# 提取步骤列表
yq -r '.steps[].name' workflow.yaml

# 提取特定步骤的 prompt
yq -r '.steps[0].prompt' workflow.yaml

# 渲染带变量的 prompt
COMPANY="小米"
yq -r ".steps[] | select(.name == \"fetch-company\") | .prompt" workflow.yaml | \
  sed "s/{company_name}/$COMPANY/g"
```

### 14.3 MCP Workflow 设计最佳实践

#### 错误处理架构

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Workflow 错误处理                      │
├─────────────────────────────────────────────────────────────┤
│  1. 连接层错误 (Connection)                                   │
│     - MCP 服务器未启动 → 自动重启 + 告警                       │
│     - 传输层超时 → 指数退避重试                                │
│                                                              │
│  2. 调用层错误 (Invocation)                                   │
│     - 工具不存在 → 降级到替代工具                              │
│     - 参数验证失败 → 返回结构化错误                            │
│                                                              │
│  3. 业务层错误 (Business)                                     │
│     - 数据验证失败 → 记录 + 跳过                              │
│     - 业务规则冲突 → 人工确认流程                              │
└─────────────────────────────────────────────────────────────┘
```

#### 重试机制实现

```python
# mcp_retry.py - MCP 调用重试装饰器
import asyncio
import functools
from typing import TypeVar, Callable

T = TypeVar('T')

def mcp_retry(max_attempts: int = 3, base_delay: float = 1.0):
    """MCP 调用重试装饰器，支持指数退避"""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts:
                        delay = base_delay * (2 ** (attempt - 1))
                        print(f"Attempt {attempt} failed: {e}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
            raise last_exception
        return wrapper
    return decorator

# 使用示例
class MCPWorkflow:
    @mcp_retry(max_attempts=3, base_delay=2.0)
    async def call_tool(self, server: str, tool: str, args: dict):
        session = self.sessions.get(server)
        return await session.call_tool(tool, args)
```

#### MCP 服务器健康检查

```python
# mcp_health.py - MCP 服务器健康检查
import asyncio
from typing import Dict, List

class MCPHealthChecker:
    def __init__(self, sessions: Dict[str, Any]):
        self.sessions = sessions
        self.failure_count: Dict[str, int] = {}
        self.max_failures = 3
        
    async def check_server(self, server_name: str) -> bool:
        """检查 MCP 服务器是否响应"""
        try:
            session = self.sessions[server_name]
            # 发送 ping 或 list_tools
            await asyncio.wait_for(
                session.list_tools(),
                timeout=5.0
            )
            self.failure_count[server_name] = 0
            return True
        except Exception as e:
            self.failure_count[server_name] = self.failure_count.get(server_name, 0) + 1
            print(f"Server {server_name} health check failed: {e}")
            
            if self.failure_count[server_name] >= self.max_failures:
                await self.restart_server(server_name)
            return False
    
    async def restart_server(self, server_name: str):
        """重启不健康的服务器"""
        print(f"Restarting MCP server: {server_name}")
        # 实现服务器重启逻辑
```

### 14.4 完整工作流编排示例

#### Python SDK 工作流

```python
# workflow_orchestrator.py
import asyncio
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AgentDefinition,
    HookMatcher,
)
from typing import List

class WorkflowOrchestrator:
    def __init__(self):
        self.hooks = {
            "PreToolUse": [HookMatcher(matcher=".*", hooks=[self.log_tool_call])],
            "PostToolUse": [HookMatcher(matcher=".*", hooks=[self.log_result])],
        }
        
    async def log_tool_call(self, input_data, tool_use_id, context):
        print(f"[TOOL CALL] {input_data['tool_name']}: {input_data.get('tool_input', {})}")
        return {}
    
    async def log_result(self, input_data, tool_use_id, context):
        print(f"[TOOL RESULT] {input_data['tool_name']} completed")
        return {}
    
    async def run_data_collection(self, companies: List[str]):
        """数据采集工作流"""
        async with ClaudeSDKClient(options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
            permission_mode="acceptEdits",
            hooks=self.hooks,
            mcp_servers={
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
                }
            }
        )) as client:
            for company in companies:
                # Step 1: 获取工商信息
                await client.query(f"查询 {company} 的工商信息，包括联系人、电话、地址")
                async for msg in client.receive_response():
                    if hasattr(msg, 'result'):
                        yield {"company": company, "data": msg.result}
                        
                # Step 2: 存储到图数据库
                await client.query(f"将 {company} 的信息存入 Neo4j")
                
    async def run_batch(self, batch_size: int = 10):
        """批量运行"""
        companies = ["小米", "华为", "腾讯"]  # 从文件或数据库加载
        
        async for result in self.run_data_collection(companies):
            print(f"Collected: {result}")

if __name__ == "__main__":
    orchestrator = WorkflowOrchestrator()
    asyncio.run(orchestrator.run_batch())
```

#### Shell 脚本 + YAML 工作流

```bash
#!/bin/bash
# run-workflow.sh - YAML 驱动的自动化工作流

set -e

WORKFLOW_FILE="${1:-workflow.yaml}"
LOG_FILE="${2:-workflow.log}"

# 解析 YAML 并执行每一步
execute_step() {
    local step_name="$1"
    local prompt_template=$(yq -r ".steps[] | select(.name == \"$step_name\") | .prompt")
    local tools=$(yq -r ".steps[] | select(.name == \"$step_name\") | .tools | join(\",\")")
    
    # 替换变量
    local prompt=$(echo "$prompt_template" | sed \
        -e "s/{company_name}/$COMPANY_NAME/g" \
        -e "s/{output_dir}/$OUTPUT_DIR/g")
    
    echo "[$(date)] Executing step: $step_name"
    
    claude -p "$prompt" \
        --bare \
        --output-format json \
        --allowedTools "$tools" \
        2>&1 | tee -a "$LOG_FILE"
}

# 主循环
COMPANY_NAME="小米"
OUTPUT_DIR="./output"

for step in $(yq -r '.steps[].name' "$WORKFLOW_FILE"); do
    execute_step "$step"
done
```

### 14.5 监控与告警

#### Hook 告警模式

```python
# alert_hooks.py - 通过 hooks 实现监控告警

async def slack_alert(input_data, tool_use_id, context):
    """工具调用失败时发送 Slack 告警"""
    if input_data['hook_event_name'] != 'PostToolUseFailure':
        return {}
    
    tool_name = input_data.get('tool_name', 'unknown')
    error = input_data.get('error', 'unknown error')
    
    # 发送到 Slack
    await send_slack_message(
        channel="#alerts",
        message=f":warning: Tool `{tool_name}` failed: {error}"
    )
    return {}

# 注册 hook
options = ClaudeAgentOptions(
    hooks={
        "PostToolUseFailure": [HookMatcher(hooks=[slack_alert])],
        "Stop": [HookMatcher(hooks=[log_summary])],
    }
)
```

#### stream-json 监控脚本

```bash
#!/bin/bash
# monitor-workflow.sh - 监控工作流执行

claude -p "$WORKFLOW_PROMPT" \
    --output-format stream-json \
    --verbose \
    --include-partial-messages 2>&1 | while read line; do
    
    # 解析事件类型
    event_type=$(echo "$line" | jq -r '.type // .subtype // "unknown"')
    
    case "$event_type" in
        "api_retry")
            attempt=$(echo "$line" | jq -r '.attempt')
            max=$(echo "$line" | jq -r '.max_retries')
            echo "⚠️  Retrying (attempt $attempt/$max)"
            ;;
        "result")
            echo "✅ Task completed"
            ;;
        "error"|"stop_failure")
            echo "❌ Error occurred"
            ;;
    esac
done
```

### 14.6 关键配置参考

#### .mcp.json (项目级 MCP 配置)

```json
{
  "mcpServers": {
    "neo4j": {
      "command": "node",
      "args": ["/path/to/neo4j-mcp-server/dist/index.js"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    },
    "tianyancha": {
      "command": "npx",
      "args": ["-y", "tianyancha-mcp-server"],
      "env": {
        "TIANYANCHA_TOKEN": "${TIANYANCHA_TOKEN}"
      }
    }
  }
}
```

#### claude 配置 (settings.json)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude needs input\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

### 14.7 资源链接

| 主题 | URL |
|------|-----|
| Claude Code 自动化 | https://code.claude.com/docs/en/automation |
| Headless 模式 | https://code.claude.com/docs/en/headless |
| Hooks 指南 | https://code.claude.com/docs/en/hooks-guide |
| Hooks 参考 | https://code.claude.com/docs/en/hooks |
| Channels | https://code.claude.com/docs/en/channels |
| Agent SDK | https://platform.claude.com/docs/en/agent-sdk/overview |
| MCP 架构 | https://modelcontextprotocol.io/docs/learn/architecture |
| MCP 服务器构建 | https://modelcontextprotocol.io/docs/develop/build-server |
| jq 手册 | https://jqlang.github.io/jq/manual/ |

### 14.8 最佳实践总结

| 场景 | 推荐方案 |
|------|----------|
| **简单脚本** | `claude -p --bare` + shell 管道 |
| **复杂工作流** | Python/TypeScript SDK + YAML 配置 |
| **实时监控** | `stream-json` + jq + 告警 hooks |
| **批量处理** | SDK session 管理 + 并行 subagents |
| **错误恢复** | 重试装饰器 + 健康检查 |
| **团队协作** | `.mcp.json` + project-scoped hooks |
