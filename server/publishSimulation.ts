const CHANNEL_NAMES: Record<string, string> = {
  taobao: '淘宝 / 天猫旗舰店',
  jd: '京东开放平台 (JD.com)',
  pinduoduo: '拼多多商家后台',
  '1688': '1688 阿里巴巴工贸批发店',
  douyin: '抖音电商 (抖店 / 巨量百应)',
  xiaohongshu: '小红书专业号电商',
  amazon: 'Amazon Seller Central (US/EU)',
  shopify: 'Shopify Global Storefront'
};

export interface PublishSimulationInput {
  targetChannels?: unknown;
  publishOptions?: { mode?: unknown };
}

export function simulateChannelPublish(input: PublishSimulationInput) {
  const requested = input.targetChannels ?? ['taobao', 'jd', 'douyin', '1688'];
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new Error('targetChannels 必须是非空数组');
  }

  const channels = [...new Set(requested)];
  if (channels.some((channel) => typeof channel !== 'string' || !CHANNEL_NAMES[channel])) {
    throw new Error('targetChannels 包含不支持的渠道');
  }

  const mode = input.publishOptions?.mode === 'draft' ? 'draft' : 'simulated';
  const results = channels.map((channelKey) => ({
    channelId: channelKey,
    channelName: CHANNEL_NAMES[channelKey],
    status: mode,
    publishedAt: new Date().toISOString(),
    remoteItemId: `DEMO_${channelKey.toUpperCase()}_${Math.floor(10000000 + Math.random() * 90000000)}`,
    complianceScore: 100,
    complianceChecks: buildComplianceChecks(channelKey),
    publishUrl: null,
    assetsCount: { heroImages: 5, detailSlices: 6, videoShort: 1 }
  }));

  return {
    success: true,
    simulated: true,
    batchId: `DEMO_BATCH_${Date.now()}`,
    dispatchedCount: results.length,
    channelsResult: results,
    message: '模拟分发完成：未调用任何电商平台真实接口。'
  };
}

function buildComplianceChecks(channelKey: string) {
  if (channelKey === '1688') {
    return [
      { rule: '源头实力工厂/B2B 认证标校验', status: 'preview', note: '规则预览，不代表平台审核结果' },
      { rule: '五张主图结构', status: 'preview', note: '检查点击、细节、尺寸、场景和白底槽位' },
      { rule: '阶梯批发与代发信息', status: 'preview', note: '需要发布前人工确认' }
    ];
  }
  if (channelKey === 'amazon') {
    return [
      { rule: 'RGB(255,255,255) 白底', status: 'preview', note: '根据本地图片检测结果预览' },
      { rule: '商品主体占比', status: 'preview', note: '建议人工确认达到平台要求' },
      { rule: '文字与侵权元素', status: 'preview', note: '不能替代平台或法律审核' }
    ];
  }
  if (channelKey === 'taobao' || channelKey === 'jd') {
    return [
      { rule: '首图尺寸与画幅', status: 'preview', note: '根据当前物料规格预览' },
      { rule: '第五张白底图', status: 'preview', note: '需要人工确认商品边缘和背景' },
      { rule: '广告极限词', status: 'preview', note: '规则预览，发布前仍需人工复核' }
    ];
  }
  if (channelKey === 'douyin' || channelKey === 'xiaohongshu') {
    return [
      { rule: '竖屏比例适配', status: 'preview', note: '检查 3:4 / 9:16 物料' },
      { rule: '界面安全边距', status: 'preview', note: '需要在真实客户端中复核' }
    ];
  }
  return [{ rule: '通用图片规格', status: 'preview', note: '规则预览，不代表渠道审核通过' }];
}
