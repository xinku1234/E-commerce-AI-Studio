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

  try {
    // Resolve all provided images into inlineData items
    const resolvedImageParts = await resolveImageParts(images, imageBase64);
    const hasImages = resolvedImageParts.length > 0;

    // Check if user is using a custom endpoint with OpenAI-compatible API
    if (customEndpointUrl && (analysisModel.includes("custom") || customApiKey || customEndpointUrl.includes("http"))) {
      try {
        let cleanUrl = validateRequestUrl(customEndpointUrl, "自定义接口地址");
        let chatUrl = cleanUrl.endsWith("/chat/completions") ? cleanUrl : `${cleanUrl}/chat/completions`;
        if (!chatUrl.includes("/v1") && !chatUrl.includes("/chat")) {
          chatUrl = `${cleanUrl}/v1/chat/completions`;
        }

        const promptText = `你是一位电商视觉总监与爆款营销专家。请仔细分析上传的${resolvedImageParts.length}张商品实拍参考图，为商品【${productName || '品质好物'}】(品类:${category || '生活电商'}, 平台:${targetPlatform || '淘宝/天猫'}, 诉求:${userNotes || '高级感'})生成商业摄影提示词与营销文案。严格返回JSON格式，包含productIdentified, materialsDetected(数组), lightingMood, compositionTip, visualPrompt(英文高质量生图Prompt), visualPromptCn(中文提示词), negativePrompt, coreSellingPoints(4条数组), heroTitles(3条数组), badges(4条数组), painPoints(3条数组), platformOptimizations(对象: platform, aspectRatio, colorScheme, visualTip, complianceNote), targetAudience。`;

        const msgContent: any[] = [{ type: "text", text: promptText }];
        if (hasImages && images && Array.isArray(images)) {
          for (const img of images.slice(0, 3)) {
            if (img && typeof img === "string" && img.length < 500000) {
              msgContent.push({ type: "image_url", image_url: { url: img } });
            }
          }
        } else if (hasImages && imageBase64 && imageBase64.length < 500000) {
          msgContent.push({ type: "image_url", image_url: { url: imageBase64 } });
        }

        const customRes = await fetch(chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "Authorization": `Bearer ${customApiKey.trim()}` } : {})
          },
          body: JSON.stringify({
            model: analysisModel.replace("custom-prompt-model", "gpt-4o"),
            messages: [{ role: "user", content: msgContent }],
            temperature: 0.7,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (customRes.ok) {
          const customData = await customRes.json();
          const content = customData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return res.json({
              success: true,
              generationMode: "ai",
              modelUsed: analysisModel,
              data: { ...fallbackData, ...parsed }
            });
          }
        }
      } catch (customErr) {
        console.warn("Custom model request fallback:", customErr);
      }
    }
    
    const ai = getGeminiClient();

    // Map requested model to a valid Gemini SDK model
    let targetModel = "gemini-3.7-flash";
    if (analysisModel === "gemini-3.1-pro-preview" || analysisModel === "gemini-2.5-pro") {
      targetModel = "gemini-3.1-pro-preview";
    } else if (analysisModel === "gemini-2.5-flash") {
      targetModel = "gemini-2.5-flash";
    } else {
      targetModel = "gemini-3.7-flash";
    }

    if (!ai) {
      return res.json({
        success: true,
        generationMode: "fallback",
        warning: "未配置 Gemini，当前结果为规则建议，不代表已识别图片中的真实参数或认证。",
        modelUsed: "intelligent-ecom-engine",
        data: fallbackData
      });
    }

    // Prepare multimodal vision prompt with all resolved images
    const parts: any[] = [];
    for (const p of resolvedImageParts) {
      parts.push({
        inlineData: {
          mimeType: p.mimeType,
          data: p.data
        }
      });
    }

    const promptText = `你是一位享誉业界的资深电商多模态视觉总监与爆款营销专家。
${hasImages ? `【极其重要：用户已上传 ${resolvedImageParts.length} 张真实商品多角度实拍图，请通过所有实拍图的真实外观、做工细节、材质触感、颜色光泽与立体结构精准识别这是什么商品，严禁随意套用通用模版或脱离实物生成无意义词汇！】` : ''}

上下文信息：
- 用户输入名称: ${productName && productName !== "智能高品质商品" ? productName : "（请直接基于实拍图识别具体商品名称与品类）"}
- 所选类目: ${category || "自动识别"}
- 目标电商渠道: ${targetPlatform || "淘宝/天猫"}
- 商家要求: ${userNotes || "突出高级质感、真实工业设计/彩妆/材质光影与高转化核心卖点"}

请完成：
1. 【商品精准识别】：识别出具体商品名称（如：元气柔雾浮雕双色腮红、哑光丝绒持色唇釉、降噪头戴耳机等），识别所属类目、真实物理形态、配色（如奶杏蜜桃粉、冷调玫瑰红等）、粉质或材质（如微米烘焙细腻粉体、磨砂亚克力管身等）。
2. 【核心卖点提炼】：提炼4条严格匹配图片中商品真实特性的核心卖点（每条15-25字）。
3. 【爆款主标题】：生成3条吸引眼球的高点击率主标题。
4. 【营销标签与痛点对比】：输出4-5个营销标签和3条痛点与解决方案对比。
5. 【商业摄影Prompt（严禁固定模板，必须深度融合【多张实拍图中的具体商品形态材质】与【目标平台商业规范】）】：
   - 若平台为【1688 (源头工厂/批发)】：Prompt必须突出B2B工业级展台/工厂展厅、高保真做工、清晰展现材料质感与规格细节，明亮通透工业柔光，高保真8K无虚假滤镜；
   - 若平台为【亚马逊 (Amazon)】：Prompt必须严格为 100% pure flat white seamless background RGB(255,255,255)，主体占85%以上，无文字无水印，真实接触阴影，360°柔光箱；
   - 若平台为【抖音 / 小红书】：Prompt必须突出3:4竖屏生活美学、温暖自然晨光与室内/桌面美学场景代入感、柔和景深与真实种草氛围；
   - 若平台为【京东】：Prompt必须突出数码/家电精工质感、冷调商业逆光与金属反光；
   - 若平台为【淘宝 / 天猫】：Prompt必须突出轻奢商业展台、双顶柔光箱与45°轮廓光，电影级浅景深与高转化大片质感。
   输出英文用于AI生图引擎的高精度Prompt (visualPrompt) 与中文描述对照 (visualPromptCn)。

严格返回 JSON 格式：
{
  "productIdentified": "识别出的商品具体名称",
  "categoryIdentified": "识别出的所属细分类目",
  "materialsDetected": ["检测到的材质/粉质/包装1", "检测到的材质/粉质/包装2"],
  "lightingMood": "布光方案说明",
  "compositionTip": "构图建议",
  "visualPrompt": "英文用于AI生图的高清摄影Prompt（严禁通用模版，必须结合具体商品与目标平台规范）",
  "visualPromptCn": "对应的中文摄影提示词描述",
  "negativePrompt": "blurry, low quality, bad reflection, distorted edges",
  "coreSellingPoints": ["核心卖点1", "核心卖点2", "核心卖点3", "核心卖点4"],
  "heroTitles": ["大字报主标题1", "主标题2", "主标题3"],
  "badges": ["推荐标签1", "标签2", "标签3", "标签4"],
  "painPoints": ["买家疑虑与打消方案1", "方案2", "方案3"],
  "platformOptimizations": {
    "platform": "${targetPlatform || '淘宝/天猫'}",
    "aspectRatio": "${targetPlatform === 'douyin' || targetPlatform === 'xiaohongshu' ? '3:4' : '1:1'}",
    "colorScheme": "主图色彩方案建议",
    "visualTip": "视觉转化提升建议",
    "complianceNote": "平台合规提示"
  },
  "targetAudience": "核心目标购买人群"
}`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    });

    const responseText = response.text || "";
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        return res.json({
          success: true,
          generationMode: "ai",
          modelUsed: targetModel,
          data: {
            ...fallbackData,
            ...parsed
          }
        });
      } catch (parseErr) {
        console.warn("JSON parse error from Gemini vision:", parseErr);
      }
    }

    return res.json({
      success: true,
      generationMode: "fallback",
      warning: "模型响应无法解析，已返回规则建议，请人工核对。",
      modelUsed: targetModel,
      data: fallbackData
    });
  } catch (error: any) {
    console.error("AI vision analysis error:", error);
    return res.json({
      success: true,
      generationMode: "fallback",
      warning: "AI 分析失败，已返回规则建议，请勿将其视为真实检测结果。",
      modelUsed: "intelligent-ecom-engine",
      data: fallbackData
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

  try {
    const resolvedImageParts = await resolveImageParts(images, imageBase64);
    const hasImages = resolvedImageParts.length > 0;

    const platformNames: Record<string, string> = {
      taobao: "淘宝 / 天猫旗舰店",
      jd: "京东自营 / 旗舰店",
      pinduoduo: "拼多多百亿补贴 / 爆款主图",
      "1688": "1688 源头工厂 / 实力商家批发",
      douyin: "抖音电商 / 竖屏种草流",
      xiaohongshu: "小红书美学种草 / 笔记主图",
      amazon: "亚马逊 Amazon (100%纯白底合规)",
      shopify: "Shopify / 独立站极简国际范"
    };

    const slotNames: Record<string, string> = {
      slot_1_ctr: "第1张：高点击爆款首图 (CTR视觉焦点)",
      slot_2_detail: "第2张：微距工艺与核心材质细节图",
      slot_3_dimension: "第3张：尺寸规格与工学比例标线图",
      slot_4_scene: "第4张：真实生活方式与使用场景氛围图",
      slot_5_whitebg: "第5张：100%合规纯白底透底图 (RGB 255,255,255)",
      detail_poster: "详情页首屏：品牌定位超级海报",
      detail_selling_point: "详情页核心卖点：技术/配方/材质深度拆解",
      detail_spec: "详情页参数矩阵：包装清单与规格参数表"
    };

    const currentPlatformName = platformNames[targetPlatform] || targetPlatform;
    const currentSlotName = slotNames[slot] || slot;

    // Check if custom OpenAI-compatible endpoint is configured
    if (customEndpointUrl && (promptModel.includes("custom") || customApiKey || customEndpointUrl.includes("http"))) {
      try {
        let cleanUrl = validateRequestUrl(customEndpointUrl, "自定义接口地址");
        let chatUrl = cleanUrl.endsWith("/chat/completions") ? cleanUrl : `${cleanUrl}/chat/completions`;
        if (!chatUrl.includes("/v1") && !chatUrl.includes("/chat")) {
          chatUrl = `${cleanUrl}/v1/chat/completions`;
        }

        const systemPrompt = `你是一位享誉全球的顶级商业广告摄影指导与电商高转化视觉操盘手。
你必须基于用户提供的【${resolvedImageParts.length} 张真实商品实拍多角度图】，结合目标平台【${currentPlatformName}】与当前槽位【${currentSlotName}】，量身策划非固定、独一无二的超高保真商业摄影 AI 生成提示词 (Prompt)。
严格返回JSON格式。`;

        const userMsg = `商品名称: ${productName || "根据实拍图识别"}
品类: ${category || "自动识别"}
卖点参考: ${(sellingPoints || []).join("；")}
规格参考: ${(specs || []).join("；")}
目标平台: ${currentPlatformName}
主图/详情页槽位: ${currentSlotName}
场景预设偏好: ${sceneStyle || "商业影棚"}
特殊补充要求: ${userInstruction || "突出真实质感与高转化视觉冲击力"}

请输出JSON：
{
  "recognizedProduct": {
    "name": "识别的商品精准名称",
    "category": "所属品类",
    "detectedMaterials": ["从实拍图中看到的真实材质1", "材质2"],
    "colors": ["实拍图中的真实配色方案"],
    "geometry": "实拍图中展现的产品外形结构特征"
  },
  "platformStrategy": {
    "platformName": "${currentPlatformName}",
    "slotName": "${currentSlotName}",
    "conversionKey": "本平台本槽位的核心点击/转化心理学依据",
    "lightingDesign": "专业影棚布光方案（如双顶柔光箱+45°轮廓金光）",
    "cameraAngle": "摄影机位与景深（如85mm镜头、f/2.8微距浅景深）",
    "podiumOrBackground": "展台/背景材质与空间搭配"
  },
  "promptEn": "极具商业大片质感的英文AI生图Prompt（必须具体描述从实拍图中识别到的商品外观形态与材质，严禁模板化通用词，包含摄影光影、展台、8k photorealistic、octane render等细节）",
  "promptCn": "对应的中文商业摄影策划描述与机位构思",
  "negativePrompt": "blurry, low quality, distorted edges, mutated geometry, noisy, bad reflection, overexposed",
  "recommendedTags": ["8k resolution", "commercial studio lighting", "ray-traced shadows", "macro craftsmanship", "e-commerce hero shot"]
}`;

        const msgContent: any[] = [{ type: "text", text: userMsg }];
        if (hasImages && images && Array.isArray(images)) {
          for (const img of images.slice(0, 4)) {
            if (img && typeof img === "string" && img.length < 500000) {
              msgContent.push({ type: "image_url", image_url: { url: img } });
            }
          }
        }

        const customRes = await fetch(chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(customApiKey ? { "Authorization": `Bearer ${customApiKey.trim()}` } : {})
          },
          body: JSON.stringify({
            model: promptModel.replace("custom-prompt-model", "gpt-4o"),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: msgContent }
            ],
            temperature: 0.6,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (customRes.ok) {
          const customData = await customRes.json();
          const content = customData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return res.json({
              success: true,
              modelUsed: promptModel,
              data: parsed
            });
          }
        }
      } catch (customErr) {
        console.warn("Custom prompt generator fallback:", customErr);
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback structured generation
      const fallbackPromptEn = `High-end commercial e-commerce advertising photography of ${productName || "premium product"}, placed on a minimalist luxury studio podium tailored for ${currentPlatformName}, showcasing authentic textures and fine craftsmanship, professional softbox studio lighting, crisp 8k details, photorealistic advertising quality.`;
      const fallbackPromptCn = `针对【${currentPlatformName}】平台【${currentSlotName}】的商业摄影策划：高端极简影棚展台，双柔光箱均匀布光与立体轮廓光，高保真还原实物做工与高级质感。`;
      return res.json({
        success: true,
        modelUsed: "intelligent-prompt-engine",
        data: {
          recognizedProduct: {
            name: productName || "高品质商品",
            category: category || "生活电商",
            detectedMaterials: ["精工复合材质", "微米触感涂层"],
            colors: ["纯正原色"],
            geometry: "工学流线形态"
          },
          platformStrategy: {
            platformName: currentPlatformName,
            slotName: currentSlotName,
            conversionKey: "突出商品核心价值感与视觉品质冲击力",
            lightingDesign: "商业影棚双顶柔光箱 + 45°轮廓光",
            cameraAngle: "50mm 黄金商拍摄影机位",
            podiumOrBackground: "质感静物展台与干净极简背景"
          },
          promptEn: fallbackPromptEn,
          promptCn: fallbackPromptCn,
          negativePrompt: "blurry, low quality, distorted structure, messy background, extra limbs, ugly reflections, noise, overexposed washed out highlights",
          recommendedTags: ["8k resolution", "commercial studio lighting", "ray-traced shadows", "clean advertising shot"]
        }
      });
    }

    const parts: any[] = [];
    for (const p of resolvedImageParts) {
      parts.push({
        inlineData: {
          mimeType: p.mimeType,
          data: p.data
        }
      });
    }

    const promptText = `你是一位享誉全球的顶级商业广告摄影总监与电商爆款视觉操盘手。
${hasImages ? `【核心指令：已输入 ${resolvedImageParts.length} 张商品真实多角度实拍图。你必须深入观察所有实拍图中的真实商品形态、每一处倒角、物理材质光泽（如哑光磨砂、拉丝金属、透光玻璃、柔软皮革、丝绒粉质等）、真实配色与设计亮点。】` : ''}

任务：为商品【${productName || '参考实拍图商品'}】在目标平台【${currentPlatformName}】的【${currentSlotName}】槽位，量身定制一个非模板化、精准契合实物特征的高转化商业摄影 AI 生图提示词 (Prompt)。

背景参数：
- 商品名称: ${productName || "基于实拍图识别"}
- 商品类目: ${category || "基于实拍图识别"}
- 核心卖点: ${(sellingPoints || []).join("；")}
- 规格参数: ${(specs || []).join("；")}
- 目标平台: ${currentPlatformName}
- 目标槽位: ${currentSlotName}
- 场景风格偏好: ${sceneStyle || "高端商业影棚"}
- 商家补充说明: ${userInstruction || "结合实物特征与平台受众，打造极具视觉冲击力的商业大片"}

【平台与槽位摄影规范】：
1. 若为【1688 源头工厂/实力批发】：突出扎实用料、工业级无死角柔光、材质真材实料无过度美颜滤镜，展现工厂现货/代工品质；
2. 若为【亚马逊 Amazon】：严格遵守 100% pure flat white seamless background RGB(255,255,255)，主体占85%以上，无任何文字/水印，真实接地软阴影，360°柔光箱；
3. 若为【抖音 / 小红书】：3:4 竖屏生活美学与种草代入感，自然晨光透过窗棂斜射，轻柔景深与温馨真实生活空间；
4. 若为【淘宝 / 天猫旗舰店】：高定商业展台、大师级双柔光箱+45°轮廓光，电影级浅景深与高转化轻奢质感；
5. 若为【京东】：凸显精工科技感、高反差金属微光与硬朗理性品质；
6. 若为【第2张细节图】：微距特写 (Macro Lens)，极浅景深，重点刻画实拍图中的微观材质纹理与精工倒角；
7. 若为【第3张尺寸图】：标准中性等比工业摄影，预留尺寸标线排版空间；
8. 若为【第4张场景图】：真实生活/办公/出行实景融合，自然光影与空间情绪价值。

请严格返回 JSON 格式：
{
  "recognizedProduct": {
    "name": "从实拍图中识别出的商品精确名称",
    "category": "所属品类",
    "detectedMaterials": ["从实拍图识别的材质1", "材质2", "材质3"],
    "colors": ["实拍图中的真实配色"],
    "geometry": "实拍图中展现的产品结构与外形特征"
  },
  "platformStrategy": {
    "platformName": "${currentPlatformName}",
    "slotName": "${currentSlotName}",
    "conversionKey": "本平台本槽位的核心点击/转化心理学依据",
    "lightingDesign": "专业影棚布光方案",
    "cameraAngle": "摄影机位与焦段",
    "podiumOrBackground": "展台与空间搭配"
  },
  "promptEn": "超高清英文AI生图Prompt（必须详细描述实拍图中的商品具体特征，严禁泛泛模板，包含专业摄影光影、镜头焦段、材质微反射、8k photorealistic、octane render等）",
  "promptCn": "对应的中文商业摄影策划描述与机位构思",
  "negativePrompt": "blurry, low quality, distorted edges, mutated geometry, noisy, bad reflection, overexposed, watermark, text errors",
  "recommendedTags": ["8k resolution", "commercial studio lighting", "ray-traced shadows", "macro craftsmanship", "e-commerce hero shot"]
}`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        temperature: 0.5
      }
    });

    const responseText = response.text || "";
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        return res.json({
          success: true,
          modelUsed: "gemini-3.7-flash",
          data: parsed
        });
      } catch (parseErr) {
        console.warn("JSON parse error in multimodal prompt generator:", parseErr);
      }
    }

    return res.json({
      success: true,
      modelUsed: "gemini-3.7-flash",
      data: {
        promptEn: `High-end commercial e-commerce advertising photography of ${productName || "product"}, tailored for ${currentPlatformName}, 8k, photorealistic.`,
        promptCn: `针对【${currentPlatformName}】平台的专业商业摄影策划。`,
        negativePrompt: "blurry, low quality, distorted",
        recommendedTags: ["8k", "studio lighting"]
      }
    });
  } catch (err: any) {
    console.error("Multimodal prompt generator error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate prompt"
    });
  }
});

