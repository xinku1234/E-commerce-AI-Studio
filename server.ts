import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { getAiCapabilities, getGeminiClient } from "./server/ai/gemini";
import { resolveImageParts } from "./server/ai/imageInput";
import { generateProductImage } from "./server/ai/imageProviders";
import { buildFallbackDetailModules } from "./server/ai/detailFallback";
import { apiNotFound, errorHandler, requestContext } from "./server/http";
import { simulateChannelPublish } from "./server/publishSimulation";
import { validateRequestUrl } from "./server/security";
import { hasVerifiedEndpoint, isEndpointVerified, markEndpointVerified } from "./server/ai/verifiedEndpoints";
import { collectImageDataUrls, extractJsonObject, requestCustomChatJson } from "./server/ai/openAiCompatible";
import {
  DEMO_MODE_WARNING,
  mapGeminiTextModel,
  modelUnavailablePayload,
  normalizeDetailModules,
  resolveModelRoute,
  respondModelCallFailure
} from "./server/ai/modelRouting";
import {
  PLATFORM_DISPLAY_NAMES,
  SLOT_DISPLAY_NAMES,
  buildDemoPlatformPrompt,
  buildPlatformPromptRequest,
  buildProductAnalysisPrompt
} from "./server/ai/analysisPrompts";

dotenv.config();

const app = express();
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`PORT 必须是 1 到 65535 之间的整数，当前值为: ${process.env.PORT || ""}`);
}

app.use(requestContext);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

function requireConfiguredModel(customEndpointUrl?: unknown) {
  const ai = getAiCapabilities();
  if (!ai.modelRequired || ai.providers.gemini.configured || isEndpointVerified(customEndpointUrl)) return null;
  return { success: false, error: "未绑定可用模型，请先配置 GEMINI_API_KEY 或测试通过自定义模型端点。", code: "MODEL_REQUIRED" };
}

// 1. Health check
app.get("/api/health", (_req, res) => {
  const ai = getAiCapabilities();
  res.json({
    status: "ok",
    mode: ai.mode,
    ai: ai.providers,
    modelRequired: ai.modelRequired,
    modelReady: ai.providers.gemini.configured || hasVerifiedEndpoint(),
    publishMode: "simulation",
    timestamp: new Date().toISOString()
  });
});

// 1.1 Test Custom AI Endpoint & Fetch Available Models
app.post("/api/test-custom-endpoint", async (req, res) => {
  const startTime = Date.now();
  try {
    const { endpointUrl, apiKey, endpointType = "openai_compatible" } = req.body;

    if (!endpointUrl || typeof endpointUrl !== "string") {
      return res.status(400).json({
        success: false,
        message: "请输入有效的 API 接口地址 (URL)"
      });
    }

    let cleanUrl: string;
    try {
      cleanUrl = validateRequestUrl(endpointUrl, "接口地址");
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
    let modelsList: string[] = [];
    let detectedService = "OpenAI Compatible";
    let reachable = false;
    let authRejected = false;
    let authRejectedStatus = 0;

    // 1. Try standard OpenAI / compatible /v1/models endpoint
    let targetModelsUrl = cleanUrl;
    if (!targetModelsUrl.endsWith("/models")) {
      targetModelsUrl = `${cleanUrl}/models`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKey && apiKey.trim()) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }

    let fetchResponse = await fetch(targetModelsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000)
    }).catch(async () => {
      // If direct /models fails, try without /v1/models or root
      if (cleanUrl.endsWith("/v1")) {
        return fetch(`${cleanUrl}/models`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6000)
        }).catch(() => null);
      }
      return null;
    });

    if (fetchResponse && (fetchResponse.status === 401 || fetchResponse.status === 403)) {
      authRejected = true;
      authRejectedStatus = fetchResponse.status;
    }

    if (fetchResponse && fetchResponse.ok) {
      reachable = true;
      const data = await fetchResponse.json().catch(() => null);
      if (data) {
        if (Array.isArray(data.data)) {
          // Standard OpenAI format: { data: [{ id: "gpt-4o", ... }] }
          modelsList = data.data
            .map((item: any) => typeof item === "string" ? item : item.id || item.name || item.model)
            .filter(Boolean);
        } else if (Array.isArray(data.models)) {
          // Ollama format: { models: [{ name: "llama3:latest", ... }] }
          modelsList = data.models
            .map((item: any) => typeof item === "string" ? item : item.name || item.id || item.model)
            .filter(Boolean);
        } else if (Array.isArray(data)) {
          // Array format: ["model1", "model2"] or SD models [{ model_name: "..." }]
          modelsList = data
            .map((item: any) => typeof item === "string" ? item : item.model_name || item.title || item.name || item.id)
            .filter(Boolean);
        }
      }
    }

    // 2. If models list is still empty, test SD/ComfyUI or minimal completion test
    if (modelsList.length === 0) {
      // Test if endpoint responds to a lightweight test
      try {
        const pingRes = await fetch(cleanUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(5000)
        });
        if (pingRes.status === 401 || pingRes.status === 403) {
          authRejected = true;
          authRejectedStatus = pingRes.status;
        }
        if (pingRes.ok || pingRes.status === 404 || pingRes.status === 405) {
          reachable = true;
          // Endpoint is reachable! Provide sensible standard defaults for this provider
          if (cleanUrl.includes("deepseek")) {
            modelsList = ["deepseek-chat", "deepseek-reasoner", "deepseek-r1", "deepseek-v3"];
            detectedService = "DeepSeek Official API";
          } else if (cleanUrl.includes("dashscope") || cleanUrl.includes("aliyun")) {
            modelsList = ["qwen-vl-max", "qwen-vl-plus", "qwen-max", "qwen-plus", "qwen-turbo"];
            detectedService = "阿里通义千问 (DashScope)";
          } else if (cleanUrl.includes("siliconflow")) {
            modelsList = ["Qwen/Qwen2.5-VL-72B-Instruct", "deepseek-ai/DeepSeek-V3", "black-forest-labs/FLUX.1-schnell", "stabilityai/stable-diffusion-3-5-large"];
            detectedService = "硅基流动 (SiliconFlow)";
          } else if (cleanUrl.includes("openai.com")) {
            modelsList = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "dall-e-3", "chatgpt-4o-latest"];
            detectedService = "OpenAI Official";
          } else if (cleanUrl.includes("11434") || cleanUrl.includes("ollama")) {
            modelsList = ["qwen2.5:latest", "llava:latest", "llama3.2-vision:latest"];
            detectedService = "Ollama 本地大模型服务";
          } else if (cleanUrl.includes("8188") || cleanUrl.includes("comfy")) {
            modelsList = ["ComfyUI-ProductStage-v2", "ComfyUI-SDXL-Ecom", "Flux-Dev-Product-v1"];
            detectedService = "ComfyUI 工作流服务";
          } else if (cleanUrl.includes("7860") || cleanUrl.includes("sdapi")) {
            modelsList = ["v1-5-pruned-emaonly", "sd_xl_base_1.0", "majicmixRealistic_v7"];
            detectedService = "Stable Diffusion WebUI";
          } else {
            // General models
            modelsList = ["default-vision-model", "custom-llm-v1"];
          }
        }
      } catch (err) {
        // unreachable
      }
    }

    const latencyMs = Date.now() - startTime;

    if (authRejected) {
      return res.status(401).json({
        success: false,
        latencyMs,
        message: `端点可达但拒绝授权 (HTTP ${authRejectedStatus})，请检查 API Key 是否正确、是否有该模型权限`
      });
    }

    if (!reachable) {
      return res.status(502).json({
        success: false,
        latencyMs,
        message: `无法连接到该端点 (${latencyMs}ms)，请检查 URL、网络连通性与服务是否已启动`
      });
    }

    markEndpointVerified(cleanUrl);

    if (modelsList.length > 0) {
      return res.json({
        success: true,
        latencyMs,
        models: Array.from(new Set(modelsList)),
        serviceName: detectedService,
        verified: true,
        message: `连接成功！响应耗时 ${latencyMs}ms，成功发现 ${modelsList.length} 个可用模型`
      });
    }

    return res.json({
      success: true,
      latencyMs,
      models: [],
      verified: true,
      message: `端点已连通 (${latencyMs}ms)，但未能自动枚举模型，请在下方手动填写模型名称`
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      latencyMs,
      message: `连接测试失败: ${error.message || "无法连接到指定 API 端点，请检查 URL 与网络"}`
    });
  }
});

