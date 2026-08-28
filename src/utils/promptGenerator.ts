import { ProductItem, PlatformId, HeroSuiteSlot } from '../types';

export interface GeneratedPromptResult {
  promptEn: string;
  promptCn: string;
  lightingMood: string;
  compositionTip: string;
  visualTip: string;
  materials: string[];
  colorScheme: string;
  aspectRatio: string;
  negativePrompt: string;
  tags: string[];
}

/**
 * Converts a free-form creative direction into a stable, reusable prompt contract.
 * Keeping the blocks explicit makes prompts easier to review, batch, and route to
 * different image providers without changing the product identity requirements.
 */
export function buildEcommercePromptBlocks(options: {
  productName: string;
  creativeDirection: string;
  platform: string;
  aspectRatio: string;
  negativePrompt: string;
  hasReferenceImages?: boolean;
  locale?: 'en' | 'zh';
}): string {
  if (options.locale === 'en') {
    const reference = options.hasReferenceImages
      ? 'REFERENCE PRESERVATION: preserve exact silhouette, proportions, colors, materials, labels, ports, buttons, seams, and construction from the supplied photos. Do not redesign or merge variants.'
      : 'PRODUCT IDENTITY: depict one coherent product with credible geometry and materials. Do not invent brand marks or product variants.';
    return [
      'E-COMMERCE IMAGE PROMPT v1',
      `SUBJECT: ${options.productName}`,
      `OBJECTIVE: create a commercial product visual for ${options.platform}.`,
      reference,
      `COMPOSITION: ${options.creativeDirection}; ${options.aspectRatio} aspect ratio, clear subject separation, simple background, safe margins.`,
      'LIGHTING AND MATERIAL: physically plausible commercial lighting, accurate material response, natural contact shadow, clean edges, controlled reflections.',
      'PLATFORM CONSTRAINTS: keep the product as the only visual priority; do not render promotional text, price, logo, or watermark unless explicitly requested.',
      `NEGATIVE CONSTRAINTS: ${options.negativePrompt}`
    ].join('\n');
  }
  const reference = options.hasReferenceImages
    ? '参考图约束：严格保持商品轮廓、比例、颜色、材质、标签、接口、按键、车线和结构，不重设计、不混合不同商品。'
    : '商品身份约束：只生成一个结构完整、比例可信的商品，不虚构品牌标识或额外型号。';
  return [
    '电商生图提示词协议 v1',
    `主体：${options.productName}`,
    `目标：为${options.platform}生成可用于商品展示的商业视觉。`,
    reference,
    `构图：${options.creativeDirection}；画幅 ${options.aspectRatio}，主体清晰分离，背景简洁，保留安全边距。`,
    '光线与材质：物理可信的商业影棚或生活方式布光，准确还原材质反射，保留自然接触阴影，避免脏反光。',
    '平台约束：商品是唯一视觉重点；除非明确要求，不在图片内生成促销文字、价格、Logo 或水印。',
    `负面约束：${options.negativePrompt}`
  ].join('\n');
}

/**
 * Intelligently combines Product characteristics (materials, category, form factor)
 * with Target Platform specifications (1688, Taobao, Douyin, Amazon, JD, Pinduoduo, Xiaohongshu)
 * to generate professional, tailored commercial photography prompts.
 */
