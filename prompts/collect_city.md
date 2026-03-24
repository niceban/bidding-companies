# 城市中标数据采集 Prompt

## 任务

采集 {PROVINCE}{CITY} 的中标公告数据。

## 步骤

1. 使用 Playwright MCP 访问 ggzyjy.shandong.gov.cn
2. 导航到 {CITY} 专区
3. 提取 5 条中标公告（含：项目名、金额、日期、中标公司）
4. 用 Neo4j MCP 存入 Neo4j（**必须用 MERGE**）

## Neo4j 存储（必须用 MERGE 避免重复）

```cypher
// 用 MERGE 避免重复创建城市
MERGE (p:Province {name: '{PROVINCE}'})
MERGE (p)-[:HAS_CITY]->(c:City {name: '{CITY}'})

// 用 MERGE 避免重复创建项目
MERGE (pr:Project {name: '项目名称', city: '{CITY}'})
SET pr.amount = 金额, pr.date = '日期', pr.province = '{PROVINCE}'

// 用 MERGE 避免重复创建公司
MERGE (co:Company {name: '中标公司'})
MERGE (co)-[:WIN_BID {amount: 金额, date: '日期'}]->(pr)
```

## 返回

采集结果摘要
