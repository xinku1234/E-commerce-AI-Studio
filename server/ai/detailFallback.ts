function normalizeSellingPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6);
}

function normalizeSpecs(value: unknown): Array<{ key: string; value: string }> {
  if (Array.isArray(value)) {
    return value
      .map((item: any) => ({ key: String(item?.key || item?.name || '').trim(), value: String(item?.value || '').trim() }))
      .filter((item) => item.key && item.value)
      .slice(0, 12);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, itemValue]) => itemValue != null && String(itemValue).trim())
      .map(([key, itemValue]) => ({ key, value: String(itemValue) }))
      .slice(0, 12);
  }
  return [];
}

export function buildFallbackDetailModules(input: { productName?: unknown; category?: unknown; sellingPoints?: unknown; customSpecs?: unknown }) {
  const productName = typeof input.productName === 'string' && input.productName.trim() ? input.productName.trim() : '商品名称待补充';
  const category = typeof input.category === 'string' && input.category.trim() ? input.category.trim() : '商品类目待补充';
  const points = normalizeSellingPoints(input.sellingPoints);
  const specs = normalizeSpecs(input.customSpecs);
  const safePoints = points.length > 0 ? points : ['核心卖点待商家补充', '材质、功能与适用范围请按真实商品信息填写'];

  return [
    { id: 'hero_banner', type: 'hero', title: productName, subtitle: category, tag: '商品详情', accentColor: '#E02424', bgStyle: 'luxury-dark', enabled: true, content: { highlight: safePoints[0], bulletPoints: safePoints.slice(0, 4) } },
    { id: 'core_features', type: 'features', title: '核心特点', subtitle: '基于当前商品资料整理', accentColor: '#4F46E5', bgStyle: 'tech-mesh', enabled: true, content: { featuresList: safePoints.map((point, index) => ({ name: `特点 ${index + 1}`, desc: point })) } },
    { id: 'buyer_questions', type: 'comparison', title: '购买前请确认', subtitle: '避免因信息缺失产生预期偏差', accentColor: '#D97706', bgStyle: 'clean-light', enabled: true, content: { traditional: ['尺寸、颜色、材质以商品实物和已填写参数为准', '未提供的认证与性能数据不作承诺'], ours: ['补充真实规格后再发布', '关键功能和适用范围建议人工复核'] } },
    { id: 'scenarios', type: 'scenarios', title: '适用场景', subtitle: '请按照商品真实用途补充', accentColor: '#059669', bgStyle: 'warm-lifestyle', enabled: true, content: { scenes: [{ title: '核心使用场景', desc: '待商家根据商品真实用途补充' }] } },
    { id: 'specs_table', type: 'specs', title: '商品规格参数', subtitle: '发布前请核对所有数据', accentColor: '#4B5563', bgStyle: 'clean-light', enabled: true, content: { specsList: specs.length > 0 ? specs : [{ key: '规格信息', value: '待商家补充并核对' }] } },
    { id: 'trust_guarantee', type: 'guarantee', title: '服务与售后说明', subtitle: '以下内容需按店铺真实政策填写', accentColor: '#DC2626', bgStyle: 'luxury-dark', enabled: true, content: { badges: [{ label: '发货时效', sub: '待商家补充' }, { label: '退换政策', sub: '待商家补充' }, { label: '质保范围', sub: '待商家补充' }, { label: '客服方式', sub: '待商家补充' }] } }
  ];
}
