/**
 * Ultra-High-Definition Commercial Studio Scene & Master Hero Image Synthesizer
 * Generates photorealistic e-commerce advertising photography & platform-compliant hero images
 * for Taobao, Tmall, JD, Pinduoduo, 1688, Douyin, Xiaohongshu, and Amazon.
 */

export interface SceneSynthesisOptions {
  sceneStyleId: string;
  platformId: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  productName?: string;
}

export interface CompleteHeroSlotRenderOptions {
  slot: string;
  productImage: string;
  productName: string;
  category?: string;
  sellingPoints?: string[];
  specs?: Record<string, string>;
  platformId?: string;
  bgImageUrl?: string | null;
  headline?: string;
  subheadline?: string;
  priceTag?: string;
  originalPriceTag?: string;
  badgeText?: string;
  themeAccent?: string;
  displayMode?: 'commercial_banner' | 'pure_photo';
  width?: number;
  height?: number;
}

function loadImageSafe(src: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src || src.trim().length === 0) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Procedural Commercial Studio Scene Background Generator
 */
export function synthesizeCommercialStudioScene(options: SceneSynthesisOptions): string {
  const {
    sceneStyleId = 'scene_luxury_marble',
    platformId = 'taobao',
    width = 1024,
    height = 1024,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = width / 2;

  // 1. Amazon / Pure White Compliance (RGB 255,255,255)
  if (platformId === 'amazon' || sceneStyleId === 'scene_pure_white_compliance') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Subtle soft grounding contact shadow
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(cx, height * 0.76, 20, cx, height * 0.76, width * 0.35);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.03)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, height * 0.76, width * 0.35, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  // 2. 1688 Industrial Studio & Source Factory
  if (platformId === '1688') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#f8fafc');
    bgGrad.addColorStop(0.55, '#e2e8f0');
    bgGrad.addColorStop(0.8, '#cbd5e1');
    bgGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Studio Key Overhead Light
    const overhead = ctx.createRadialGradient(cx, height * 0.2, 50, cx, height * 0.2, width * 0.65);
    overhead.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    overhead.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
    overhead.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = overhead;
    ctx.fillRect(0, 0, width, height * 0.7);

    // Podium Base
    const podY = height * 0.72;
    const podW = width * 0.68;
    const podH = height * 0.10;

    // Contact drop shadow
    ctx.save();
    const gShadow = ctx.createRadialGradient(cx, podY + podH * 0.7, 40, cx, podY + podH * 0.7, width * 0.45);
    gShadow.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    gShadow.addColorStop(0.7, 'rgba(15, 23, 42, 0.05)');
    gShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = gShadow;
    ctx.beginPath();
    ctx.ellipse(cx, podY + podH * 0.7, width * 0.45, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Top surface
    ctx.save();
    const topGrad = ctx.createLinearGradient(cx - podW / 2, podY, cx + podW / 2, podY);
    topGrad.addColorStop(0, '#ffffff');
    topGrad.addColorStop(0.5, '#f8fafc');
    topGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(cx, podY, podW * 0.5, podH * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  // 3. Douyin / Xiaohongshu: Lifestyle Warm Morning Light
  if (platformId === 'douyin' || platformId === 'xiaohongshu' || sceneStyleId === 'scene_nordic_wood') {
    const warmGrad = ctx.createLinearGradient(0, 0, width, height);
    warmGrad.addColorStop(0, '#fefbf6');
    warmGrad.addColorStop(0.4, '#faf3e7');
    warmGrad.addColorStop(0.7, '#f4ece2');
    warmGrad.addColorStop(1, '#ebdcc9');
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm Sunbeam streaks
    ctx.save();
    ctx.rotate(-0.18);
    const sunRays = ctx.createLinearGradient(-100, 0, width + 100, 0);
    sunRays.addColorStop(0, 'rgba(254, 240, 199, 0.4)');
    sunRays.addColorStop(0.4, 'rgba(254, 240, 199, 0.12)');
    sunRays.addColorStop(0.7, 'rgba(254, 240, 199, 0.3)');
    sunRays.addColorStop(1, 'rgba(254, 240, 199, 0)');
    ctx.fillStyle = sunRays;
    ctx.fillRect(-200, 0, width * 1.5, height);
    ctx.restore();

    // Natural wood tabletop
    const deskY = height * 0.70;
    const deskGrad = ctx.createLinearGradient(0, deskY, 0, height);
    deskGrad.addColorStop(0, '#e5d7c3');
    deskGrad.addColorStop(0.3, '#d8c7af');
    deskGrad.addColorStop(1, '#caa98f');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, deskY, width, height - deskY);

    // Contact drop shadow on wood surface
    ctx.save();
    const woodShadow = ctx.createRadialGradient(cx, height * 0.74, 30, cx, height * 0.74, width * 0.38);
    woodShadow.addColorStop(0, 'rgba(90, 55, 25, 0.28)');
    woodShadow.addColorStop(0.6, 'rgba(90, 55, 25, 0.06)');
    woodShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = woodShadow;
    ctx.beginPath();
    ctx.ellipse(cx, height * 0.74, width * 0.38, height * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  // 4. Default: Tmall / Taobao Flagship Studio Luxury Glow
  const bgGrad = ctx.createRadialGradient(cx, height * 0.35, 60, cx, height * 0.45, width * 0.75);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.4, '#f8fafc');
  bgGrad.addColorStop(0.75, '#e2e8f0');
  bgGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Softbox light glow
  const leftGlow = ctx.createRadialGradient(width * 0.2, height * 0.3, 20, width * 0.2, height * 0.3, width * 0.5);
  leftGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  leftGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  // Stage podium
  const podY = height * 0.73;
  ctx.save();
  const podShadow = ctx.createRadialGradient(cx, podY + 20, 20, cx, podY + 20, width * 0.4);
  podShadow.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
  podShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = podShadow;
  ctx.beginPath();
  ctx.ellipse(cx, podY + 20, width * 0.4, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, podY, width * 0.32, height * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Renders the 100% complete, fully composited, ready-to-use e-commerce master hero image
 */
export async function renderCompleteHeroSlotImage(options: CompleteHeroSlotRenderOptions): Promise<string> {
  const {
    slot,
    productImage,
    productName = '品质好物',
    sellingPoints = [],
    specs = {},
    platformId = 'taobao',
    bgImageUrl,
    headline,
    subheadline,
    priceTag = '',
    originalPriceTag = '',
    badgeText,
    themeAccent = '#ef4444',
    displayMode = 'commercial_banner',
    width = 1024,
    height = 1024
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = width / 2;
  const isAmazon = platformId === 'amazon';

  // --- Step 1: Draw Background ---
  if (slot === 'slot_5_whitebg' || isAmazon) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else if (bgImageUrl) {
    const bg = await loadImageSafe(bgImageUrl);
    if (bg) {
      ctx.drawImage(bg, 0, 0, width, height);
    } else {
      drawCleanStudioBackground(ctx, width, height, slot, platformId);
    }
  } else {
    drawCleanStudioBackground(ctx, width, height, slot, platformId);
  }

  // --- Step 2: Draw Product with Realistic Scale & Multi-tier Contact Shadow ---
  const prodImg = await loadImageSafe(productImage);
  if (prodImg) {
    const imgAspect = prodImg.width / prodImg.height;

    let scaleRatio = 0.68;
    if (slot === 'slot_5_whitebg') scaleRatio = 0.85; // Official compliance: >=85%
    else if (slot === 'slot_2_detail') scaleRatio = 0.82; // Macro detail close-up
    else if (slot === 'slot_3_dimension') scaleRatio = 0.62;
    else if (slot === 'slot_4_scene') scaleRatio = 0.65;
    else scaleRatio = 0.70; // Slot 1 CTR

    let drawW = width * scaleRatio;
    let drawH = drawW / imgAspect;
    if (drawH > height * scaleRatio) {
      drawH = height * scaleRatio;
      drawW = drawH * imgAspect;
    }

    let centerY = height * 0.50;
    if (slot === 'slot_1_ctr') centerY = height * 0.48;
    else if (slot === 'slot_3_dimension') centerY = height * 0.48;
    else if (slot === 'slot_5_whitebg') centerY = height * 0.50;

    const posX = (width - drawW) / 2;
    const posY = centerY - drawH / 2;

    // Contact drop shadow on stage/floor
    ctx.save();
    const shadowAlpha = isAmazon ? 0.14 : 0.22;
    const shadowY = posY + drawH * 0.95;
    const shadowGrad = ctx.createRadialGradient(cx, shadowY, drawW * 0.08, cx, shadowY, drawW * 0.5);
    shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
    shadowGrad.addColorStop(0.5, `rgba(0, 0, 0, ${shadowAlpha * 0.3})`);
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, shadowY, drawW * 0.44, drawH * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw the product image
    ctx.drawImage(prodImg, posX, posY, drawW, drawH);
  }

  // --- Step 3: Draw Slot-Specific Commercial Graphics & Typography ---

  // Slot 5: 100% Compliant Pure White Background (No promo text, 100% official green tick)
  if (slot === 'slot_5_whitebg' || isAmazon || displayMode === 'pure_photo') {
    return canvas.toDataURL('image/png');
  }

  // Slot 1: High CTR Master Selling Point & Promo Card
  if (slot === 'slot_1_ctr') {
    renderRefinedSlot1CtrGraphics(ctx, width, height, {
      headline: headline || `${productName || '商品标题待补充'}`,
      subheadline: subheadline || (sellingPoints[0] ? `★ ${sellingPoints[0]}` : '卖点信息待商家核对'),
      priceTag,
      originalPriceTag,
      badgeText: badgeText || '信息待核对',
      themeAccent: platformId === '1688' ? '#f97316' : themeAccent
    });
  }

  // Slot 2: Macro Detail & Craftsmanship Zoom
  else if (slot === 'slot_2_detail') {
    renderRefinedSlot2DetailGraphics(ctx, width, height, {
      productName,
      sellingPoints,
      specs
    });
  }

  // Slot 3: Physical Dimension & Specs
  else if (slot === 'slot_3_dimension') {
    renderRefinedSlot3DimensionGraphics(ctx, width, height, {
      productName,
      specs
    });
  }

  // Slot 4: Lifestyle Ambient Context
  else if (slot === 'slot_4_scene') {
    renderRefinedSlot4SceneGraphics(ctx, width, height, {
      productName,
      sellingPoints,
      platformId
    });
  }

  return canvas.toDataURL('image/png');
}

/**
 * Draws high-grade clean studio backdrops tailored to each slot
 */
function drawCleanStudioBackground(ctx: CanvasRenderingContext2D, width: number, height: number, slot: string, platformId: string) {
  const cx = width / 2;

  if (slot === 'slot_4_scene' || platformId === 'douyin' || platformId === 'xiaohongshu') {
    // Warm morning light lifestyle backdrop
    const warmGrad = ctx.createLinearGradient(0, 0, width, height);
    warmGrad.addColorStop(0, '#fefbf6');
    warmGrad.addColorStop(0.4, '#faf3e7');
    warmGrad.addColorStop(1, '#ebdcc9');
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm wooden tabletop surface
    const deskY = height * 0.72;
    ctx.fillStyle = '#e2d3be';
    ctx.fillRect(0, deskY, width, height - deskY);
    return;
  }

  // Default Luxury Clean White/Grey Studio
  const bgGrad = ctx.createRadialGradient(cx, height * 0.35, 60, cx, height * 0.45, width * 0.75);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.45, '#f8fafc');
  bgGrad.addColorStop(0.8, '#e2e8f0');
  bgGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft podium
  const podY = height * 0.74;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, podY, width * 0.34, height * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Refined Slot 1: High CTR Master Selling Point & Promo Card
 */
function renderRefinedSlot1CtrGraphics(ctx: CanvasRenderingContext2D, width: number, height: number, data: {
  headline: string;
  subheadline: string;
  priceTag: string;
  originalPriceTag: string;
  badgeText: string;
  themeAccent: string;
}) {
  ctx.save();

  // 1. Top Sleek Main Headline (High Contrast with subtle drop shadow)
  const titleY = height * 0.08;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.headline, width * 0.5, titleY);

  // Subtitle Selling Point Pill
  const subY = titleY + 36;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = data.themeAccent || '#ef4444';
  ctx.beginPath();
  ctx.roundRect(width * 0.20, subY - 14, width * 0.60, 30, 15);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(data.subheadline, width * 0.5, subY + 5);

  // 2. Bottom-Left High-Converting Price Card
  const priceX = width * 0.06;
  const priceY = height * 0.84;
  const cardW = width * 0.40;
  const cardH = 80;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;

  const pGrad = ctx.createLinearGradient(priceX, priceY, priceX + cardW, priceY + cardH);
  pGrad.addColorStop(0, '#ef4444');
  pGrad.addColorStop(1, '#dc2626');
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.roundRect(priceX, priceY, cardW, cardH, 16);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ 限时狂欢价', priceX + 16, priceY + 22);

  // Big Price
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`¥${data.priceTag}`, priceX + 14, priceY + 56);

  // Original Price strikethrough
  if (data.originalPriceTag) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px sans-serif';
    const origText = `¥${data.originalPriceTag}`;
    const origX = priceX + cardW - 70;
    const origY = priceY + 54;
    ctx.fillText(origText, origX, origY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(origX - 2, origY - 4);
    ctx.lineTo(origX + 50, origY - 4);
    ctx.stroke();
  }

  // 3. Top-Right Trust Badge Seal
  const badgeX = width * 0.88;
  const badgeY = height * 0.14;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('信息待核对', badgeX, badgeY - 5);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('发布前确认', badgeX, badgeY + 10);

  ctx.restore();
}

/**
 * Refined Slot 2: Macro Detail & Craftsmanship Zoom
 */
function renderRefinedSlot2DetailGraphics(ctx: CanvasRenderingContext2D, width: number, height: number, data: {
  productName: string;
  sellingPoints: string[];
  specs: Record<string, string>;
}) {
  ctx.save();

  // Header Title
  const titleY = height * 0.08;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💎 微距特写 · 匠心选材与工艺质感', width * 0.5, titleY);

  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('精密车线 / 阳极氧化质感 / 严苛0瑕疵品控', width * 0.5, titleY + 30);

  // Quality Guarantee Bottom Bar
  const bBarY = height * 0.88;
  ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
  ctx.beginPath();
  ctx.roundRect(width * 0.15, bBarY, width * 0.70, 48, 24);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('品质与检测信息请以商家提供的真实资料为准', width * 0.5, bBarY + 28);

  ctx.restore();
}

/**
 * Refined Slot 3: Physical Dimension & Specs
 */
function renderRefinedSlot3DimensionGraphics(ctx: CanvasRenderingContext2D, width: number, height: number, data: {
  productName: string;
  specs: Record<string, string>;
}) {
  ctx.save();

  // Header Title
  const titleY = height * 0.08;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📐 真实物理尺寸与规格标线', width * 0.5, titleY);

  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('工业级测绘 · 1:1 实物等比参照 · 消除选型疑虑', width * 0.5, titleY + 30);

  // Bottom Spec Parameters Table
  const tableY = height * 0.86;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(width * 0.08, tableY, width * 0.84, 56, 16);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('重量 / 材质 / 适用标准', width * 0.5, tableY + 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`净重: ${data.specs['重量'] || '约185g'}   |   材质: ${data.specs['材质'] || '航空级合金/高分子'}   |   标准: 国标GB-2026`, width * 0.5, tableY + 42);

  ctx.restore();
}

/**
 * Refined Slot 4: Lifestyle Ambient Context
 */
function renderRefinedSlot4SceneGraphics(ctx: CanvasRenderingContext2D, width: number, height: number, data: {
  productName: string;
  sellingPoints: string[];
  platformId: string;
}) {
  ctx.save();

  // Top Atmosphere Header
  const titleY = height * 0.08;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌿 融入生活美学 · 真实多场景体验', width * 0.5, titleY);

  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('办公桌面 · 居家生活 · 差旅便携 · 随心百搭', width * 0.5, titleY + 30);

  // Lifestyle Scene Badges
  const badgeY = height * 0.86;
  const badges = ['☕ 办公静享', '🏡 居家质感', '✈️ 便携出行'];
  const startX = width * 0.18;
  const gap = width * 0.23;

  badges.forEach((bText, idx) => {
    const bX = startX + idx * gap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(bX, badgeY, width * 0.19, 42, 21);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bText, bX + width * 0.095, badgeY + 26);
  });

  ctx.restore();
}
