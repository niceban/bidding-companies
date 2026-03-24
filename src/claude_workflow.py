"""
全国工程中标数据采集 - 基于 claude-node 的工作流引擎
核心：claude-node + MCP + 状态持久化
支持定时任务和断点续传
"""

import os
import json
import time
import subprocess
from datetime import datetime
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass, field, asdict
from pathlib import Path

from claude_node import ClaudeController


@dataclass
class WorkflowState:
    """工作流状态"""
    workflow_id: str
    current_step: int = 0
    session_id: str = ""
    completed_steps: List[str] = field(default_factory=list)
    failed_steps: List[str] = field(default_factory=list)
    provinces_collected: List[str] = field(default_factory=list)
    companies_enriched: List[str] = field(default_factory=list)
    last_run: str = ""
    status: str = "pending"  # pending, running, completed, failed
    error_message: str = ""


class BidWorkflow:
    """
    中标数据采集工作流引擎

    基于 claude-node 的多步骤工作流：
    1. setup - 初始化系统
    2. collect - 采集中标数据
    3. enrich - 补全企业信息
    4. analyze - 数据分析
    """

    def __init__(self, workspace: str = None):
        self.workspace = workspace or os.getcwd()
        self.state_file = os.path.join(self.workspace, ".workflow", "state.json")
        self.state = self._load_state()
        self.prompts_dir = os.path.join(self.workspace, "prompts")
        self.logs_dir = os.path.join(self.workspace, "workflow", "logs")

        # 继承 MiniMax API key（如果有）
        self.minimax_key = os.environ.get("MINIMAX_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")

        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)

    def _load_state(self) -> WorkflowState:
        """加载工作流状态"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    return WorkflowState(**data)
            except:
                pass
        return WorkflowState(workflow_id=f"bid_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    def _save_state(self):
        """保存工作流状态"""
        self.state.last_run = datetime.now().isoformat()
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(asdict(self.state), f, indent=2)

    def _log(self, step: str, message: str):
        """记录日志"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_file = os.path.join(self.logs_dir, f"{step}_{self.state.workflow_id}.log")
        with open(log_file, 'a') as f:
            f.write(f"[{timestamp}] {message}\n")
        print(f"[{step}] {message}")

    def run_step(self, step_name: str, prompt_file: str, context: Dict[str, str] = None) -> bool:
        """
        执行单个工作流步骤

        Args:
            step_name: 步骤名称
            prompt_file: Prompt 模板文件
            context: 模板变量，如 {"province": "山东省"}

        Returns:
            是否成功
        """
        if step_name in self.state.completed_steps:
            self._log(step_name, "跳过（已完成）")
            return True

        self._log(step_name, f"开始执行...")
        self.state.status = "running"
        self._save_state()

        try:
            # 读取 Prompt
            prompt_path = os.path.join(self.prompts_dir, f"{prompt_file}.md")
            if os.path.exists(prompt_path):
                with open(prompt_path, 'r') as f:
                    prompt = f.read()
            else:
                prompt = prompt_file  # 直接使用字符串作为 Prompt

            # 替换模板变量
            if context:
                for key, value in context.items():
                    prompt = prompt.replace(f"{{{key}}}", value)

            # 执行任务
            with ClaudeController(
                skip_permissions=True,
                resume=self.state.session_id or None
            ) as ctrl:
                # 保存 session_id 用于恢复
                if hasattr(ctrl, 'session_id'):
                    self.state.session_id = ctrl.session_id

                result = ctrl.send(prompt, timeout=600)

                if result and result.result_text:
                    self._log(step_name, f"完成: {result.result_text[:200]}...")
                    self.state.completed_steps.append(step_name)
                    self.state.status = "completed"
                    self._save_state()
                    return True
                else:
                    raise Exception("No result from Claude")

        except Exception as e:
            self._log(step_name, f"失败: {e}")
            self.state.failed_steps.append(step_name)
            self.state.error_message = str(e)
            self.state.status = "failed"
            self._save_state()
            return False

    def setup(self) -> bool:
        """初始化系统"""
        return self.run_step("setup", "setup")

    def collect_province(self, province: str) -> bool:
        """采集单个省份"""
        return self.run_step(f"collect_{province}", "collect", {"PROVINCE": province})

    def enrich(self) -> bool:
        """补全企业信息"""
        return self.run_step("enrich", "enrich")

    def analyze(self) -> bool:
        """数据分析"""
        return self.run_step("analyze", "analyze")

    def run_full(self, provinces: List[str] = None) -> bool:
        """
        运行完整工作流 - 省市县逐个遍历

        Args:
            provinces: 要采集的省份列表
        """
        provinces = provinces or ["山东省"]

        self._log("workflow", f"开始完整工作流，共 {len(provinces)} 个省份")

        # 1. 初始化
        if not self.setup():
            return False

        # 2. 采集省份
        for province in provinces:
            if not self.collect_province(province):
                self._log("workflow", f"采集 {province} 失败，继续下一个")
            else:
                self.state.provinces_collected.append(province)
                self._save_state()

        # 3. 补全
        if not self.enrich():
            self._log("workflow", "补全失败")

        # 4. 分析
        if not self.analyze():
            self._log("workflow", "分析失败")

        self._log("workflow", "工作流完成")
        return True

    def run_province_cities(self, province: str) -> bool:
        """
        采集指定省份的所有城市（采集+补全一体化）
        每个城市采集后立即补全企业信息，无需后续单独补全步骤
        claude-node优势：保持会话，逐个处理
        """
        # 山东省17地市
        cities = [
            "济南市", "青岛市", "淄博市", "枣庄市", "东营市",
            "烟台市", "潍坊市", "济宁市", "泰安市", "威海市",
            "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"
        ]

        self._log("workflow", f"开始采集 {province} 下 {len(cities)} 个城市（采集+补全一体化）")

        # 1. 采集+补全所有城市（增量：跳过已采集的）
        for city in cities:
            step_name = f"collect_enrich_{province}_{city}"
            if step_name in self.state.completed_steps:
                self._log("city", f"{province}_{city} 已采集补全，跳过")
                continue

            self._log("city", f"开始采集+补全 {city}...")
            if self.collect_enrich_city(province, city):
                self._log("city", f"{city} 采集+补全完成")
            else:
                self._log("city", f"{city} 采集失败，继续下一个")

        self._log("workflow", f"{province} 全部城市采集+补全完成")

        # 2. 数据分析（单独步骤，不依赖具体公司数据）
        self._log("workflow", "开始数据分析...")
        self.analyze()

        self._log("workflow", f"{province} 完整工作流完成")
        return True

    def run_all(self) -> bool:
        """
        全国大循环：遍历所有省份和城市
        从 Neo4j 获取省份列表，增量采集未采集的城市
        """
        # 全国31省份
        all_provinces = [
            "北京市", "天津市", "上海市", "重庆市",
            "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省",
            "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省", "河南省",
            "湖北省", "湖南省", "广东省", "海南省", "四川省", "贵州省",
            "云南省", "陕西省", "甘肃省", "青海省", "内蒙古", "广西",
            "宁夏", "新疆", "西藏"
        ]

        # 各省地市映射
        province_cities = {
            "山东省": ["济南市", "青岛市", "淄博市", "枣庄市", "东营市",
                      "烟台市", "潍坊市", "济宁市", "泰安市", "威海市",
                      "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"],
            "江苏省": ["南京市", "无锡市", "徐州市", "常州市", "苏州市", "南通市",
                      "连云港市", "淮安市", "盐城市", "扬州市", "镇江市", "泰州市", "宿迁市"],
            "浙江省": ["杭州市", "宁波市", "温州市", "嘉兴市", "湖州市",
                      "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市"],
            "广东省": ["广州市", "深圳市", "珠海市", "汕头市", "佛山市", "韶关市",
                      "湛江市", "肇庆市", "江门市", "茂名市", "惠州市", "梅州市",
                      "汕尾市", "河源市", "阳江市", "清远市", "东莞市", "中山市",
                      "潮州市", "揭阳市", "云浮市"],
            # 其他省份可以继续添加...
        }

        # 默认使用山东省
        if not province_cities:
            province_cities = {"山东省": ["济南市", "青岛市", "淄博市", "枣庄市", "东营市",
                                          "烟台市", "潍坊市", "济宁市", "泰安市", "威海市",
                                          "日照市", "临沂市", "德州市", "聊城市", "滨州市", "菏泽市"]}

        self._log("workflow", f"开始全国大循环，共 {len(all_provinces)} 个省份")

        for province in all_provinces:
            cities = province_cities.get(province, [])

            if not cities:
                # 如果没有地市列表，尝试采集（至少采集省级数据）
                self._log("workflow", f"采集 {province}（无地市列表，仅采集省级）")
                self.collect_province(province)
                continue

            self._log("workflow", f"开始采集 {province} 下 {len(cities)} 个城市")

            # 采集+补全所有城市
            for city in cities:
                # 检查是否已采集（通过 completed_steps 判断）
                step_name = f"collect_enrich_{province}_{city}"
                if step_name in self.state.completed_steps:
                    self._log("city", f"{province}_{city} 已采集补全，跳过")
                    continue

                self._log("city", f"开始采集+补全 {city}...")
                if self.collect_enrich_city(province, city):
                    self._log("city", f"{city} 采集+补全完成")
                else:
                    self._log("city", f"{city} 采集失败，继续下一个")

        self._log("workflow", "全国采集+补全完成")

        # 数据分析
        self._log("workflow", "开始数据分析...")
        self.analyze()

        self._log("workflow", "全国大循环完成")
        return True

    def collect_city(self, province: str, city: str) -> bool:
        """
        采集单个城市 - 存入会话状态
        """
        step_name = f"collect_{province}_{city}"
        return self.run_step(step_name, "collect_city", {
            "PROVINCE": province,
            "CITY": city
        })

    def collect_enrich_city(self, province: str, city: str) -> bool:
        """
        采集单个城市并立即补全企业信息 - 一体化流程

        采集后立即执行：
        1. 百度搜索补全公司联系方式
        2. Buyer关联查询补全联系人
        3. 存储完整信息到Neo4j
        """
        step_name = f"collect_enrich_{province}_{city}"
        return self.run_step(step_name, "collect_enrich_city", {
            "PROVINCE": province,
            "CITY": city
        })

    def run_city_districts(self, province: str, city: str) -> bool:
        """
        逐个遍历城市下的所有区县
        """
        # 济南市各区县
        districts = [
            "历下区", "市中区", "槐荫区", "天桥区", "历城区",
            "长清区", "章丘区", "济阳区", "莱芜区", "钢城区",
            "平阴县", "商河县"
        ]

        self._log("workflow", f"开始采集 {city} 下 {len(districts)} 个区县")

        for district in districts:
            self._log("district", f"开始采集 {district}...")
            if self.collect_district(province, city, district):
                self._log("district", f"{district} 采集完成")
            else:
                self._log("district", f"{district} 采集失败，继续下一个")

        return True

    def collect_district(self, province: str, city: str, district: str) -> bool:
        """
        采集单个区县
        """
        step_name = f"collect_{province}_{city}_{district}"
        return self.run_step(step_name, "collect_district", {
            "PROVINCE": province,
            "CITY": city,
            "DISTRICT": district
        })

    def enrich_buyer_contacts(self) -> bool:
        """
        通过 Buyer 关联查询补全联系人
        利用采购单位联系人信息（93%完整率）
        """
        return self.run_step("enrich_buyer", "enrich_buyer")

    def resume(self) -> bool:
        """从上次失败的步骤恢复"""
        self._log("workflow", "尝试恢复工作流...")

        if self.state.status == "running":
            # 找到失败的步骤
            if self.state.failed_steps:
                failed_step = self.state.failed_steps[-1]
                self._log("workflow", f"重试失败步骤: {failed_step}")
                self.state.failed_steps.remove(failed_step)
                return self.run_step(failed_step, failed_step)

        return self.run_full(self.state.provinces_collected)

    def get_status(self) -> Dict:
        """获取工作流状态"""
        return {
            "workflow_id": self.state.workflow_id,
            "status": self.state.status,
            "current_step": self.state.current_step,
            "completed_steps": self.state.completed_steps,
            "failed_steps": self.state.failed_steps,
            "provinces_collected": self.state.provinces_collected,
            "last_run": self.state.last_run
        }


