# 城市中标数据采集+企业信息补全 Prompt

## 任务

采集 {PROVINCE}{CITY} 的中标公告数据，并**立即补全中标企业的联系方式**，全流程一次完成。

## 步骤

### 第一步：采集中标数据

1. 使用 Playwright MCP 访问 ggzyjy.shandong.gov.cn
2. 导航到 {CITY} 专区
3. 提取该城市所有中标公告（至少 10 条）
4. 每条公告包含：项目名、金额、日期、中标公司、采购单位

### 第二步：存入 Neo4j（必须用 MERGE）

```cypher
// 1. 省市关系
MERGE (p:Province {name: '{PROVINCE}'})
MERGE (c:City {name: '{CITY}'})
MERGE (p)-[:HAS_CITY]->(c)

// 2. 项目节点（含采购单位）
MERGE (pr:Project {name: '项目名称', city: '{CITY}'})
SET pr.amount = 金额, pr.date = '日期', pr.province = '{PROVINCE}'
SET pr.buyer_name = '采购单位名称'

// 3. 采购单位节点
MERGE (b:Buyer {name: '采购单位名称'})
SET b.contact = '联系人', b.phone = '联系电话'

// 4. 中标公司节点
MERGE (co:Company {name: '中标公司'})

// 5. 关系
MERGE (co)-[:WIN_BID {amount: 金额, date: '日期'}]->(pr)
MERGE (pr)-[:BY]->(b)
```

### 第三步：立即补全企业联系方式

对于每个中标公司，**立即**执行以下补全（不等后续步骤）：

#### 3.1 百度搜索补全

使用 Playwright 百度搜索：
```
搜索: "{公司名称}" 联系方式
搜索: "{公司名称}" 电话
搜索: "{公司名称}" 地址
```

#### 3.2 Buyer 关联查询

通过项目关联的采购单位获取联系人：
```cypher
MATCH (co:Company {name: '中标公司'})-[:WIN_BID]->(p:Project)<-[:BY]-(b:Buyer)
RETURN b.name as 采购单位, b.contact as 联系人, b.phone as 采购单位电话
```

#### 3.3 更新公司信息

```cypher
MATCH (co:Company {name: '中标公司'})
SET co.phone = '补全的电话',
    co.email = '补全的邮箱',
    co.address = '补全的地址',
    co.website = '补全的官网',
    co.enriched = true,
    co.enriched_at = datetime()
```

## 补全优先级

1. **Buyer 关联**（最高）：通过 `(Company)-[:WIN_BID]->(Project)<-[:BY]-(Buyer)` 关系，采购单位联系人公开率 93%
2. **百度搜索**（次之）：搜索公司名称+联系方式

## 完整流程示例

```
采集 {济南市} → 创建 Company/Project/Buyer 节点 → 立即补全每个公司的电话/邮箱/地址 → 存储完整数据
```

## 返回

请返回：
1. 采集到的中标公告数量
2. 每家中标公司的补全结果（电话、邮箱、地址、采购单位联系人）
3. 未能补全的公司及原因
4. 最终存入 Neo4j 的数据摘要
