import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// MiniMax API 配置
const apiKey = process.env.ANTHROPIC_API_KEY || "sk-cp-ATSzsFW4KgGl7Nlv8bI2ZR4k3CBN_Jpz-E4N2JDrsQCddYsYQms-UsM_xFw9PTuJS0Ps7ieCao-UGTOYVegsccyYPDGlYzulUAYKhbwA1OEc_VYtbULguM0";
const baseURL = process.env.ANTHROPIC_BASE_URL || "https://api.minimaxi.com/anthropic";

// ============ MiniMax 模型补丁 ============
function patchStagehandForMiniMax() {
  const stagehandPath = require.resolve("@browserbasehq/stagehand");
  const indexPath = stagehandPath;

  try {
    let content = fs.readFileSync(indexPath, "utf8");

    // 检查是否已经 patch 过
    if (content.includes("MiniMax-M2.7")) {
      return; // 已经 patch 过了
    }

    // 添加 MiniMax 模型到 modelToProviderMap
    const mapPatch = `
  "MiniMax-M2.5": "anthropic",
  "MiniMax-M2.7": "anthropic",
  "MiniMax-M2.5-highspeed": "anthropic",
  "MiniMax-M2.7-highspeed": "anthropic",`;

    content = content.replace(
      /"claude-3-7-sonnet-latest": "anthropic",/,
      `"claude-3-7-sonnet-latest": "anthropic",${mapPatch}`
    );

    // 添加到 AvailableModelSchema enum
    content = content.replace(
      /"groq-llama-3.3-70b-specdec"\n\]/,
      `"groq-llama-3.3-70b-specdec",
  "MiniMax-M2.5",
  "MiniMax-M2.7",
  "MiniMax-M2.5-highspeed",
  "MiniMax-M2.7-highspeed"\n]`
    );

    fs.writeFileSync(indexPath, content);
    console.log("Stagehand MiniMax patch 完成!");
  } catch (e) {
    console.warn("Patch Stagehand 失败:", e.message);
  }
}

patchStagehandForMiniMax();
// ==========================================

// 详情页 Schema（完整字段）
const BidDetailSchema = z.object({
  project_name: z.string().describe("项目名称"),
  amount: z.string().optional().describe("中标金额"),
  winner: z.string().optional().describe("中标单位名称"),
  date: z.string().optional().describe("发布日期 YYYY-MM-DD"),
  buyer: z.string().optional().describe("采购单位"),
  phone: z.string().optional().describe("联系电话"),
  url: z.string().optional().describe("详情页URL")
});

// 列表页 Schema（部分字段）
const BidListItemSchema = z.object({
  project_name: z.string().describe("项目名称"),
  date: z.string().describe("发布日期"),
  url: z.string().optional().describe("详情页URL")
});

// 公司信息补全 Schema
const CompanyInfoSchema = z.object({
  company_name: z.string().describe("公司名称"),
  phone: z.string().optional().describe("联系电话"),
  email: z.string().optional().describe("电子邮箱"),
  person: z.string().optional().describe("负责人"),
  address: z.string().optional().describe("地址"),
  legal_person: z.string().optional().describe("法人代表")
});

class BidCollector {
  constructor(options = {}) {
    this.province = options.province || "山东省";
    this.city = options.city || "济南市";
    this.stagehand = null;
    this.allBids = [];
    this.maxItemsPerPage = options.maxItemsPerPage || 5; // 每页最多采集数（测试用）
    this.maxPages = options.maxPages || 3; // 最多采集页数
    this.enscanAvailable = false; // ENScan_GO 服务状态
  }

  async init() {
    console.log("初始化 Stagehand...");
    console.log(`使用模型: MiniMax-M2.7`);

    this.stagehand = new Stagehand({
      env: "LOCAL",
      modelName: "MiniMax-M2.7",
      modelClientOptions: {
        apiKey: apiKey,
        baseURL: baseURL
      },
      headless: false,
      debugMode: true
    });

    await this.stagehand.init();
    this.page = this.stagehand.page;
    console.log("初始化完成!");

    // 检查 ENScan_GO 服务
    await this.checkENScanGO();
  }

