# 数据分析 Prompt

## 任务

从 Neo4j 数据库查询中标数据，进行统计分析和洞察提炼。

## 查询语句

### 1. 基础统计

```cypher
// 中标金额TOP10
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN c.name as 公司, p.name as 项目, r.amount as 中标金额
ORDER BY r.amount DESC
LIMIT 10

// 各省中标数量
MATCH (p:Project)
RETURN p.province as 省份, count(p) as 中标数量
ORDER BY 中标数量 DESC
LIMIT 10

// 中标金额按省份汇总
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN p.province as 省份, sum(r.amount) as 总金额, count(*) as 项目数
ORDER BY 总金额 DESC
```

### 2. 公司分析

```cypher
// 中标最多的公司
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
RETURN c.name as 公司, count(r) as 中标次数, sum(r.amount) as 总金额
ORDER BY 中标次数 DESC
LIMIT 10

// 公司的中标项目列表
MATCH (c:Company {name: '公司名称'})-[r:WIN_BID]->(p:Project)
RETURN p.name as 项目, r.amount as 金额, r.date as 日期
ORDER BY r.date DESC
```

### 3. 时间分析

```cypher
// 按月统计中标
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
WHERE r.date >= '2026-01-01'
RETURN substr(r.date, 1, 7) as 月份, count(*) as 中标数, sum(r.amount) as 总金额
ORDER BY 月份

// 本月 vs 上月
MATCH (c:Company)-[r:WIN_BID]->(p:Project)
WHERE r.date >= '2026-02-01'
RETURN '2026年2月' as 月份, count(*) as 中标数, sum(r.amount) as 总金额
```

### 4. 补全率分析

```cypher
// 有联系方式的公司
MATCH (c:Company)
WHERE c.phone IS NOT NULL OR c.email IS NOT NULL
RETURN count(c) as 已补全, collect(c.name)[0..5] as 示例

// 补全率
MATCH (c:Company)
WITH count(c) as 总数
MATCH (c:Company)
WHERE c.phone IS NOT NULL
WITH 总数, count(c) as 已补全
RETURN 已补全, 总数, (toFloat(已补全) / 总数 * 100) as 补全率
```

## 分析要求

1. **数据概览**：总中标数、总金额、平均金额
2. **TOP 分析**：中标最多的公司、金额最大的项目
3. **趋势分析**：月度中标趋势
4. **补全评估**：联系方式覆盖率
5. **洞察提炼**：发现的问题和机会

## 返回格式

请返回：
1. 统计图表（ASCII）
2. 关键发现
3. 建议和下一步