def main():
    """CLI 入口"""
    import sys

    workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if len(sys.argv) < 2:
        print("用法: python claude_workflow.py <command>")
        print("命令:")
        print("  start                    - 一键启动全流程（采集+补全+分析）")
        print("  all                      - 全国大循环（31省份，增量采集）")
        print("  setup                    - 初始化 Neo4j Schema")
        print("  cities <省>             - 采集该省所有城市（推荐）")
        print("  collect-city <省> <市>  - 采集单个城市")
        print("  districts <省> <市>     - 采集该市所有区县")
        print("  enrich                  - 补全 Company 信息（百度搜索）")
        print("  enrich-buyer            - 补全 Buyer 联系人（关联查询）")
        print("  analyze                  - 数据分析")
        print("  resume                   - 断点续传")
        print("  status                  - 查看状态")
        sys.exit(1)

    workflow = BidWorkflow(workspace)
    cmd = sys.argv[1]

    if cmd == "setup":
        workflow.setup()
    elif cmd == "collect" and len(sys.argv) > 2:
        workflow.collect_province(sys.argv[2])
    elif cmd == "collect-city" and len(sys.argv) > 3:
        workflow.collect_city(sys.argv[2], sys.argv[3])
    elif cmd == "collect-district" and len(sys.argv) > 4:
        workflow.collect_district(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "cities" and len(sys.argv) > 2:
        workflow.run_province_cities(sys.argv[2])
    elif cmd == "all":
        workflow.run_all()
    elif cmd == "districts" and len(sys.argv) > 3:
        workflow.run_city_districts(sys.argv[2], sys.argv[3])
    elif cmd == "start":
        # 一键启动全流程
        province = sys.argv[2] if len(sys.argv) > 2 else "山东省"
        workflow.run_province_cities(province)
    elif cmd == "enrich":
        workflow.enrich()
    elif cmd == "enrich-buyer":
        workflow.enrich_buyer_contacts()
    elif cmd == "analyze":
        workflow.analyze()
    elif cmd == "full":
        provinces = sys.argv[2:] if len(sys.argv) > 2 else ["山东省"]
        workflow.run_full(provinces)
    elif cmd == "resume":
        workflow.resume()
    elif cmd == "status":
        import json
        print(json.dumps(workflow.get_status(), indent=2))
    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
