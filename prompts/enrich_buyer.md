# 企业信息补全 Prompt - Buyer 关联方案

## 任务

通过 Neo4j 关联查询，提取中标公司对应的采购单位联系人信息。

## 背景

政府采购中标数据中，中标公司的联系方式往往不公开，但**采购单位（Buyer）的联系人信息往往公开率更高**。

通过以下关系关联：
```
(Company)-[:WIN_BID]->(Project)<-[:BY]-(Buyer)
```

## 查询语句

```cypher
// 查询所有中标公司及其采购单位联系人
MATCH (c:Company)-[:WIN_BID]->(p:Project)
OPTIONAL MATCH (p)-[:BY]->(b:Buyer)
WHERE b.contact IS NOT NULL OR b.phone IS NOT NULL
RETURN
    c.name as 中标公司,
    p.name as 项目名称,
    b.name as 采购单位,
    b.contact as 联系人,
    b.phone as 联系电话
ORDER BY c.name
```

## 实际应用

对于销售场景：
- **中标公司** → 需要联系这家公司
- **采购单位联系人** → 知道项目需求的人

可以组合使用：
1. 中标公司名称 → 用于开场白
2. 采购单位联系人 → 直接决策人
3. 采购单位电话 → 直接联系方式

## 返回格式

请返回：
1. 关联成功的记录数
2. 每条记录的完整联系链：公司 → 项目 → 采购单位 → 联系人 → 电话
