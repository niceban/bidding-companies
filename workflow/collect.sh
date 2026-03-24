#!/bin/bash
#==============================================================================
# 采集工作流 - 按省份采集中标数据
#==============================================================================

set -e

PROVINCE=${1:-山东省}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/collect_${PROVINCE}_${TIMESTAMP}.log"

# 省份 URL 映射
declare -A PROVINCE_URLS
PROVINCE_URLS["山东省"]="https://ggzyjy.shandong.gov.cn"
PROVINCE_URLS["江苏省"]="https://jsggzy.jszwfw.gov.cn"
PROVINCE_URLS["浙江省"]="https://www.zjpsebi.com"
PROVINCE_URLS["广东省"]="http://ygp.gdzwfw.gov.cn"
PROVINCE_URLS["四川省"]="https://ggzyjy.sc.gov.cn"
PROVINCE_URLS["河南省"]="http://hnsggzy.hnzwfw.gov.cn"
PROVINCE_URLS["湖北省"]="https://www.hbggzy.cn"
PROVINCE_URLS["湖南省"]="https://www.hnsggzy.com"
PROVINCE_URLS["安徽省"]="https://ggzy.ah.gov.cn"
PROVINCE_URLS["福建省"]="https://ggzy.fj.gov.cn"
PROVINCE_URLS["江西省"]="https://www.jxggzy.cn"
PROVINCE_URLS["河北省"]="http://www.hebpr.gov.cn"
PROVINCE_URLS["山西省"]="https://prec.sxzwfw.gov.cn"
PROVINCE_URLS["辽宁省"]="https://www.lngg.gov.cn"
PROVINCE_URLS["吉林省"]="https://www.jlggzy.cn"
PROVINCE_URLS["黑龙江省"]="https://www.hljggzy.org.cn"
PROVINCE_URLS["北京市"]="https://ggzyfw.beijing.gov.cn"
PROVINCE_URLS["天津市"]="https://www.tjggzy.cn"
PROVINCE_URLS["上海市"]="https://ciac.zjw.sh.gov.cn"
PROVINCE_URLS["重庆市"]="https://www.cqggzy.com"
PROVINCE_URLS["内蒙古"]="https://ggzyjy.nmg.gov.cn"
PROVINCE_URLS["广西"]="https://ggzyjy.gxzf.gov.cn"
PROVINCE_URLS["宁夏"]="https://www.nxggzyjy.org"
PROVINCE_URLS["新疆"]="https://ggzy.xinjiang.gov.cn"
PROVINCE_URLS["西藏"]="https://ggzy.xizang.gov.cn"
PROVINCE_URLS["海南省"]="https://zzb.hainan.gov.cn"
PROVINCE_URLS["贵州省"]="https://ggzy.guizhou.gov.cn"
PROVINCE_URLS["云南省"]="https://www.ynggzy.com"
PROVINCE_URLS["陕西省"]="https://www.sxggzy.com.cn"
PROVINCE_URLS["甘肃省"]="https://ggzyjy.gansu.gov.cn"
PROVINCE_URLS["青海省"]="https://qinghai.gov.cn"
PROVINCE_URLS["辽宁省"]="https://www.lngg.gov.cn"

URL="${PROVINCE_URLS[$PROVINCE]:-https://ggzyjy.shandong.gov.cn}"

echo "=========================================="
echo "采集 $PROVINCE 中标数据"
echo "URL: $URL"
echo "=========================================="

# 执行采集 Prompt
claude -p "
## 任务
使用 Playwright MCP + Neo4j MCP 采集 $PROVINCE 省的中标公告数据。

## 步骤
1. 访问 $URL
2. 找到'中标公告'或'结果公告'栏目
3. 提取 10 条最新的工程中标公告：
   - 项目名称
   - 中标供应商
   - 中标金额
   - 中标日期
   - 采购单位
4. 将数据存入 Neo4j：
   - Company 节点
   - Project 节点（带 province 属性）
   - WIN_BID 关系

## 返回
采集结果摘要
" --dangerously-skip-permissions --bare 2>&1 | tee "$LOG_FILE"

echo ""
echo "采集完成，日志保存到: $LOG_FILE"