// Helper to build rich, category-aware ecommerce analysis deeply fused with target platform standards
function buildRichProductAnalysis(productName = "智能高品质商品", category = "3C数码 / 生活美学", targetPlatform = "淘宝/天猫", userNotes = "") {
  const plat = (targetPlatform || "").toLowerCase();
  const isAmazon = plat.includes("amazon") || plat.includes("亚马逊");
  const is1688 = plat.includes("1688") || plat.includes("批发") || plat.includes("工厂");
  const isDouyin = plat.includes("douyin") || plat.includes("抖音") || plat.includes("xiaohongshu") || plat.includes("小红书");
  const isXiaohongshu = plat.includes("xiaohongshu") || plat.includes("小红书");
  const isJD = plat.includes("jd") || plat.includes("京东");
  const isPinduoduo = plat.includes("pinduoduo") || plat.includes("拼多多");
  
  const name = (productName || "").toLowerCase();
  const cat = (category || "").toLowerCase();

  let detectedMaterials = ["航空级轻量合金", "纳米微晶抗指纹涂层", "亲肤柔感硅胶"];
  let materialTraitEn = "premium anodized aluminum structure and precision CNC edges";
  let coreSellingPoints = [
    "航天级钛合金轻量化结构，质感与耐用性提升50%",
    "自研低功耗高效管理，超长续航告别电量焦虑",
    "人体工学黄金弧度设计，全天候使用舒适无感",
    "行业权威认证保障，官方旗舰品质首发"
  ];
  let heroTitles = [
    `【全网首发】${productName} · 颠覆传统体验`,
    "高定质感 · 智享未来 | 官方旗舰正品热销",
    "打破常规边界，为追求极致体验的你而来"
  ];
  let badges = ["官方正品", "顺丰速达", "百亿补贴", "破损包退", "质保换新"];
  let painPoints = [
    "普通产品笨重易发热？自研主动温控与超轻架构",
    "长时间使用易疲劳？人体工程学定制舒适贴合",
    "材质廉价做工粗糙？精工一体成型高奢金属质感"
  ];

  // Specific check for Blush and Color Cosmetics (腮红 / 彩妆 / 口红 / 眼影 / 散粉 / 高光 / 修容)
  if (
    name.includes("腮红") || name.includes("blush") || name.includes("胭脂") ||
    name.includes("口红") || name.includes("唇膏") || name.includes("唇釉") || name.includes("唇泥") ||
    name.includes("眼影") || name.includes("高光") || name.includes("修容") || name.includes("粉饼") ||
    name.includes("散粉") || name.includes("气垫") || name.includes("粉底") || name.includes("彩妆")
  ) {
    const isBlush = name.includes("腮红") || name.includes("blush") || name.includes("胭脂");
    detectedMaterials = ["微米级超细烘焙粉体", "植物萃取天然着色粒子", "极简磁吸/亚克力透光外壳"];
    materialTraitEn = "velvety micro-fine baked powder texture, sleek crystal acrylic casing with subtle light refraction";
    coreSellingPoints = isBlush ? [
      "微米级细腻烘焙粉质，软糯贴肤不飞粉不显毛孔",
      "特调自然元气微醺色，黄皮一抹显白自然通透",
      "12小时持久锁色持妆，抗油耐汗全天不斑驳脱色",
      "颊眼唇多用百搭，轻松晕染打造立体轮廓血色感"
    ] : [
      "精研微细显色微粒，一抹浓郁显色均匀不卡纹",
      "添加养肤滋润植萃成分，上妆轻盈透气不拔干",
      "全天候持久锁色配方，抗水防汗不易沾杯脱妆",
      "专为亚洲肤色调配，显白提气色打造高级妆效"
    ];
    heroTitles = [
      `【元气出圈】${productName} · 打造自然通透好气色`,
      "轻盈贴肤 · 12H持色 | 专柜级微米粉质爆款",
      "一抹微醺心动，重塑立体元气少女感"
    ];
    badges = ["微米级粉质", "黄皮显白", "12H持妆", "买即赠专业粉刷", "正品防伪"];
    painPoints = [
      "粉质粗糙卡粉显毛孔？微米烘焙工艺，一抹隐形毛孔",
      "容易飞粉斑驳脱妆？复合锁色膜，全天服帖不掉色",
      "颜色突兀容易手重？自然透光发色，新手怎么刷都不出错"
    ];
  } else if (
    name.includes("水") || name.includes("霜") || name.includes("精华") || name.includes("乳") ||
    name.includes("面膜") || name.includes("护肤") || name.includes("美妆") || name.includes("防晒") ||
    name.includes("洁面") || name.includes("洗面奶") || cat.includes("美妆") || cat.includes("护肤")
  ) {
    detectedMaterials = ["高硼硅极简玻璃瓶身", "医用级精密真空压泵", "避光活性保存层"];
    materialTraitEn = "translucent frosted glass bottle, crystal clear fluid essence, clean metallic dropper";
    coreSellingPoints = [
      "高浓度活性专利配方，深层渗透强韧修护肌底",
      "7天实测淡纹紧致，提亮焕采温和不挑肤质",
      "0添加酒精香精色素，敏感肌安心专研认证",
      "清爽水感质地秒吸收，长效水润透气不闷痘"
    ];
    heroTitles = [
      `【焕亮新生】${productName} · 7天深层修护`,
      "以油养肤 · 凝时紧致 | 院线级专研成分",
      "肌肤透光密码，重塑弹润年轻肌"
    ];
    badges = ["敏感肌适用", "专利成分", "正品防伪", "买一送同款", "顺丰包邮"];
  } else if (name.includes("耳") || name.includes("音") || name.includes("headphone") || name.includes("audio") || name.includes("充电") || cat.includes("3c") || cat.includes("数码")) {
    detectedMaterials = ["阳极氧化航空铝", "记忆海绵亲肤蛋白皮", "高纯度镀钛复合振膜"];
    materialTraitEn = "anodized aerospace aluminum, matte anti-fingerprint coating, precision CNC edges";
    coreSellingPoints = [
      "45dB双馈深度主动降噪，静享纯净天籁空间",
      "Hi-Res金标高清空间音频，全景3D立体声环绕",
      "60小时超长复合续航，支持闪充充电10分钟听歌5小时",
      "零压感轻量悬浮头梁，长时间佩戴舒适透气"
    ];
    heroTitles = [
      `【声临其境】${productName} · 45dB深度降噪`,
      "天籁音质 · 随心而静 | 空间音频官方首发",
      "静谧新声，专为挑剔耳朵打造的沉浸声场"
    ];
    badges = ["金标音质认证", "45dB双馈降噪", "60h超长续航", "顺丰包邮"];
  } else if (name.includes("茶") || name.includes("咖啡") || name.includes("食") || name.includes("饮") || cat.includes("食品") || cat.includes("生鲜")) {
    detectedMaterials = ["食品级铝箔自封阻隔袋", "环保原浆纸盒", "氮气保鲜锁香罐"];
    materialTraitEn = "rich natural organic ingredients, artisanal packaging, aroma steam vapor";
    coreSellingPoints = [
      "北纬黄金产区直采原叶/原豆，匠心烘焙锁鲜",
      "0反式脂肪酸0蔗糖添加，健康轻负担纯正口感",
      "充氮独立保鲜包装，随时随地还原现萃现泡风味",
      "SGS国际权威检测合规，品质源头严苛品控"
    ];
    heroTitles = [
      `【源头直供】${productName} · 新鲜现萃风味`,
      "醇厚回甘 · 鲜活锁香 | 严选高海拔好物",
      "一口惊艳，给味蕾一场大师级纯正盛宴"
    ];
    badges = ["原产地认证", "现采现发", "顺丰冷链", "品质包退"];
  } else if (name.includes("衣") || name.includes("裤") || name.includes("鞋") || name.includes("服") || name.includes("裙") || name.includes("包") || cat.includes("服装") || cat.includes("鞋包")) {
    detectedMaterials = ["新疆长绒棉双股精梳面料", "微孔透气排汗膜", "高弹抗皱纤维"];
    materialTraitEn = "textured water-repellent weave, precision stitching, premium matte metal hardware";
    coreSellingPoints = [
      "100%精梳长绒棉重磅面料，亲肤透气不易变形",
      "立体剪裁微宽松版型，包容各种身材百搭显瘦",
      "高色牢度环保活性印染，耐磨水洗不易褪色",
      "四针六线精工车缝，无感标签告别摩擦不适"
    ];
    heroTitles = [
      `【经典重塑】${productName} · 舒适版型不挑人`,
      "轻奢面料 · 质感百搭 | 专柜同款当季热销",
      "上身即挺括，重新定义日常极简穿搭"
    ];
    badges = ["长绒棉精选", "不易起球", "支持退换运费险", "现货速发"];
  }

  // 1688 Specific Adjustments
  if (is1688) {
    heroTitles = [
      `【源头工厂直供】${productName} · 支持免费拿样`,
      "一手货源 · 1件起批 | 48H极速代发 支持定制",
      "工厂直销砍掉中间商，爆款货源利润空间翻倍"
    ];
    badges = ["🏭 实力工厂", "支持免费拿样", "一件代发", "支持OEM定制", "48H发货"];
    painPoints = [
      "中间商加价拿货成本高？源头实力工厂一手直供价",
      "起订门槛高囤货风险大？支持1件起批与免费拿样",
      "发货慢售后维权费劲？48小时现货速发与质检保障"
    ];
  }

  // Dynamic Prompt generation combining Product Traits and Platform Norms
  let visualPrompt = "";
  let visualPromptCn = "";
  let lightingMood = "";
  let compositionTip = "";

  if (is1688) {
    lightingMood = "大功率工业级无死角柔光箱 + 均匀泛光 + 98Ra高显色白平衡";
    compositionTip = "居中大主体构图，清晰展示产品扎实用料与批次做工，为左上角工厂标和底部批发价预留排版空间";
    visualPrompt = `Commercial B2B wholesale product photography of ${productName}, showcasing authentic ${materialTraitEn}, placed on a clean solid industrial studio podium, bright uniform commercial lighting, sharp crisp edges, high dynamic range, 8k resolution, factory direct wholesale quality look.`;
    visualPromptCn = `1688源头实力工厂首图：高清展现${productName}真实材质做工，明亮通透工业影棚光，凸显源头直供与扎实质感，高转化B2B点击率。`;
  } else if (isAmazon) {
    lightingMood = "360°全方位柔光箱无死角纯白照明 + 标准5500K白平衡";
    compositionTip = "主体严格占画面 85% 以上，纯白背景RGB(255,255,255)，居中摆放，无文字无水印";
    visualPrompt = `Studio product photography of ${productName} on a 100% pure white seamless background RGB(255, 255, 255), commercial 360-degree softbox illumination, sharp pristine contour lines, subtle soft contact shadow at base, 85% frame filling, no text, no watermark, Amazon compliant hero image, 8k.`;
    visualPromptCn = `100% RGB纯白无缝背景商业影棚摄影，高锐度轮廓光与自然接地阴影，主体占比≥85%，完全符合亚马逊主图合规标准。`;
  } else if (isXiaohongshu) {
    lightingMood = "柔和漫射日光 + 梦幻柔焦光斑 + 极简高雅莫兰迪色调";
    compositionTip = "3:4 竖屏生活美学构图，极简留白，突出生活仪式感";
    visualPrompt = `Minimalist aesthetic lifestyle flatlay photography of ${productName}, soft diffused natural daylight, dreamy pastel neutral cream background, delicate curated props, showcasing ${materialTraitEn}, clean editorial fashion magazine cover layout, 8k.`;
    visualPromptCn = `小红书美学种草风摄影：柔和漫射天光与奶油质感背景，精巧烘托${productName}的高颜值细节与治愈生活美学。`;
  } else if (isDouyin) {
    lightingMood = "温暖自然晨光 + 景深虚化居家光斑 + 侧逆光轮廓";
    compositionTip = "3:4 竖屏生活美学构图，避开底部20%交互与购物车遮挡区，居中偏上展示";
    visualPrompt = `Aesthetic 3:4 vertical commercial photography of ${productName}, placed in a stylish modern aesthetic environment, warm natural directional sunlight with soft organic shadows, highlighting ${materialTraitEn}, cinematic depth of field, 8k organic lighting.`;
    visualPromptCn = `抖音3:4竖屏爆款首图：温暖自然晨光斜射，完美衬托${productName}的真实使用质感，生活美学与高转化吸睛视觉。`;
  } else if (isJD) {
    lightingMood = "冷调商业侧逆光 + 45° 金属高光反射 + 双顶柔光箱";
    compositionTip = "居中黄金比例排布，左上角预留京东自营标，下方留出促销腰封空间";
    visualPrompt = `High-precision commercial studio shoot of ${productName}, sleek metallic and matte slate pedestal, sharp specular highlights accentuating ${materialTraitEn}, crisp edge definition, cool neutral commercial lighting, 8k crystal clear engineering quality, JD flagship look.`;
    visualPromptCn = `京东品质旗舰商业大片：硬朗精密展台与高反差金属微光，强调${productName}精湛做工与正品科技质感。`;
  } else if (isPinduoduo) {
    lightingMood = "高对比度前置主光 + 鲜艳饱满色彩打光 + 高饱和度";
    compositionTip = "大主体居中饱满构图，四周留出百亿补贴标与超大抢购价格牌空间";
    visualPrompt = `High visual impact commercial photography of ${productName}, vibrant clean studio setup, crystal clear centered product focus, bright dynamic front key light, vivid rich color contrast highlighting ${materialTraitEn}, bold commercial catalog quality, 8k crisp details.`;
    visualPromptCn = `拼多多高点击爆款商业摄影：高反差明亮动态布光，居中聚焦突显${productName}形态与极致性价比视觉张力。`;
  } else {
    // Taobao / Tmall Flagship default
    lightingMood = "商业影棚双顶柔光箱 + 45°高光反射轮廓光 + 柔和环境漫反射";
    compositionTip = "黄金分割居中排布，留出顶部主标题与底部营销腰封打标空间，文字面积<20%";
    visualPrompt = `Flagship commercial e-commerce advertising photography of ${productName}, placed on high-end sleek podium with elegant subtle reflections, double softbox studio key lighting, dramatic warm golden rim light highlighting ${materialTraitEn}, shallow cinematic depth of field, 8k hyper-realistic octane render look.`;
    visualPromptCn = `天猫旗舰店爆款主图商业摄影：${productName}置于轻奢展台，大师级双顶柔光箱与45°轮廓光，电影级浅景深与高转化质感。`;
  }

  return {
    productIdentified: productName,
    materialsDetected: detectedMaterials,
    lightingMood,
    compositionTip,
    visualPrompt,
    visualPromptCn,
    negativePrompt: "blurry, out of focus, distorted shapes, noisy, low resolution, unwanted props, messy background, extra limbs, ugly reflections, overexposed highlights",
    coreSellingPoints,
    heroTitles,
    badges,
    painPoints,
    platformOptimizations: {
      platform: targetPlatform || "淘宝 / 天猫",
      aspectRatio: (isDouyin || isXiaohongshu) ? "3:4" : "1:1",
      colorScheme: isAmazon ? "100% 纯白底 RGB(255,255,255)" : is1688 ? "工业高亮白 / 源头工厂质感灰 / 醒目工业橙" : "商业高奢金 / 极简纯净白 / 科技深空灰",
      visualTip: isAmazon ? "亚马逊严格要求首图纯白无文字，产品占比≥85%" : is1688 ? "突出“源头实力工厂/支持拿样/一件代发”等B2B核心诉求，强调实物质感与做工" : isDouyin ? "竖屏种草流，重点突出场景氛围与手持体验" : "突出材质高光与3D立体质感，主标题文字控制在图片高度15%以内以符合规范",
      complianceNote: isAmazon ? "100% 符合亚马逊纯白背景合规标准" : "已通过国家广告法违禁词检测，符合平台主图安全边距"
    },
    targetAudience: is1688 ? "B2B电商卖家、实体店主、批发采购商及一件代发创客" : "22-38岁注重品质与生活格调的都市主流消费人群"
  };
}

