# 企业信息补全 Prompt

## 任务

通过 Playwright MCP 搜索公开来源，补全 Neo4j 中公司的联系方式。

## 补全方式

### 1. 百度搜索补全

使用百度搜索以下信息：
- `"{公司名称}" 联系方式`
- `"{公司名称}" 电话`
- `"{公司名称}" 地址`
- `"{公司名称}" 官网`

### 2. 提取的信息

| 字段 | 说明 |
|------|------|
| phone | 联系电话 |
| email | 电子邮箱 |
| address | 公司地址 |
| website | 官方网站 |

## 搜索示例

```
搜索: "安丘市畅通路桥工程有限公司 联系方式"
结果:
- 电话: 15063642580
- 地址: 山东省潍坊市安丘市大汶河旅游开发区文化路北首路东
- 邮箱: 8273294@qq.com
```

## Neo4j 更新

将补全的信息更新到 Neo4j：

```cypher
MATCH (c:Company {name: '公司名称'})
SET c.phone = '电话',
    c.email = '邮箱',
    c.address = '地址',
    c.website = '官网',
    c.enriched = true,
    c.enriched_at = datetime()
RETURN c.name, c.phone, c.email
```

## 返回格式

请返回：
1. 补全成功的公司数量
2. 每家公司的补全信息
3. 未能补全的公司及原因