export function generatePlatformProductPrompt(
  product: ProductItem,
  platformId: PlatformId = 'taobao',
  slotType: HeroSuiteSlot = 'slot_1_ctr',
  sceneStyleId?: string
): GeneratedPromptResult {
  const productName = product?.name || '高品质商品';
  const category = (product?.category || '').toLowerCase();
  const name = (product?.name || '').toLowerCase();
  const points = product?.sellingPoints || [];

  // 1. Detect Category & Material Traits
  let materials: string[] = ['精工合金骨架', '细腻触感涂层', '高品质复合材质'];
  let materialTraitEn = 'premium tactile surface and refined craftsmanship';
  let categoryVibeEn = 'commercial studio setup';
  let categoryVibeCn = '商业影棚精工质感';

  const isBlushOrCosmetic = 
    name.includes('腮红') || name.includes('blush') || name.includes('口红') || 
    name.includes('唇膏') || name.includes('眼影') || name.includes('散粉') || 
    name.includes('粉底') || name.includes('高光') || name.includes('彩妆') || 
    category.includes('美妆') || category.includes('彩妆');

  const isSkincare = 
    name.includes('水') || name.includes('乳') || name.includes('霜') || 
    name.includes('精华') || name.includes('面膜') || name.includes('洁面') || 
    category.includes('护肤') || category.includes('个护');

  const is3CDigital = 
    name.includes('耳') || name.includes('音') || name.includes('充') || 
    name.includes('线') || name.includes('机') || name.includes('数码') || 
    name.includes('表') || category.includes('3c') || category.includes('数码') || category.includes('家电');

  const isApparelBag = 
    name.includes('包') || name.includes('衣') || name.includes('服') || 
    name.includes('裤') || name.includes('鞋') || name.includes('裙') || 
    category.includes('服装') || category.includes('箱包') || category.includes('鞋');

  const isFoodDrink = 
    name.includes('茶') || name.includes('咖啡') || name.includes('饮') || 
    name.includes('食') || name.includes('粮') || name.includes('酒') || 
    category.includes('食品') || category.includes('生鲜') || category.includes('饮料');

  if (isBlushOrCosmetic) {
    materials = ['微米级细腻粉体/膏体', '透光高定亚克力外壳', '精密磁吸锁扣'];
    materialTraitEn = 'velvety micro-fine powder texture, sleek crystal acrylic casing with subtle light refraction';
    categoryVibeEn = 'luxury cosmetic aesthetic, delicate reflections';
    categoryVibeCn = '高级彩妆质感、细腻粉质与透光外壳';
  } else if (isSkincare) {
    materials = ['高硼硅极简玻璃瓶', '真空避光活性保存层', '精密电镀压泵'];
    materialTraitEn = 'translucent frosted glass bottle, crystal clear fluid essence, clean metallic dropper';
    categoryVibeEn = 'refreshing hydration, clean water ripples, pure skincare aesthetic';
    categoryVibeCn = '透亮玻璃瓶身、水光凝露与纯净透澈光影';
  } else if (is3CDigital) {
    materials = ['阳极氧化航空铝', '记忆亲肤蛋白皮/磨砂外壳', '精工镀钛振膜/金属触点'];
    materialTraitEn = 'anodized aerospace aluminum, matte anti-fingerprint coating, precision CNC edges';
    categoryVibeEn = 'high-tech minimalist presentation, crisp specular highlights';
    categoryVibeCn = '航天级金属阳极氧化质感、利落高光边缘';
  } else if (isApparelBag) {
    materials = ['900D高密度纳米抗撕裂面料', '定制静音防水拉链', '人体工学透气网布'];
    materialTraitEn = 'textured water-repellent weave, precision stitching, premium matte metal hardware';
    categoryVibeEn = 'tactile fabric weave detail, urban commuter aesthetic';
    categoryVibeCn = '挺括面料纹理、精细车线与防泼水荷叶质感';
  } else if (isFoodDrink) {
    materials = ['食品级铝箔保鲜阻隔袋', '环保天然原木/纸浆盒', '充氮锁香密封罐'];
    materialTraitEn = 'rich natural organic ingredients, artisanal packaging, aroma steam vapor';
    categoryVibeEn = 'fresh appetizing warmth, natural raw ingredients atmosphere';
    categoryVibeCn = '源头原产地新鲜感、充氮锁鲜与食欲感光泽';
  }

  // 2. Generate based on Slot & Platform Combination
  let promptEn = '';
  let promptCn = '';
  let lightingMood = '';
  let compositionTip = '';
  let visualTip = '';
  let colorScheme = '';
  let aspectRatio = '1:1';
  const negativePrompt = 'blurry, low quality, distorted structure, messy background, extra limbs, ugly reflections, noise, overexposed washed out highlights, bad proportions, watermark, text errors';

  switch (platformId) {
    case '1688': {
      aspectRatio = '1:1';
      colorScheme = '工业高亮白 / 源头工厂质感灰 / 醒目工业橙';
      lightingMood = '大功率工业级无死角柔光箱 + 均匀泛光 + 98Ra高显色白平衡';
      compositionTip = '居中大主体构图，展示产品扎实用料与批次做工，为左上角工厂标和底部批发价预留排版空间';
      visualTip = '突出“源头实力工厂/支持拿样/一件代发”等B2B核心诉求，强调实物质感与做工，杜绝过度虚化';

      if (slotType === 'slot_2_detail') {
        promptEn = `B2B wholesale macro craftsmanship photography of ${productName}, extreme close-up showing authentic ${materialTraitEn}, industrial quality inspection lighting, razor sharp micro details, zero distortion, OEM manufacturing grade clarity, 8k.`;
        promptCn = `1688源头工厂做工特写图：微距展现${productName}的${categoryVibeCn}，工业质检级均匀光照，清晰展现扎实用料与精密工艺。`;
      } else if (slotType === 'slot_3_dimension') {
        promptEn = `Technical dimensional catalog photography of ${productName}, placed in a clean industrial engineering studio with subtle isometric measurement grid, sharp neutral white studio lighting, clear product scale reference, 8k.`;
        promptCn = `1688规格箱规参考图：标准中性工业影棚，清晰展示${productName}真实比例与结构尺寸，便于B2B批发采购商核算。`;
      } else if (slotType === 'slot_4_scene') {
        promptEn = `Commercial industrial B2B application scene for ${productName}, modern factory showroom display or realistic commercial warehouse backdrop, clean organized environment, professional lighting, 8k.`;
        promptCn = `1688实力展厅场景图：置于现代化工厂展厅/专业商用场景，凸显${productName}源头供应实力与批量现货底气。`;
      } else if (slotType === 'slot_5_whitebg') {
        promptEn = `Isolated product shot of ${productName} on a 100% pure flat white background RGB(255, 255, 255), commercial wholesale catalog lighting, crisp edges, subtle contact ground shadow, 8k, 1688 and Taobao compliant.`;
        promptCn = `1688合规纯白底图：100% RGB(255,255,255)白底透底，无任何水印杂物，入选超级买家与官方大市场推荐。`;
      } else {
        // Slot 1 CTR (1688 Source Factory Focus)
        promptEn = `Commercial B2B wholesale product photography of ${productName}, showcasing authentic ${materialTraitEn}, placed on a clean solid industrial studio podium, bright uniform commercial lighting, sharp crisp edges, high dynamic range, 8k resolution, factory direct wholesale quality look.`;
        promptCn = `1688源头实力工厂首图：高清展现${productName}真实材质做工，明亮通透工业影棚光，凸显源头直供与扎实质感，高转化B2B点击率。`;
      }
      break;
    }

    case 'douyin': {
      aspectRatio = '3:4';
      colorScheme = '生活美学暖木色 / 晨光金 / 沉浸黑';
      lightingMood = '侧面温暖自然晨光 + 景深虚化窗影光斑 + 柔和补光';
      compositionTip = '3:4 竖屏生活美学构图，重点避开底部20%交互与购物车遮挡区，产品置于黄金视线偏上方';
      visualTip = '竖屏种草流，重点突出场景氛围、手持质感与真实生活代入感';

      if (slotType === 'slot_2_detail') {
        promptEn = `Macro lifestyle detail photography of ${productName}, delicate focus on ${materialTraitEn}, warm golden hour window light, soft organic depth of field, 8k tactile realism.`;
        promptCn = `抖音美学细节图：微距展现${productName}的${materials[0]}细节，温暖斜射晨光与柔和景深，营造高级生活仪式感。`;
      } else if (slotType === 'slot_4_scene') {
        promptEn = `Cinematic 3:4 vertical lifestyle setting of ${productName}, integrated naturally into a modern cozy Scandinavian living space, morning sunlight filtering through sheer curtains, authentic aspirational atmosphere, 8k.`;
        promptCn = `抖音竖屏生活实景图：${productName}自然融入现代温馨家居/通勤空间，轻透窗纱与自然光影，极具种草代入感。`;
      } else {
        promptEn = `Aesthetic 3:4 vertical commercial photography of ${productName}, placed in a stylish modern aesthetic environment, warm natural directional sunlight with soft organic shadows, highlighting ${materialTraitEn}, cinematic depth of field, 8k organic lighting.`;
        promptCn = `抖音3:4竖屏爆款首图：温暖自然晨光斜射，完美衬托${productName}的${categoryVibeCn}，生活美学质感与高转化吸睛视觉。`;
      }
      break;
    }

    case 'xiaohongshu': {
      aspectRatio = '3:4';
      colorScheme = '高级莫兰迪色 / 奶油暖白 / 清透浅粉';
      lightingMood = '柔和漫射日光 + 梦幻柔焦光斑 + 极简高雅色调';
      compositionTip = '小红书排版留白美学，留出顶部标题空间，画面通透治愈';
      visualTip = '强调“种草感”与“日常情绪价值”，拒绝生硬硬广感，突出精致高颜值';

      promptEn = `Minimalist aesthetic lifestyle flatlay photography of ${productName}, soft diffused natural daylight, dreamy pastel neutral cream background, delicate curated props, showcasing ${materialTraitEn}, clean editorial fashion magazine cover layout, 8k.`;
      promptCn = `小红书美学种草风摄影：柔和漫射天光与奶油质感背景，精巧烘托${productName}的高颜值细节与治愈生活美学。`;
      break;
    }

    case 'amazon': {
      aspectRatio = '1:1';
      colorScheme = '100% 纯白底 RGB (255, 255, 255)';
      lightingMood = '360° 全方位柔光箱环形无影照明 + 标准 5500K 白平衡';
      compositionTip = '主体严格占画面 85% 以上，绝对居中摆放，无文字、无水印、无杂物';
      visualTip = '严格遵守亚马逊官方合规规范，首图必须纯白无文字，边缘锐利，真实倒影/接地阴影';

      promptEn = `Commercial studio product photography of ${productName} on a 100% pure flat white seamless background RGB (255, 255, 255), professional 360-degree softbox illumination, sharp pristine contour lines, subtle soft contact shadow at base, 85% frame filling, no text, no watermark, Amazon compliant hero image, 8k.`;
      promptCn = `100% RGB纯白无缝背景商业影棚摄影，高锐度轮廓光与自然接触阴影，主体占比≥85%，完全符合亚马逊主图严苛合规要求。`;
      break;
    }

    case 'jd': {
      aspectRatio = '1:1';
      colorScheme = '深空钛灰 / 科技纯白 / 京东正品红';
      lightingMood = '冷调商业侧逆光 + 45° 金属高光反射 + 双顶柔光箱';
      compositionTip = '居中黄金比例排布，左上角预留京东红自营/自营正品标，下方留出促销腰封空间';
      visualTip = '突出数码家电/品质好物的精密做工与金属/镜面高光，展现大牌可靠品质';

      promptEn = `High-precision commercial studio shoot of ${productName}, sleek metallic and matte slate pedestal, sharp specular highlights accentuating ${materialTraitEn}, crisp edge definition, cool neutral commercial lighting, 8k crystal clear engineering quality, JD flagship look.`;
      promptCn = `京东品质旗舰商业大片：硬朗精密展台与高反差金属微光，强调${productName}精湛做工与正品科技质感。`;
      break;
    }

    case 'pinduoduo': {
      aspectRatio = '1:1';
      colorScheme = '高反差爆款红 / 醒目明黄 / 活力深色';
      lightingMood = '高对比度前置主光 + 鲜艳饱满色彩打光 + 高饱和度';
      compositionTip = '大主体居中饱满构图，四周留出百亿补贴标与超大抢购价格牌空间';
      visualTip = '高视觉冲击力与反差对比，突出超值性价比与爆款热销感';

      promptEn = `High visual impact commercial photography of ${productName}, vibrant clean studio setup, crystal clear centered product focus, bright dynamic front key light, vivid rich color contrast highlighting ${materialTraitEn}, bold commercial catalog quality, 8k crisp details.`;
      promptCn = `拼多多高点击爆款商业摄影：高反差明亮动态布光，居中聚焦突显${productName}形态与极致性价比视觉张力。`;
      break;
    }

    case 'taobao':
    default: {
      aspectRatio = '1:1';
      colorScheme = '天猫高奢金 / 极简纯净白 / 商业深空灰';
      lightingMood = '商业影棚双顶柔光箱 + 45° 高光反射轮廓光 + 柔和环境漫反射';
      compositionTip = '黄金分割居中排布，留出顶部主标题与底部大促腰封打标空间，文字面积<20%';
      visualTip = '突出材质高光与3D立体质感，光影层次丰富，高转化率旗舰店爆款视觉';

      promptEn = `Flagship commercial e-commerce advertising photography of ${productName}, placed on a high-end sleek podium with elegant subtle reflections, double softbox studio key lighting, dramatic warm golden rim light highlighting ${materialTraitEn}, shallow cinematic depth of field, 8k hyper-realistic octane render look.`;
      promptCn = `天猫旗舰店爆款主图商业摄影：${productName}置于轻奢展台，大师级双顶柔光箱与45°轮廓光，电影级浅景深与高转化质感。`;
      break;
    }
  }

  return {
    promptEn: buildEcommercePromptBlocks({
      productName,
      creativeDirection: promptEn,
      platform: platformId,
      aspectRatio,
      negativePrompt,
      hasReferenceImages: Boolean(product?.images?.length || product?.imageUrl),
      locale: 'en'
    }),
    promptCn: buildEcommercePromptBlocks({
      productName,
      creativeDirection: promptCn,
      platform: platformId,
      aspectRatio,
      negativePrompt,
      hasReferenceImages: Boolean(product?.images?.length || product?.imageUrl),
      locale: 'zh'
    }),
    lightingMood,
    compositionTip,
    visualTip,
    materials,
    colorScheme,
    aspectRatio,
    negativePrompt,
    tags: [
      `商品: ${productName}`,
      `平台: ${platformId.toUpperCase()}`,
      `品类: ${product.category || '电商商品'}`,
      `质感: ${materials[0] || '精工材质'}`
    ]
  };
}

