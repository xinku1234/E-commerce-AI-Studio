export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  taobao: '淘宝 / 天猫旗舰店',
  jd: '京东自营 / 旗舰店',
  pinduoduo: '拼多多百亿补贴 / 爆款主图',
  '1688': '1688 源头工厂 / 实力商家批发',
  douyin: '抖音电商 / 竖屏种草流',
  xiaohongshu: '小红书美学种草 / 笔记主图',
  amazon: '亚马逊 Amazon (100%纯白底合规)',
  shopify: 'Shopify / 独立站极简国际范'
};

export const SLOT_DISPLAY_NAMES: Record<string, string> = {
  slot_1_ctr: '第1张：高点击爆款首图 (CTR视觉焦点)',
  slot_2_detail: '第2张：微距工艺与核心材质细节图',
  slot_3_dimension: '第3张：尺寸规格与工学比例标线图',
  slot_4_scene: '第4张：真实生活方式与使用场景氛围图',
  slot_5_whitebg: '第5张：100%合规纯白底透底图 (RGB 255,255,255)',
  detail_poster: '详情页首屏：品牌定位超级海报',
  detail_selling_point: '详情页核心卖点：技术/配方/材质深度拆解',
  detail_spec: '详情页参数矩阵：包装清单与规格参数表'
};

const PLATFORM_PHOTO_RULES = [
  '1688 源头工厂/批发：突出扎实用料、工业级无死角柔光、真实材质与规格细节，不做过度美化；',
  '亚马逊 Amazon：严格 100% pure flat white seamless background RGB(255,255,255)，主体占比 85% 以上，无文字无水印，保留真实接触阴影；',
  '抖音 / 小红书：3:4 竖屏生活美学与种草代入感，自然光线与真实生活空间，柔和景深；',
  '淘宝 / 天猫：轻奢商业展台、双顶柔光箱与 45 度轮廓光，电影级浅景深；',
  '京东：精工科技质感、冷调商业逆光与金属反光；',
  '细节图槽位：微距镜头、极浅景深，刻画实拍图中的真实纹理与倒角；',
  '尺寸图槽位：中性等比工业摄影，为尺寸标线预留排版空间；',
  '场景图槽位：真实生活/办公/出行实景融合，自然光影与空间情绪。'
].join('\n');

/**
 * Prompt-as-code: the request is assembled from explicit, reviewable blocks so
 * the model receives the same contract regardless of which provider serves it.
 */
export function buildProductAnalysisPrompt(options: {
  productName?: unknown;
  category?: unknown;
  targetPlatform?: unknown;
  userNotes?: unknown;
  imageCount: number;
}): string {
  const productName = typeof options.productName === 'string' && options.productName.trim() ? options.productName.trim() : '';
  const category = typeof options.category === 'string' && options.category.trim() ? options.category.trim() : '自动识别';
  const platform = typeof options.targetPlatform === 'string' && options.targetPlatform.trim() ? options.targetPlatform.trim() : '淘宝/天猫';
  const notes = typeof options.userNotes === 'string' && options.userNotes.trim() ? options.userNotes.trim() : '突出真实质感与高转化核心卖点';
  const imageBlock = options.imageCount > 0
    ? `已上传 ${options.imageCount} 张商品实拍图，必须基于实拍图中的真实外观、做工、材质光泽与配色进行识别，不得套用通用模板。`
    : '本次没有实拍图，只能基于文字信息推断，所有无法确认的结论必须标注为待商家核对。';

  return [
    '电商商品分析任务 v1',
    `参考图约束：${imageBlock}`,
    `商品名称：${productName || '（请基于实拍图识别具体商品名称）'}`,
    `所选类目：${category}`,
    `目标平台：${platform}`,
    `商家要求：${notes}`,
    '事实约束：严禁编造认证、检测数据、成分含量、保修年限、销量与排名；无法从实拍图或输入信息确认的内容必须写成待商家核对。',
    `平台摄影规范：\n${PLATFORM_PHOTO_RULES}`,
    '请严格返回如下 JSON 对象（不要输出其他文字）：',
    JSON.stringify({
      productIdentified: '识别出的商品具体名称',
      categoryIdentified: '识别出的细分类目',
      materialsDetected: ['识别到的材质或包装1', '材质2'],
      lightingMood: '布光方案说明',
      compositionTip: '构图建议',
      visualPrompt: '英文商业摄影生图 Prompt，结合具体商品与目标平台规范',
      visualPromptCn: '对应的中文摄影提示词',
      negativePrompt: 'blurry, low quality, distorted edges',
      coreSellingPoints: ['核心卖点1', '核心卖点2', '核心卖点3', '核心卖点4'],
      heroTitles: ['主标题1', '主标题2', '主标题3'],
      badges: ['标签1', '标签2', '标签3', '标签4'],
      painPoints: ['买家顾虑与打消方案1', '方案2', '方案3'],
      platformOptimizations: {
        platform,
        aspectRatio: '1:1 或 3:4',
        colorScheme: '主图配色方案',
        visualTip: '视觉转化建议',
        complianceNote: '平台合规提示'
      },
      targetAudience: '核心目标人群'
    }, null, 2)
  ].join('\n\n');
}

