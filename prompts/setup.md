## 任务
使用 Neo4j MCP 创建全国中标数据采集的图数据库 Schema。

## Schema 创建

### 1. 节点类型（四层嵌套）
- Province (省份): name, url
- City (城市): name, province, url
- District (区县): name, city, province, url
- Project (项目): name, amount, date, url, category, collected_at
- Company (公司): name, phone, email, address, website, enriched
- Buyer (采购单位): name, contact, phone

### 2. 关系类型
- (Province)-[:HAS_CITY]->(City)  省-市关系（带 province 属性）
- (City)-[:HAS_DISTRICT]->(District)  市-区县关系（带 city 属性）
- (District)-[:HAS_PROJECT]->(Project)  区县-项目关系
- (Company)-[:WIN_BID]->(Project)  中标关系（带 amount, date, province, city, district 属性）
- (Project)-[:BY]->(Buyer)  采购单位关系

### 3. 约束和索引
- Company.name 唯一约束
- Project.name 唯一约束
- Province.name 唯一约束
- City.name + Province.name 复合索引（确保同省城市名唯一）
- District.name + City.name 复合索引（确保同市区县名唯一）

### 4. 山东省示例数据
创建山东省17个地市节点：
济南市、青岛市、淄博市、枣庄市、东营市、烟台市、潍坊市、济宁市、泰安市、威海市、日照市、临沂市、德州市、聊城市、滨州市、菏泽市

创建各地市对应的区县节点（从平台导航提取）。

## 省份数据
创建 32 个省份节点：
北京市、天津市、上海市、重庆市、河北省、山西省、辽宁省、吉林省、黑龙江省、江苏省、浙江省、安徽省、福建省、江西省、山东省、河南省、湖北省、湖南省、广东省、海南省、四川省、贵州省、云南省、陕西省、甘肃省、青海省、内蒙古、广西、宁夏、新疆、西藏

## 返回
Schema 创建结果