function buildSafeProductGuidance(productName = "待命名商品", category = "待填写类目", targetPlatform = "淘宝/天猫", userNotes = "") {
  const platform = targetPlatform || "淘宝/天猫";
  const isVertical = /抖音|小红书|douyin|xiaohongshu/i.test(platform);
  const isAmazon = /亚马逊|amazon/i.test(platform);
  const notes = userNotes.trim();

  return {
    productIdentified: productName || "待命名商品",
    categoryIdentified: category || "待填写类目",
    materialsDetected: ["主要材质待商家按实物补充"],
    lightingMood: "中性商业影棚柔光，准确呈现商品颜色与外观",
    compositionTip: isAmazon
      ? "主体居中并保留纯白背景；发布前按目标站点当前规则人工复核"
      : `${isVertical ? "竖版" : "方形"}构图，主体清晰完整，并为已核实文案预留安全区域`,
    visualPrompt: `Accurate commercial product photography of ${productName || "the supplied product"}, preserve the real product identity, shape, color and visible details, clean studio lighting, uncluttered background, no invented accessories, no text, no logos, no unsupported claims.`,
    visualPromptCn: `基于实拍图准确展示${productName || "商品"}，保持真实外观、颜色、结构和可见细节；使用干净商业布光，不添加未经提供的配件、文字、标志或宣传结论。`,
    negativePrompt: "distorted product, altered logo, invented accessories, unreadable text, unsupported certification marks, exaggerated claims, blurry, low resolution",
    coreSellingPoints: [
      "主要材质、配方或结构特点（待商家核对）",
      "核心功能与适用场景（待商家核对）",
      "尺寸、容量、功率或兼容范围（待商家补充）",
      "发货、退换与质保政策（仅填写店铺真实承诺）"
    ],
    heroTitles: [productName || "商品名称待补充", "核心卖点待核实后填写", "规格与服务信息待商家补充"],
    badges: ["信息待核对"],
    painPoints: ["目标用户与购买顾虑待结合真实评价和客服记录补充"],
    platformOptimizations: {
      platform,
      aspectRatio: isVertical ? "3:4" : "1:1",
      colorScheme: isAmazon ? "纯白背景建议，具体以目标站点当前规则为准" : "根据商品实物配色选择对比清晰的中性背景",
      visualTip: "先保证商品真实可辨，再添加已经核实的价格、规格和活动信息",
      complianceNote: "仅为制作建议，不代表平台审核通过；发布前需人工核对素材、文案和目标平台规则"
    },
    targetAudience: notes ? `需结合商家补充信息确认：${notes}` : "目标人群待商家根据真实客户与销售数据补充"
  };
}