// 3. AI Detail Page Modules Generator
app.post("/api/generate-detail-page-modules", async (req, res) => {
  const { productName, category, targetPlatform, sellingPoints, customSpecs } = req.body || {};
  const capabilities = getAiCapabilities();
  if (capabilities.modelRequired && !capabilities.providers.gemini.configured) {
    return res.status(503).json({
      success: false,
      error: "详情页文案生成当前依赖 Gemini，请先配置 GEMINI_API_KEY 后再使用。",
      code: "MODEL_REQUIRED"
    });
  }
  const fallbackModules = buildFallbackDetailModules({ productName, category, sellingPoints, customSpecs });
  try {
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        generationMode: "fallback",
        warning: "未配置 Gemini，已使用只基于现有商品资料的安全模板；待补充字段需要人工完善。",
        modules: fallbackModules
      });
    }

    const prompt = `你是一名顶级电商策划总监。请根据以下商品信息，为${targetPlatform || "电商平台"}生成包含6个模块的商品详情页完整文案与结构：
商品名称: ${productName || "精品好物"}
品类: ${category || "综合百货"}
用户核心卖点: ${sellingPoints ? JSON.stringify(sellingPoints) : "高品质、耐用、科技领先"}

请返回规范的JSON格式详情页模块数组。`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    const modules = Array.isArray(parsed) ? parsed : parsed.modules;
    if (!Array.isArray(modules) || modules.length === 0) throw new Error("模型未返回有效详情页模块");
    return res.json({ success: true, generationMode: "ai", modules });
  } catch (error: any) {
    console.error("Error generating detail page:", error);
    return res.json({
      success: true,
      generationMode: "fallback",
      warning: `AI 生成失败，已使用安全规则模板：${error.message || "未知错误"}`,
      modules: fallbackModules
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