export function buildPlatformPromptRequest(options: {
  productName?: unknown;
  category?: unknown;
  sellingPoints?: unknown;
  specs?: unknown;
  platformName: string;
  slotName: string;
  sceneStyle?: unknown;
  userInstruction?: unknown;
  imageCount: number;
}): string {
  const points = Array.isArray(options.sellingPoints) ? options.sellingPoints.filter(Boolean).join('；') : '';
  const specs = Array.isArray(options.specs) ? options.specs.filter(Boolean).join('；') : '';
  const imageBlock = options.imageCount > 0
    ? `已输入 ${options.imageCount} 张真实实拍图，Prompt 必须描述实拍图中的真实形态、材质与配色。`
    : '本次没有实拍图，Prompt 只能描述可从文字推断的形态，不得虚构型号与标识。';

  return [
    '商业摄影提示词生成任务 v1',
    `参考图约束：${imageBlock}`,
    `商品名称：${typeof options.productName === 'string' && options.productName.trim() ? options.productName.trim() : '基于实拍图识别'}`,
    `品类：${typeof options.category === 'string' && options.category.trim() ? options.category.trim() : '自动识别'}`,
    `卖点参考：${points || '（无）'}`,
    `规格参考：${specs || '（无）'}`,
    `目标平台：${options.platformName}`,
    `目标槽位：${options.slotName}`,
    `场景偏好：${typeof options.sceneStyle === 'string' && options.sceneStyle.trim() ? options.sceneStyle.trim() : '高端商业影棚'}`,
    `补充要求：${typeof options.userInstruction === 'string' && options.userInstruction.trim() ? options.userInstruction.trim() : '突出真实质感与高转化视觉冲击力'}`,
    `平台摄影规范：\n${PLATFORM_PHOTO_RULES}`,
    '请严格返回如下 JSON 对象（不要输出其他文字）：',
    JSON.stringify({
      recognizedProduct: {
        name: '识别的商品名称',
        category: '所属品类',
        detectedMaterials: ['真实材质1', '材质2'],
        colors: ['真实配色'],
        geometry: '外形结构特征'
      },
      platformStrategy: {
        platformName: options.platformName,
        slotName: options.slotName,
        conversionKey: '该平台该槽位的点击与转化依据',
        lightingDesign: '影棚布光方案',
        cameraAngle: '机位与焦段',
        podiumOrBackground: '展台与背景搭配'
      },
      promptEn: '英文生图 Prompt，具体描述商品外观与摄影参数',
      promptCn: '中文商业摄影策划描述',
      negativePrompt: 'blurry, low quality, distorted edges, watermark',
      recommendedTags: ['8k resolution', 'commercial studio lighting']
    }, null, 2)
  ].join('\n\n');
}

/** Only used in explicit demo mode (REQUIRE_MODEL=false), never as a silent fallback. */
export function buildDemoPlatformPrompt(options: {
  productName?: unknown;
  category?: unknown;
  platformName: string;
  slotName: string;
}) {
  const productName = typeof options.productName === 'string' && options.productName.trim() ? options.productName.trim() : 'the supplied product';
  return {
    recognizedProduct: {
      name: productName,
      category: typeof options.category === 'string' && options.category.trim() ? options.category.trim() : '待商家补充',
      detectedMaterials: ['材质待商家核对'],
      colors: ['配色待商家核对'],
      geometry: '结构待商家核对'
    },
    platformStrategy: {
      platformName: options.platformName,
      slotName: options.slotName,
      conversionKey: '演示模式下的通用建议，需人工替换',
      lightingDesign: '双顶柔光箱 + 45 度轮廓光',
      cameraAngle: '50mm 商业静物机位',
      podiumOrBackground: '简洁静物展台'
    },
    promptEn: `Commercial e-commerce product photography of ${productName} for ${options.platformName}, ${options.slotName}, softbox studio lighting, physically plausible materials, clean simple background, 8k photorealistic.`,
    promptCn: `演示模式提示词：面向【${options.platformName}】【${options.slotName}】的商业影棚方案，需人工核对后再用于生产。`,
    negativePrompt: 'blurry, low quality, distorted geometry, watermark, illegible text',
    recommendedTags: ['8k resolution', 'commercial studio lighting']
  };
}