// 2. AI Product Vision Analysis & Platform-Tailored Prompting (Multi-Image Vision Enabled)
app.post("/api/ai-analyze-product", async (req, res) => {
  const {
    productName,
    category,
    targetPlatform,
    userNotes,
    imageBase64,
    images,
    analysisModel = "gemini-3.7-flash",
    customEndpointUrl,
    customApiKey
  } = req.body;

  const modelError = requireConfiguredModel(customEndpointUrl);
  if (modelError) return res.status(503).json(modelError);

  const fallbackData = buildSafeProductGuidance(
    productName || "智能高品质商品",
    category || "3C数码 / 生活美学",
    targetPlatform || "淘宝/天猫",
    userNotes || ""
  );

  const route = resolveModelRoute({
    customEndpointUrl,
    customApiKey,
    requestedModel: analysisModel,
    customFallbackModel: "gpt-4o",
    geminiModel: mapGeminiTextModel(analysisModel)
  });

  try {
    const resolvedImageParts = await resolveImageParts(images, imageBase64);
    const promptText = buildProductAnalysisPrompt({
      productName,
      category,
      targetPlatform,
      userNotes,
      imageCount: resolvedImageParts.length
    });

    if (route.kind === "custom") {
      try {
        const parsed = await requestCustomChatJson({
          endpointUrl: route.endpointUrl,
          apiKey: route.apiKey,
          model: route.model,
          userText: promptText,
          imageUrls: collectImageDataUrls(images, imageBase64, 3),
          temperature: 0.5,
          timeoutMs: 45000
        });
        return res.json({
          success: true,
          generationMode: "ai",
          provider: "custom-openai-compatible",
          modelUsed: route.model,
          data: { ...fallbackData, ...parsed }
        });
      } catch (customError: any) {
        return respondModelCallFailure(res, customError, fallbackData ? { data: fallbackData } : undefined);
      }
    }

    if (route.kind === "gemini") {
      const ai = getGeminiClient();
      if (!ai) return res.status(503).json(modelUnavailablePayload());
      const parts: any[] = [];
      for (const p of resolvedImageParts) {
        parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
      }
      parts.push({ text: promptText });

      try {
        const response = await ai.models.generateContent({
          model: route.model,
          contents: { parts },
          config: { responseMimeType: "application/json", temperature: 0.4 }
        });
        const parsed = extractJsonObject(response.text || "");
        return res.json({
          success: true,
          generationMode: "ai",
          provider: "gemini",
          modelUsed: route.model,
          data: { ...fallbackData, ...parsed }
        });
      } catch (geminiError: any) {
        return respondModelCallFailure(
          res,
          new Error(`Gemini 模型 ${route.model} 调用失败：${geminiError?.message || "未知错误"}`),
          { data: fallbackData }
        );
      }
    }

    return res.json({
      success: true,
      generationMode: "fallback",
      warning: DEMO_MODE_WARNING,
      modelUsed: "intelligent-ecom-engine",
      data: fallbackData
    });
  } catch (error: any) {
    console.error("AI vision analysis error:", error);
    return res.status(500).json({
      success: false,
      error: `商品分析请求处理失败：${error?.message || "未知错误"}`,
      code: "ANALYSIS_REQUEST_FAILED",
      requestId: res.locals.requestId
    });
  }
});