  /**
   * 检查 ENScan_GO 服务是否可用
   */
  async checkENScanGO() {
    try {
      const response = await fetch("http://localhost:8080/api/info?name=test", {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok || response.status === 400) {
        console.log("✓ ENScan_GO 服务正常 (localhost:8080)");
        this.enscanAvailable = true;
      } else {
        console.log("⚠ ENScan_GO 服务返回异常状态");
        this.enscanAvailable = false;
      }
    } catch (e) {
      console.warn("⚠ ENScan_GO 服务不可用 (localhost:8080) - 公司信息补全将跳过");
      console.warn("  启动命令: ./enscan --mcp");
      this.enscanAvailable = false;
    }
  }

  /**
   * 带 JSON 验证和重试的提取方法
   */
  async extractWithRetry(instruction, schema, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.page.extract({
          instruction,
          schema,
          domSettleTimeoutMs: 20000
        });

        // 验证返回的是有效 JSON 对象
        if (result && typeof result === 'object' && Object.keys(result).length > 0) {
          return result;
        }

        console.log(`[重试 ${i+1}/${maxRetries}] 返回无效结果，继续...`);
      } catch (e) {
        console.log(`[重试 ${i+1}/${maxRetries}] 提取失败: ${e.message}`);
      }

      // 重试前等待
      if (i < maxRetries - 1) {
        await this.page.waitForTimeout(2000);
      }
    }
    return null; // 所有重试都失败
  }

  /**
   * 从详情页提取完整中标信息
   */
  async extractDetailFromPage() {
    return this.extractWithRetry(
      `从页面提取: 项目名称、中标金额（万元）、中标单位、发布日期、采购单位、联系电话。只返回明确存在的信息。`,
      BidDetailSchema,
      3
    );
  }

  /**
   * 使用 ENScan_GO REST API 补全公司信息
   */
  async enrichCompanyInfo(companyName) {
    if (!companyName) return null;
    if (!this.enscanAvailable) return null;

    try {
      const url = `http://localhost:8080/api/info?name=${encodeURIComponent(companyName)}`;
      console.log(`  查询公司信息: ${companyName}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.log(`  公司信息查询失败: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      // 解析 ENScan_GO 响应格式
      // 响应可能是 { data: {...} } 或直接是 {...}
      const info = data.data || data;

      if (info && Object.keys(info).length > 0) {
        const result = {
          phone: info.phone || info.tel || null,
          email: info.email || null,
          person: info.person || info.legal_person || info.法人代表 || null,
          address: info.address || info.location || null,
          legal_person: info.legal_person || info.法人代表 || null
        };
        console.log(`  ✓ 公司信息补全成功: ${result.phone ? '有电话' : '无电话'}`);
        return result;
      }

      console.log(`  公司信息未找到`);
      return null;
    } catch (e) {
      console.log(`  公司信息查询失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 采集当前列表页的所有项目详情
   */
  async collectCurrentPage() {
    console.log("\n--- 采集当前列表页 ---");

    // 观察所有公告链接（带超时保护）
    let links = [];
    try {
      links = await this.page.observe("招标公告或中标公告链接列表");
    } catch (e) {
      console.log("observe 调用失败:", e.message);
    }

    if (!links || links.length === 0) {
      console.log("未找到任何公告链接，尝试使用原生选择器...");
      // 备用：使用 Playwright 原生选择器
      try {
        const items = await this.page.locator('a[href*="zbcg"], a[href*="zbgg"], a[href*="info"]').all();
        console.log(`原生选择器找到 ${items.length} 个链接`);
      } catch (e2) {
        console.log("原生选择器也失败");
      }
      return [];
    }

    console.log(`找到 ${links.length} 个链接`);

    // 只取前 maxItemsPerPage 个（测试用）
    const linksToProcess = links.slice(0, this.maxItemsPerPage);
    const pageBids = [];

    for (let i = 0; i < linksToProcess.length; i++) {
      const link = linksToProcess[i];
      console.log(`\n[${i + 1}/${linksToProcess.length}] 点击进入详情: ${link.description}`);

      try {
        // 点击进入详情页
        const actResult = await this.page.act(link);
        console.log(`  进入结果: ${actResult.message}`);

        // 等待详情页加载
        await this.page.waitForTimeout(2000);

        // 提取详情
        const detail = await this.extractDetailFromPage();

        if (detail) {
          // 获取当前 URL 作为来源
          const url = this.page.url();
          detail.url = url;

          // 自动检索中标单位联系方式
          if (detail.winner) {
            const companyInfo = await this.enrichCompanyInfo(detail.winner);
            if (companyInfo) {
              detail.phone = companyInfo.phone || detail.phone;
              detail.email = companyInfo.email;
              detail.person = companyInfo.person;
              detail.address = companyInfo.address;
              detail.legal_person = companyInfo.legal_person;
              console.log(`  ✓ 公司信息补全: ${companyInfo.phone ? `电话=${companyInfo.phone}` : '无电话'}`);
            }
          }

          pageBids.push(detail);
          console.log(`  ✓ 提取成功: ${detail.project_name || "未获取到项目名"}`);
          console.log(`    金额: ${detail.amount || "未获取"}, 单位: ${detail.winner || "未获取"}`);
        } else {
          console.log(`  ✗ 提取失败`);
        }

        // 返回列表页
        console.log(`  返回列表页...`);
        await this.page.goBack();
        await this.page.waitForTimeout(1500);

      } catch (e) {
        console.log(`  处理链接失败: ${e.message}`);
        // 确保返回列表页
        try {
          await this.page.goBack();
          await this.page.waitForTimeout(1000);
        } catch (e2) {
          console.log(`  返回列表页失败: ${e2.message}`);
        }
      }
    }

    return pageBids;
  }

  /**
   * 处理分页，采集所有页面
   */
  async collectWithPagination() {
    let currentPage = 0;
    let hasNextPage = true;

    while (currentPage < this.maxPages && hasNextPage) {
      console.log(`\n========== 第 ${currentPage + 1}/${this.maxPages} 页 ==========`);

      // 采集当前页
      const pageBids = await this.collectCurrentPage();
      this.allBids.push(...pageBids);
      console.log(`本页采集到 ${pageBids.length} 条记录，累计 ${this.allBids.length} 条`);

      currentPage++;

      // 检查是否有下一页
      if (currentPage < this.maxPages) {
        hasNextPage = await this.tryGoToNextPage();
        if (!hasNextPage) {
          console.log("已到最后一页");
        }
      }
    }
  }

  /**
   * 尝试进入下一页
   */
  async tryGoToNextPage() {
    try {
      const nextBtn = await this.page.observe("下一页按钮");
      if (nextBtn && nextBtn.length > 0) {
        console.log("\n>>> 点击下一页 >>>");
        await this.page.act(nextBtn[0]);
        await this.page.waitForTimeout(2000);
        return true;
      }
    } catch (e) {
      console.log("点击下一页失败:", e.message);
    }
    return false;
  }

  /**
   * 主采集流程
   */
  async collect() {
    await this.init();

    try {
      // 1. 导航到山东省政府采购网
      console.log(`\n导航到 ${this.province} 政府采购网...`);
      await this.page.goto("https://ggzyjy.shandong.gov.cn/", {
        timeout: 60000,
        waitUntil: "domcontentloaded"
      });
      await this.page.waitForTimeout(2000);

      // 2. 点击"交易公开"导航（使用原生选择器，更快更可靠）
      console.log("点击交易公开导航...");
      try {
        await this.page.click('text=交易公开', { timeout: 10000 });
        await this.page.waitForTimeout(3000);
        console.log("成功进入交易公开页面");
      } catch (e) {
        console.log("点击失败，尝试直接导航...");
        await this.page.goto("https://ggzyjy.shandong.gov.cn/", {
          timeout: 60000,
          waitUntil: "domcontentloaded"
        });
        await this.page.waitForTimeout(2000);
      }

      // 3. 点击"中标公告"标签/选项卡
      console.log("点击中标公告标签...");
      try {
        // 尝试点击关键词区域的中标公告
        await this.page.click('text=中标公告', { timeout: 10000 });
        await this.page.waitForTimeout(3000);
        console.log("成功切换到中标公告");
      } catch (e) {
        console.log("点击中标公告标签失败:", e.message);
        // 继续执行，可能已经在中标公告页面
      }

      // 4. 开始分页采集
      await this.collectWithPagination();

      // 5. 保存结果到 JSON 文件
      const timestamp = new Date().toISOString().slice(0, 10);
      const resultFile = `./logs/bids_${this.province}_${timestamp}.json`;
      try {
        const resultDir = path.dirname(resultFile);
        if (!fs.existsSync(resultDir)) {
          fs.mkdirSync(resultDir, { recursive: true });
        }
        fs.writeFileSync(resultFile, JSON.stringify({ projects: this.allBids }, null, 2));
        console.log(`\n✓ 结果已保存: ${resultFile}`);
      } catch (e) {
        console.log(`\n⚠ 保存失败: ${e.message}`);
      }

      // 6. 输出结果
      console.log("\n========== 采集结果 ==========");
      console.log(`共采集 ${this.allBids.length} 条中标公告`);
      console.log(JSON.stringify(this.allBids, null, 2));

      return { projects: this.allBids };

    } catch (error) {
      console.error("采集失败:", error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.stagehand) {
      console.log("\n关闭浏览器...");
      await this.stagehand.close();
    }
  }
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const province = args[0] || "山东省";
  const city = args[1] || "济南市";
  const maxItems = parseInt(args[2]) || 3; // 默认每页只采3条（测试用）
  const maxPages = parseInt(args[3]) || 2; // 默认只采2页

  console.log(`\n开始采集 ${province} ${city} 中标数据...`);
  console.log(`配置: 每页最多 ${maxItems} 条, 最多 ${maxPages} 页\n`);

  const collector = new BidCollector({
    province,
    city,
    maxItemsPerPage: maxItems,
    maxPages: maxPages
  });

  const result = await collector.collect();

  console.log(`\n最终结果: 共 ${result.projects?.length || 0} 条记录`);
  process.exit(0);
}

main();
