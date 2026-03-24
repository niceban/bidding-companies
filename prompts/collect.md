# 中标数据采集 Prompt

## 任务

使用 Playwright MCP + Neo4j MCP 采集 {PROVINCE} 省政府公共资源交易平台中标公告数据。

## 采集要求

1. 访问 https://ggzyjy.shandong.gov.cn
2. 找到"中标公告"栏目
3. 提取最新 10 条中标记录（含：项目名称、中标公司、中标金额、中标日期、采购单位）
4. 存入 Neo4j，带上省份标签

## Neo4j 存储

```cypher
// 创建省份节点
MERGE (p:Province {name: '{PROVINCE}'})

// 创建项目
CREATE (pr:Project {
    name: '项目名称',
    amount: 金额,
    date: '日期',
    url: '链接',
    province: '{PROVINCE}',
    collected_at: datetime()
})

// 创建公司
MERGE (co:Company {name: '中标公司'})
CREATE (co)-[:WIN_BID {amount: 金额, date: '日期', province: '{PROVINCE}'}]->(pr)
```

## 返回

采集结果摘要