// 2.5. Dedicated Multi-Modal AI Prompt Generator (Combining Multi-Image Real Photos + Target Platform + Specific Slot)
app.post("/api/generate-multimodal-platform-prompt", async (req, res) => {
  const {
    images,
    imageBase64,
    productName,
    category,
    sellingPoints = [],
    specs = [],
    targetPlatform = "taobao",
    slot = "slot_1_ctr",
    sceneStyle,
    userInstruction,
    promptModel = "gemini-3.7-flash",
    customEndpointUrl,
    customApiKey
  } = req.body;

  const modelError = requireConfiguredModel(customEndpointUrl);
  if (modelError) return res.status(503).json(modelError);

  const route = resolveModelRoute({
    customEndpointUrl,
    customApiKey,
    requestedModel: promptModel,
    customFallbackModel: "gpt-4o",
    geminiModel: mapGeminiTextModel(promptModel)
  });

  try {
    const resolvedImageParts = await resolveImageParts(images, imageBase64);
    const currentPlatformName = PLATFORM_DISPLAY_NAMES[targetPlatform] || targetPlatform;
    const currentSlotName = SLOT_DISPLAY_NAMES[slot] || slot;
    const promptText = buildPlatformPromptRequest({
      productName,
      category,
      sellingPoints,
      specs,
      platformName: currentPlatformName,
      slotName: currentSlotName,
      sceneStyle,
      userInstruction,
      imageCount: resolvedImageParts.length
    });

    if (route.kind === "custom") {
      try {
        const parsed = await requestCustomChatJson({
          endpointUrl: route.endpointUrl,
          apiKey: route.apiKey,
          model: route.model,
          systemPrompt: "你是一位享誉全球的顶级商业广告摄影指导与电商高转化视觉操盘手，只返回严格的 JSON。",
          userText: promptText,
          imageUrls: collectImageDataUrls(images, imageBase64, 4),
          temperature: 0.6,
          timeoutMs: 45000
        });
        return res.json({
          success: true,
          provider: "custom-openai-compatible",
          modelUsed: route.model,
          data: parsed
        });
      } catch (customError: any) {
        return respondModelCallFailure(res, customError);
      }
    }

    if (route.kind === "gemini") {
      const ai = getGeminiClient();
      if (!ai) return res.status(503).json(modelUnavailablePayload());
      const parts: any[] = [];
      for (const p of resolvedImageParts) {
        parts.push({ inlineData: { mimeType: p.mimeType, data: p.data } });
      }
      parts.push({ text: promptText });

      try {
        const response = await ai.models.generateContent({
          model: route.model,
          contents: { parts },
          config: { responseMimeType: "application/json", temperature: 0.5 }
        });
        const parsed = extractJsonObject(response.text || "");
        return res.json({ success: true, provider: "gemini", modelUsed: route.model, data: parsed });
      } catch (geminiError: any) {
        return respondModelCallFailure(
          res,
          new Error(`Gemini 模型 ${route.model} 调用失败：${geminiError?.message || "未知错误"}`)
        );
      }
    }

    return res.json({
      success: true,
      generationMode: "fallback",
      warning: DEMO_MODE_WARNING,
      modelUsed: "intelligent-prompt-engine",
      data: buildDemoPlatformPrompt({
        productName,
        category,
        platformName: currentPlatformName,
        slotName: currentSlotName
      })
    });
  } catch (err: any) {
    console.error("Multimodal prompt generator error:", err);
    return res.status(500).json({
      success: false,
      error: `提示词生成请求处理失败：${err?.message || "未知错误"}`,
      code: "PROMPT_REQUEST_FAILED",
      requestId: res.locals.requestId
    });
  }
});

