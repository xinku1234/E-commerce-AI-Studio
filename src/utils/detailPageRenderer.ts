/**
 * High-definition e-commerce Detail Page Canvas Renderer (750px Standard Mobile Width)
 * Renders complete long-scroll detail page PNG and multi-platform sliced images
 * (Taobao, Tmall, JD, 1688, Douyin, Xiaohongshu compliant).
 */

import { DetailPageModule, ProductItem } from '../types';

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface DetailSliceExport {
  index: number;
  filename: string;
  dataUrl: string;
  height: number;
}

export interface RenderDetailResult {
  fullLongImageDataUrl: string;
  totalHeight: number;
  slices: DetailSliceExport[];
}

/**
 * Renders the full 750px wide mobile detail page with all enabled modules
 */
export async function renderFullDetailPageLongImage(
  product: ProductItem,
  modules: DetailPageModule[],
  themeStyle: 'luxury-dark' | 'clean-light' | 'tech-mesh' | 'warm-lifestyle' = 'luxury-dark'
): Promise<RenderDetailResult> {
  const WIDTH = 750;
  const enabledModules = modules.filter(m => m.enabled);
  const prodImg = await loadImageSafe(product.imageUrl);

  const slices: DetailSliceExport[] = [];
  const moduleCanvases: { canvas: HTMLCanvasElement; height: number; title: string }[] = [];

  for (let i = 0; i < enabledModules.length; i++) {
    const mod = enabledModules[i];
    const modCanvas = document.createElement('canvas');
    modCanvas.width = WIDTH;
    
    let modHeight = 700;
    if (mod.type === 'hero') modHeight = 920;
    else if (mod.type === 'comparison') modHeight = 680;
    else if (mod.type === 'features') modHeight = 780;
    else if (mod.type === 'scenarios') modHeight = 720;
    else if (mod.type === 'specs') modHeight = 650;
    else if (mod.type === 'guarantee') modHeight = 560;

    modCanvas.height = modHeight;
    const ctx = modCanvas.getContext('2d');
    if (!ctx) continue;

    // Render individual module
    await renderSingleModuleSlice(ctx, WIDTH, modHeight, mod, product, prodImg, themeStyle);

    const sliceDataUrl = modCanvas.toDataURL('image/png', 0.95);
    slices.push({
      index: i + 1,
      filename: `0${i + 1}_${mod.type}_${mod.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 10)}.png`,
      dataUrl: sliceDataUrl,
      height: modHeight
    });

    moduleCanvases.push({ canvas: modCanvas, height: modHeight, title: mod.title });
  }

  // Stitch all modules into one seamless long page
  const totalHeight = moduleCanvases.reduce((acc, m) => acc + m.height, 0);
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = WIDTH;
  fullCanvas.height = totalHeight || 1000;
  const fullCtx = fullCanvas.getContext('2d');

  if (fullCtx) {
    let currentY = 0;
    for (const item of moduleCanvases) {
      fullCtx.drawImage(item.canvas, 0, currentY);
      currentY += item.height;
    }
  }

  const fullLongImageDataUrl = fullCanvas.toDataURL('image/png', 0.95);

  return {
    fullLongImageDataUrl,
    totalHeight,
    slices
  };
}

/**
 * Render a single module slice on canvas
 */
