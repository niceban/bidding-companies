# 区县中标数据采集 Prompt

## 任务

使用 Playwright MCP + Neo4j MCP 采集 **{PROVINCE}省{CITY}{DISTRICT}** 公共资源交易平台的中标公告数据。

## 采集流程

1. 从 {CITY} 平台导航进入 {DISTRICT} 专区
2. 找到"中标公告"栏目
3. 提取 {DISTRICT} 最新 10 条中标记录
4. 存入 Neo4j，带上省-市-区县标签

## Neo4j 存储

```cypher
// 确保省份存在
MERGE (p:Province {name: '{PROVINCE}'})

// 确保城市存在
MERGE (p)-[:HAS_CITY]->(c:City {name: '{CITY}'})
SET c.province = '{PROVINCE}'

// 确保区县存在
MERGE (c)-[:HAS_DISTRICT]->(d:District {name: '{DISTRICT}'})
SET d.city = '{CITY}', d.province = '{PROVINCE}'

// 创建项目
CREATE (d)-[:HAS_PROJECT]->(pr:Project {
    name: '项目名称',
    amount: 金额,
    date: '日期',
    url: '链接',
    province: '{PROVINCE}',
    city: '{CITY}',
    district: '{DISTRICT}',
    collected_at: datetime()
})

// 创建公司并建立关系
MERGE (co:Company {name: '中标公司'})
CREATE (co)-[:WIN_BID {
    amount: 金额,
    date: '日期',
    province: '{PROVINCE}',
    city: '{CITY}',
    district: '{DISTRICT}'
}]->(pr)
```

## 返回

{DISTRICT} 采集结果摘要