// 3. AI Detail Page Modules Generator
app.post("/api/generate-detail-page-modules", async (req, res) => {
  const {
    productName,
    category,
    targetPlatform,
    sellingPoints,
    customSpecs,
    promptModel = "gemini-3.7-flash",
    customEndpointUrl,
    customApiKey
  } = req.body || {};

  const modelError = requireConfiguredModel(customEndpointUrl);
  if (modelError) return res.status(503).json(modelError);

  const fallbackModules = buildFallbackDetailModules({ productName, category, sellingPoints, customSpecs });
  const route = resolveModelRoute({
    customEndpointUrl,
    customApiKey,
    requestedModel: promptModel,
    customFallbackModel: "gpt-4o",
    geminiModel: mapGeminiTextModel(promptModel)
  });

  const prompt = `你是一名顶级电商策划总监。请根据以下商品信息，为${targetPlatform || "电商平台"}生成包含6个模块的商品详情页完整文案与结构：
商品名称: ${productName || "精品好物"}
品类: ${category || "综合百货"}
用户核心卖点: ${sellingPoints ? JSON.stringify(sellingPoints) : "按真实商品资料填写，未确认的信息标注为待补充"}
规格参数: ${customSpecs ? JSON.stringify(customSpecs) : "按真实商品资料填写"}

要求：
1. 严禁编造认证、检测数据、保修年限、销量与排名等无法核实的信息，未确认内容写成待商家补充；
2. 每个模块包含 id、type、title、tag、headline、subheadline、bullets(数组)、specs(数组)、content 字段；
3. 严格返回 JSON 对象，形如 { "modules": [ ... ] }。`;

  try {
    if (route.kind === "custom") {
      try {
        const parsed = await requestCustomChatJson({
          endpointUrl: route.endpointUrl,
          apiKey: route.apiKey,
          model: route.model,
          systemPrompt: "你是资深电商详情页策划总监，只返回严格的 JSON。",
          userText: prompt,
          temperature: 0.5,
          timeoutMs: 45000
        });
        const modules = normalizeDetailModules(parsed);
        if (!modules) throw new Error("模型未返回有效的详情页模块数组");
        return res.json({
          success: true,
          generationMode: "ai",
          provider: "custom-openai-compatible",
          modelUsed: route.model,
          modules
        });
      } catch (customError: any) {
        return respondModelCallFailure(res, customError, { modules: fallbackModules });
      }
    }

    if (route.kind === "gemini") {
      const ai = getGeminiClient();
      if (!ai) return res.status(503).json(modelUnavailablePayload());
      try {
        const response = await ai.models.generateContent({
          model: route.model,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const modules = normalizeDetailModules(extractJsonObject(response.text || ""));
        if (!modules) throw new Error("模型未返回有效的详情页模块数组");
        return res.json({
          success: true,
          generationMode: "ai",
          provider: "gemini",
          modelUsed: route.model,
          modules
        });
      } catch (geminiError: any) {
        return respondModelCallFailure(
          res,
          new Error(`Gemini 模型 ${route.model} 调用失败：${geminiError?.message || "未知错误"}`),
          { modules: fallbackModules }
        );
      }
    }

    return res.json({
      success: true,
      generationMode: "fallback",
      warning: DEMO_MODE_WARNING,
      modelUsed: "intelligent-detail-engine",
      modules: fallbackModules
    });
  } catch (error: any) {
    console.error("Error generating detail page:", error);
    return res.status(500).json({
      success: false,
      error: `详情页生成请求处理失败：${error?.message || "未知错误"}`,
      code: "DETAIL_REQUEST_FAILED",
      requestId: res.locals.requestId
    });
  }
});

// 4. AI Image Generation & Multi-Model Scene Synthesis (Using Multi-Angle Product Reference Photos)
app.post("/api/generate-product-image", async (req, res) => {
  try {
    const { 
      prompt, 
      negativePrompt,
      aspectRatio = "1:1", 
      imageBase64, 
      images,
      stylePreset,
      imageModel = "gemini-3.1-flash-image",
      customEndpointUrl,
      customApiKey,
      denoisingStrength = 0.65
    } = req.body;
    const modelError = requireConfiguredModel(customEndpointUrl);
    if (modelError) return res.status(503).json(modelError);

    const resolvedImageParts = await resolveImageParts(images, imageBase64);

    const result = await generateProductImage({
      prompt: typeof prompt === 'string' && prompt.trim() ? prompt : 'clean commercial product photography',
      negativePrompt,
      aspectRatio,
      stylePreset,
      imageModel,
      customEndpointUrl,
      customApiKey,
      referenceImages: resolvedImageParts
    });

    // No image means the bound engine failed. Returning success here is what let
    // the client pass off a locally drawn canvas as a model result.
    if (!result.imageUrl && getAiCapabilities().modelRequired) {
      const bound = result.providerErrors?.find((entry) => entry.provider === "custom-openai-compatible")
        || result.providerErrors?.at(-1);
      return res.status(502).json({
        success: false,
        error: bound?.message || result.fallbackReason || "生图引擎没有返回图片。",
        hint: "请在「模型与接口配置」的生图端点中核对接口地址、模型名称与 API Key，然后重新执行测试。",
        code: "IMAGE_GENERATION_FAILED",
        provider: bound?.provider,
        providerErrors: result.providerErrors,
        requestId: res.locals.requestId
      });
    }

    return res.json({ success: true, ...result });
  } catch (error: any) {
    if (getAiCapabilities().modelRequired) {
      return res.status(503).json({
        success: false,
        error: error?.message || "图片生成服务异常，请先确认模型配置。",
        code: "MODEL_GENERATION_FAILED",
        requestId: res.locals.requestId
      });
    }
    return res.json({
      success: true,
      provider: "procedural",
      modelUsed: "procedural-studio",
      imageUrl: null,
      isRealAiImage: false,
      useProceduralStudio: true,
      fallbackToPreset: true,
      fallbackReason: error?.message || "图片生成服务异常"
    });
  }
});

// 4.5. Generate Full 5-Hero-Image Suite (Slot 1 CTR, Slot 2 Detail, Slot 3 Dimension, Slot 4 Scene, Slot 5 WhiteBg)
app.post("/api/generate-hero-suite-5", async (req, res) => {
  try {
    const {
      productName,
      category,
      targetPlatform = "taobao",
      sellingPoints = [],
      imageBase64,
      images,
      imageModel = "gemini-3.1-flash-image",
      customEndpointUrl,
      customApiKey
    } = req.body;

    const modelError = requireConfiguredModel(customEndpointUrl);
    if (modelError) return res.status(503).json(modelError);

    const is1688 = targetPlatform === "1688";
    const isAmazon = targetPlatform === "amazon";

    // 5 tailored slots definitions
    const suiteSlots = [
      {
        slot: "slot_1_ctr",
        slotIndex: 1,
        slotTitle: "第1张：高点击首图 (爆款吸睛/利益点大字报)",
        slotShortName: "首图 (点击率)",
        slotPurpose: is1688 
          ? "突出“源头实力工厂/支持拿样/一件代发”等B2B核心采购痛点，抢夺采购商点击" 
          : isAmazon 
            ? "100% 纯白底合规首图，主体占比85%以上，无文字水印"
            : "突出核心卖点与强视觉冲击力，高反差大字报利益点，极大提升信息流点击率 (CTR)",
        badgeText: is1688 ? "🏭 实力工厂" : (isAmazon ? "" : "🔥 爆款热卖"),
        headline: is1688 ? "源头工厂直供 · 严控成本" : (isAmazon ? "" : (sellingPoints[0] || "爆款热卖 · 极简质感")),
        subheadline: is1688 ? "支持免费拿样 / 现货48H发出" : (isAmazon ? "" : "限时直降特惠 / 领券立减"),
        prompt: isAmazon 
          ? `Isolated ${productName || "product"} on a 100% pure flat white background RGB (255, 255, 255), commercial catalog ring lighting, 85% frame filling, crisp edges, subtle soft contact shadow, Amazon strict compliance, 8k.`
          : `Striking commercial e-commerce high-CTR main hero banner shot of ${productName || "premium product"}, placed on high contrast advertising luxury pedestal, vibrant commercial studio rim lighting, crisp 8k details, eye-catching composition.`,
        promptCn: isAmazon 
          ? `100% 纯白底亚马逊合规图，主体占比85%+，高锐度无杂质` 
          : `爆款吸睛高点击率首图，商业广告高反差展台，立体轮廓光与质感反射`
      },
      {
        slot: "slot_2_detail",
        slotIndex: 2,
        slotTitle: "第2张：细节质感图 (微距工艺/核心材质特写)",
        slotShortName: "第2张 (细节图)",
        slotPurpose: "微距特写展示商品做工、物理材质光泽、精密缝线/金属倒角与扎实用料，消除买家品质疑虑",
        badgeText: "🔍 微距特写",
        headline: "精湛工艺 · 考究细节",
        subheadline: sellingPoints[1] || "微米级精工打磨，触感细腻非凡",
        prompt: `Extreme macro close-up photography of ${productName || "product"}, showcasing exquisite texture, fine material craftsmanship, tactile surface finish, soft studio diffused lighting, shallow depth of field, 8k crisp focus.`,
        promptCn: `微距特写细节图，极致展现材料质感与精工细节，柔和影棚漫反射`
      },
      {
        slot: "slot_3_dimension",
        slotIndex: 3,
        slotTitle: "第3张：尺寸规格图 (标线比例/空间参考)",
        slotShortName: "第3张 (尺寸图)",
        slotPurpose: "直观呈现商品真实尺寸、长宽高标注线、掌心/空间真实参照物与包装规格，避免买家退换货",
        badgeText: "📐 尺寸标线",
        headline: "真实尺寸 · 精准适配",
        subheadline: "科学工学比例，握持/摆放恰到好处",
        dimensionsOverlay: {
          width: "185 mm",
          height: "210 mm",
          depth: "78 mm",
          unit: "mm",
          label: "标准黄金比例尺寸"
        },
        prompt: `Clean technical studio photography of ${productName || "product"} with minimal architectural lighting, isometric composition next to subtle dimensional measurement guidelines, clean neutral studio background, 8k.`,
        promptCn: `尺寸规格图，带有工业设计感的精准长宽高尺寸标线与比例参考`
      },
      {
        slot: "slot_4_scene",
        slotIndex: 4,
        slotTitle: "第4张：场景氛围图 (真实生活/商用空间实景)",
        slotShortName: "第4张 (场景图)",
        slotPurpose: "将产品置于高颜值真实生活/办公/商业使用场景中，激发代入感与生活方式情绪价值",
        badgeText: "🌿 实景氛围",
        headline: "多场景随行 · 融入生活",
        subheadline: sellingPoints[2] || "随时随地，尽享高品质舒适体验",
        prompt: `Authentic aesthetic lifestyle photography of ${productName || "product"}, placed naturally on modern Scandinavian wooden tabletop in sunlit cozy living space, morning sunlight filtering through window, cinematic bokeh, 8k.`,
        promptCn: `真实生活方式场景图，晨光斜射与自然空间摆设，充满温馨高级感`
      },
      {
        slot: "slot_5_whitebg",
        slotIndex: 5,
        slotTitle: "第5张：合规白底图 (RGB 255纯白透底/主搜入库)",
        slotShortName: "第5张 (白底图)",
        slotPurpose: "100% 纯白底 (RGB 255,255,255)，无杂物无水印文字，主体占比超85%，符合各平台官方主搜算法加权",
        badgeText: "",
        headline: "",
        subheadline: "",
        prompt: `Isolated ${productName || "product"} on 100% pure flat white background RGB (255, 255, 255), commercial catalog studio ring lighting, perfectly centered, soft subtle ground contact shadow, Amazon and JD strict compliance, 8k.`,
        promptCn: `100% 纯白底合规图 (RGB 255,255,255)，主体居中占比85%+，官方主搜加权`
      }
    ];

    return res.json({
      success: true,
      modelUsed: imageModel,
      suite: suiteSlots
    });
  } catch (error: any) {
    console.error("Error generating hero suite:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Simulated multi-channel publish and compliance preview endpoint.
// This route never calls real marketplace APIs.
app.post("/api/publish-channels", async (req, res) => {
  try {
    return res.json(simulateChannelPublish(req.body || {}));
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message, requestId: res.locals.requestId });
  }
});

app.use('/api', apiNotFound);
app.use(errorHandler);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Commerce AI Studio Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, closing HTTP server...`);
    server.close((error) => {
      if (error) {
        console.error('HTTP server shutdown failed:', error);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('Server failed to start:', error);
  process.exitCode = 1;
});