async function renderSingleModuleSlice(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mod: DetailPageModule,
  product: ProductItem,
  prodImg: HTMLImageElement | null,
  themeStyle: string
) {
  const isDark = themeStyle === 'luxury-dark' || themeStyle === 'tech-mesh';
  const cx = width / 2;

  // Background
  if (themeStyle === 'luxury-dark') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle luxury glow
    const radial = ctx.createRadialGradient(cx, height * 0.4, 40, cx, height * 0.4, width * 0.7);
    radial.addColorStop(0, 'rgba(225, 29, 72, 0.08)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  } else if (themeStyle === 'warm-lifestyle') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#fefcf8');
    grad.addColorStop(0.5, '#f7f1e7');
    grad.addColorStop(1, '#ede2d3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Clean light
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#f8fafc');
    grad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // --- Module Type 1: Hero Banner ---
  if (mod.type === 'hero') {
    // Top tag
    const tagY = 56;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(cx - 90, tagY - 16, 180, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mod.tag || '2026 年度旗舰首发', cx, tagY);

    // Big Main Title
    const titleY = 130;
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.fillText(mod.title || product.name, cx, titleY);

    // Subtitle
    const subY = 175;
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '500 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(mod.subtitle || '重塑感官体验 · 旗舰标杆之作', cx, subY);

    // Product Image in Center
    if (prodImg) {
      const imgAspect = prodImg.width / prodImg.height;
      let drawW = 380;
      let drawH = drawW / imgAspect;
      if (drawH > 400) {
        drawH = 400;
        drawW = drawH * imgAspect;
      }
      const prodX = (width - drawW) / 2;
      const prodY = 240;

      // Realistic stage shadow
      ctx.save();
      const sGrad = ctx.createRadialGradient(cx, prodY + drawH * 0.95, 20, cx, prodY + drawH * 0.95, drawW * 0.55);
      sGrad.addColorStop(0, isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)');
      sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.ellipse(cx, prodY + drawH * 0.95, drawW * 0.45, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.drawImage(prodImg, prodX, prodY, drawW, drawH);
    }

    // Bottom Highlight Banner
    const bannerY = height - 120;
    ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.85)' : '#ffffff';
    ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.4)' : '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, bannerY, width - 80, 80, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`✦ ${mod.content?.highlight || '商品亮点待商家核对后填写'}`, cx, bannerY + 40);
    return;
  }

  // --- Module Type 2: Comparison (Pain Points & Innovations) ---
  if (mod.type === 'comparison') {
    // Title
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title || '传统痛点 vs 旗舰革新', cx, 65);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText(mod.subtitle || '为什么超 98% 的用户换新都选择我们？', cx, 105);

    // Left Box: Traditional (Red/Grey)
    const boxW = (width - 100) / 2;
    const boxH = 480;
    const boxY = 145;

    // Traditional Card
    ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2';
    ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('❌ 传统普通产品', 40 + boxW / 2, boxY + 45);

    const tradPoints = mod.content?.traditional || ['材质粗糙廉价易磨损', '续航虚标频繁断电告急', '做工松垮缝隙不平整'];
    ctx.textAlign = 'left';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = isDark ? '#cbd5e1' : '#475569';
    tradPoints.forEach((pt: string, idx: number) => {
      ctx.fillText(`• ${pt}`, 60, boxY + 110 + idx * 80, boxW - 40);
    });

    // Right Card: Our Flagship (Emerald / Rose)
    const rightX = 40 + boxW + 20;
    ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5';
    ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0';
    ctx.beginPath();
    ctx.roundRect(rightX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✅ 本品旗舰升级', rightX + boxW / 2, boxY + 45);

    const ourPoints = mod.content?.ours || ['航空级精工质感经久耐用', '自研低功耗超长稳固续航', '人体工学微米级严苛工艺'];
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ourPoints.forEach((pt: string, idx: number) => {
      ctx.fillText(`★ ${pt}`, rightX + 20, boxY + 110 + idx * 80, boxW - 40);
    });
    return;
  }

  // --- Module Type 3: Tech Breakdown (Features) ---
  if (mod.type === 'features') {
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title || '4 重核心黑科技 · 澎湃实力', cx, 65);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText(mod.subtitle || '每一处细节，皆是科技与美学的结晶', cx, 105);

    const features = mod.content?.featuresList || [
      { name: '核心功能', desc: '待商家根据真实商品资料补充' },
      { name: '材质与工艺', desc: '待商家根据实物和供应链资料核对' },
      { name: '尺寸与适用范围', desc: '待商家补充准确参数' },
      { name: '使用与安全说明', desc: '待商家根据说明书补充' }
    ];

    const cardW = width - 80;
    const cardH = 120;
    const startY = 145;

    features.forEach((feat: any, idx: number) => {
      const cY = startY + idx * 145;
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff';
      ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.3)' : '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(40, cY, cardW, cardH, 16);
      ctx.fill();
      ctx.stroke();

      // Number badge
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(80, cY + cardH / 2, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`0${idx + 1}`, 80, cY + cardH / 2 + 6);

      // Feature title & desc
      ctx.textAlign = 'left';
      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(feat.name || `核心优势 0${idx + 1}`, 120, cY + 45);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText(feat.desc || '专业级品质，带来前所未有的出众体验', 120, cY + 80, cardW - 140);
    });
    return;
  }

  // --- Module Type 4: Scenarios ---
  if (mod.type === 'scenarios') {
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title || '多场景随心切换 · 真实体验', cx, 65);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText(mod.subtitle || '无论工作、居家还是差旅，皆能游刃有余', cx, 105);

    const scenes = mod.content?.scenes || [
      { title: '商务通勤', desc: '极简内敛，彰显从容专业格调' },
      { title: '居家生活', desc: '温馨舒适，融入高质感空间美学' },
      { title: '户外出行', desc: '轻巧便携，无惧移动环境挑战' }
    ];

    const sCardW = (width - 100) / 3;
    const sCardH = 480;
    const sCardY = 150;

    scenes.forEach((sc: any, idx: number) => {
      const sX = 40 + idx * (sCardW + 10);
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff';
      ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.3)' : '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sX, sCardY, sCardW, sCardH, 16);
      ctx.fill();
      ctx.stroke();

      // Scene icon placeholder
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(sX + sCardW / 2, sCardY + 80, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      const emojis = ['💼', '🏡', '✈️'];
      ctx.fillText(emojis[idx % 3], sX + sCardW / 2, sCardY + 88);

      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(sc.title, sX + sCardW / 2, sCardY + 160);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(sc.desc, sX + sCardW / 2, sCardY + 200, sCardW - 20);
    });
    return;
  }

  // --- Module Type 5: Specs & Packaging ---
  if (mod.type === 'specs') {
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title || '真实规格参数表', cx, 65);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText(mod.subtitle || '严谨工业数据 · 见证硬核品质', cx, 105);

    const specs = mod.content?.specsList || [
      { key: '商品名称', value: product.name },
      { key: '所属类目', value: product.category },
      { key: '核心材质', value: '待商家按实物补充' },
      { key: '执行标准', value: '待商家按真实检测或备案资料补充' },
      { key: '包装清单', value: '待商家按实际包装补充' }
    ];

    const tY = 150;
    const tW = width - 80;
    const rowH = 80;

    specs.forEach((item: any, idx: number) => {
      const rY = tY + idx * rowH;
      ctx.fillStyle = idx % 2 === 0 
        ? (isDark ? 'rgba(30, 41, 59, 0.9)' : '#f8fafc')
        : (isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff');
      ctx.fillRect(40, rY, tW, rowH);
      ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
      ctx.strokeRect(40, rY, tW, rowH);

      // Key
      ctx.textAlign = 'left';
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(item.key, 65, rY + 45);

      // Value
      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = '500 16px sans-serif';
      ctx.fillText(item.value, 240, rY + 45, tW - 220);
    });
    return;
  }

  // --- Module Type 6: Guarantee & Trust ---
  if (mod.type === 'guarantee') {
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mod.title || '官方严选 · 售后无忧', cx, 65);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '16px sans-serif';
    ctx.fillText(mod.subtitle || '每一次选择，皆享全程无忧保障', cx, 105);

    const badges = mod.content?.badges || [
      { label: '发货时效', sub: '待商家补充' },
      { label: '退换政策', sub: '待商家补充' },
      { label: '质保范围', sub: '待商家补充' },
      { label: '客服方式', sub: '待商家补充' }
    ];

    const gW = (width - 100) / 2;
    const gH = 150;

    badges.forEach((b: any, idx: number) => {
      const row = Math.floor(idx / 2);
      const col = idx % 2;
      const bX = 40 + col * (gW + 20);
      const bY = 160 + row * (gH + 20);

      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff';
      ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.3)' : '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bX, bY, gW, gH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️ ${b.label}`, bX + gW / 2, bY + 60);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText(b.sub, bX + gW / 2, bY + 100);
    });
    return;
  }
}