/**
 * Calls the backend multimodal Gemini prompt generator using all multi-angle reference photos
 * and falls back to deterministic platform heuristics if backend is unreachable.
 */
export async function fetchMultimodalPlatformPrompt(
  product: ProductItem,
  platformId: PlatformId = 'taobao',
  slotType: HeroSuiteSlot = 'slot_1_ctr',
  sceneStyleId?: string,
  images?: string[]
): Promise<GeneratedPromptResult> {
  const fallback = generatePlatformProductPrompt(product, platformId, slotType, sceneStyleId);
  try {
    const candidateImages = (images && images.length > 0) ? images : (product.images || [product.imageUrl]).filter(Boolean);
    const platformNames: Record<string, string> = {
      taobao: '淘宝 / 天猫',
      jd: '京东',
      douyin: '抖音',
      '1688': '1688 (源头工厂/批发)',
      pinduoduo: '拼多多',
      xiaohongshu: '小红书',
      amazon: '亚马逊 (Amazon)'
    };

    const res = await fetch('/api/generate-multimodal-platform-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: product.name,
        category: product.category,
        targetPlatform: platformNames[platformId] || platformId,
        sceneStyle: sceneStyleId,
        activeSlot: slotType,
        images: candidateImages.slice(0, 6),
        sellingPoints: product.sellingPoints
      })
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const d = json.data;
        return {
          promptEn: d.promptEn || fallback.promptEn,
          promptCn: d.promptCn || fallback.promptCn,
          lightingMood: d.lightingMood || fallback.lightingMood,
          compositionTip: d.compositionTip || fallback.compositionTip,
          visualTip: d.visualTip || fallback.visualTip,
          materials: (d.materialsDetected && d.materialsDetected.length > 0) ? d.materialsDetected : fallback.materials,
          colorScheme: d.colorScheme || fallback.colorScheme,
          aspectRatio: d.aspectRatio || fallback.aspectRatio,
          negativePrompt: d.negativePrompt || fallback.negativePrompt,
          tags: (d.recommendedTags && d.recommendedTags.length > 0) ? d.recommendedTags : fallback.tags
        };
      }
    }
  } catch (err) {
    console.warn('Multimodal prompt fetch fallback:', err);
  }
  return fallback;
}
