import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Tag, 
  DollarSign, 
  Check, 
  Plus, 
  Trash2,
  Package,
  Layers,
  Star,
  Image as ImageIcon,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { ProductItem } from '../types';
import { SAMPLE_PRODUCTS } from '../data/presets';
import { safeFetchJson } from '../utils/apiUtils';
import { optimizeImageForUpload } from '../utils/imageMatting';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProduct: ProductItem;
  onSelectProduct: (product: ProductItem) => void;
  onSaveNewProduct: (product: ProductItem) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  currentProduct,
  onSelectProduct,
  onSaveNewProduct
}) => {
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  
  // Custom product state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('美妆个护 / 彩妆');
  const [customPrice, setCustomPrice] = useState('129');
  const [customOriginalPrice, setCustomOriginalPrice] = useState('199');
  const [customDiscountTag, setCustomDiscountTag] = useState('限时特惠');
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [customSellingPoints, setCustomSellingPoints] = useState<string[]>([
    '微米级细腻粉质，软糯贴肤不飞粉',
    '自然元气微醺色，黄皮显白通透',
    '12小时持久持妆锁色，抗油耐汗'
  ]);
  const [customPointInput, setCustomPointInput] = useState('');
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState<string | null>(null);

  // Quick image downscaling helper for fast multimodal vision transmission
  const compressImageForVision = (imgSrc: string, maxDim = 640): Promise<string> => {
    if (!imgSrc) return Promise.resolve('');
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } catch {
            resolve(imgSrc);
          }
        } else {
          resolve(imgSrc);
        }
      };
      img.onerror = () => resolve(imgSrc);
      img.src = imgSrc;
    });
  };

  // Quick fallback generator
  const getHeuristicPoints = (name: string, cat: string): string[] => {
    const n = (name || '').toLowerCase();
    const c = (cat || '').toLowerCase();

    // Blush and Color Cosmetics
    if (
      n.includes('腮红') || n.includes('blush') || n.includes('胭脂') ||
      n.includes('口红') || n.includes('唇膏') || n.includes('唇釉') || n.includes('唇泥') ||
      n.includes('眼影') || n.includes('高光') || n.includes('修容') || n.includes('粉饼') ||
      n.includes('散粉') || n.includes('气垫') || n.includes('粉底') || n.includes('彩妆') ||
      c.includes('彩妆')
    ) {
      const isBlush = n.includes('腮红') || n.includes('blush') || n.includes('胭脂') || !n;
      return isBlush ? [
        '微米级超细烘焙粉质，软糯贴肤不飞粉不显毛孔',
        '特调自然元气微醺色，黄皮一抹显白自然通透',
        '12小时持久锁色持妆，抗油耐汗全天不脱色',
        '颊眼唇多用百搭，轻松晕染打造立体轮廓血色感'
      ] : [
        '精研微细显色微粒，一抹浓郁显色均匀不卡纹',
        '添加养肤滋润植萃成分，上妆轻盈透气不拔干',
        '全天候持久锁色配方，抗水防汗不易沾杯脱妆',
        '专为亚洲肤色调配，显白提气色打造高级妆效'
      ];
    }

    if (
      n.includes('水') || n.includes('霜') || n.includes('精华') || n.includes('乳') ||
      n.includes('面膜') || n.includes('护肤') || n.includes('美妆') || n.includes('防晒') ||
      n.includes('洁面') || n.includes('洗面奶') || c.includes('美妆') || c.includes('护肤')
    ) {
      return [
        '高浓度活性专研配方，深层渗透强韧修护肌底',
        '7天实测淡纹紧致，提亮焕采温和不挑肤质',
        '0添加酒精色素香精，敏感肌安心专研认证',
        '清爽水感质地秒吸收，长效水润透气不闷痘'
      ];
    }
    if (n.includes('耳') || n.includes('音') || n.includes('headphone') || n.includes('audio') || n.includes('充电') || c.includes('3c') || c.includes('数码')) {
      return [
        '45dB双馈深度主动降噪，静享纯净天籁空间',
        'Hi-Res金标空间音频，360°全景环绕沉浸声场',
        '60小时超长复合续航，闪充10分钟听歌5小时',
        '零压感轻量悬浮耳罩，长时间佩戴舒适透气'
      ];
    }
    if (n.includes('茶') || n.includes('咖啡') || n.includes('食') || n.includes('饮') || c.includes('食品') || c.includes('生鲜')) {
      return [
        '北纬黄金产区直采原叶/原豆，匠心控温烘焙锁鲜',
        '0反式脂肪酸0蔗糖添加，健康轻负担纯正风味',
        '充氮独立保鲜包装，随时随地还原现萃现泡口感',
        'SGS国际权威检测合规，品质源头严苛品控'
      ];
    }
    if (n.includes('衣') || n.includes('裤') || n.includes('鞋') || n.includes('服') || n.includes('裙') || n.includes('包') || c.includes('服装') || c.includes('鞋包')) {
      return [
        '100%精梳长绒棉重磅面料，亲肤透气不易变形',
        '立体剪裁微宽松版型，包容各种身材百搭显瘦',
        '高色牢度环保活性印染，耐磨水洗不易褪色',
        '四针六线精工车缝，无感标签告别摩擦不适'
      ];
    }
    return [
      '微米级超细烘焙粉质，软糯贴肤不飞粉不显毛孔',
      '特调自然元气微醺色，黄皮一抹显白自然通透',
      '12小时持久锁色持妆，抗油耐汗全天不脱色',
      '官方旗舰正品保障，支持全国联保售后无忧'
    ];
  };

  const handleAiSmartFill = async () => {
    const effectiveName = (customName && customName.trim() && customName !== '智能高品质商品') ? customName.trim() : '';
    setIsExtractingAi(true);
    setExtractSuccessMsg(null);

    // Fallback timer in case network is slow
    const fallbackTimer = setTimeout(() => {
      const fallbackList = getHeuristicPoints(effectiveName || '腮红', customCategory);
      setCustomSellingPoints(fallbackList);
      setExtractSuccessMsg(`✨ 已根据商品特征生成 ${fallbackList.length} 条高转化核心卖点！`);
      setIsExtractingAi(false);
    }, 7000);

    try {
      const rawImg = customImages[primaryImageIndex] || customImages[0] || '';
      // Compress the product image to ~40KB so Gemini Vision receives the real photo instantly
      const compressedImg = rawImg ? await optimizeImageForUpload(rawImg, 640) : '';

      const res = await safeFetchJson('/api/ai-analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: effectiveName,
          category: customCategory,
          imageBase64: compressedImg
        })
      }, 15000);

      clearTimeout(fallbackTimer);
      const data = res.data;
      if (data && data.success && data.data && data.data.coreSellingPoints?.length) {
        setCustomSellingPoints(data.data.coreSellingPoints);
        const identifiedName = data.data.productIdentified;
        if (identifiedName && (!customName || customName === '智能高品质商品' || customName.trim() === '')) {
          setCustomName(identifiedName);
        }
        if (data.data.categoryIdentified && customCategory === '3C数码 / 生活美学') {
          setCustomCategory(data.data.categoryIdentified);
        }
        setExtractSuccessMsg(`✨ AI 视觉识别完成：【${identifiedName || customName || '商品'}】已提炼 ${data.data.coreSellingPoints.length} 条专属核心卖点！`);
      } else {
        const fallbackList = getHeuristicPoints(effectiveName || '腮红', customCategory);
        setCustomSellingPoints(fallbackList);
        setExtractSuccessMsg(`✨ 已基于商品特征提炼 ${fallbackList.length} 条核心卖点！`);
      }
    } catch (e) {
      clearTimeout(fallbackTimer);
      console.warn('AI smart fill network fallback:', e);
      const fallbackList = getHeuristicPoints(effectiveName || '腮红', customCategory);
      setCustomSellingPoints(fallbackList);
      setExtractSuccessMsg(`✨ 已基于商品特征提炼 ${fallbackList.length} 条核心卖点！`);
    } finally {
      setIsExtractingAi(false);
      setTimeout(() => setExtractSuccessMsg(null), 5000);
    }
  };

  const processFiles = (files: FileList | File[]) => {
    const fileList: File[] = Array.from(files);
    const fileArray = fileList.filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const readPromises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          resolve(uploadEvent.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then(base64List => {
      setCustomImages(prev => [...prev, ...base64List]);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customImages.filter((_, i) => i !== index);
    setCustomImages(updated);
    if (primaryImageIndex >= updated.length) {
      setPrimaryImageIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };

  const handleAddSellingPoint = (customText?: string) => {
    const textToAdd = (typeof customText === 'string' ? customText : customPointInput).trim();
    if (textToAdd) {
      if (!customSellingPoints.includes(textToAdd)) {
        setCustomSellingPoints([...customSellingPoints, textToAdd]);
      }
      if (typeof customText !== 'string') {
        setCustomPointInput('');
      }
    }
  };

  const handleRemovePoint = (index: number) => {
    setCustomSellingPoints(customSellingPoints.filter((_, i) => i !== index));
  };

  const handleSaveCustom = () => {
    const defaultPlaceholder = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
    const mainImg = customImages[primaryImageIndex] || customImages[0] || defaultPlaceholder;
    const allImgs = customImages.length > 0 ? customImages : [defaultPlaceholder];

    const newProd: ProductItem = {
      id: `custom_prod_${Date.now()}`,
      name: customName || '自定义精品商品',
      category: customCategory,
      price: customPrice || '199',
      originalPrice: customOriginalPrice || '399',
      discountTag: customDiscountTag || '限时折扣',
      imageUrl: mainImg,
      images: allImgs,
      cutoutImageUrl: mainImg,
      sellingPoints: customSellingPoints.length > 0 ? customSellingPoints : ['高品质工艺保障', '官方旗舰正品'],
      heroTitles: [
        `${customName || '质感新品'} · 官方首发`,
        `颠覆体验 · 专为品质生活打造`
      ],
      badges: ['官方正品', '顺丰包邮', '退货包运费', '热销爆款']
    };
    onSaveNewProduct(newProd);
    onSelectProduct(newProd);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[92vh] max-h-[860px] flex flex-col shadow-2xl overflow-hidden text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-white">商品管理与多角度实拍图库</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-800 flex-shrink-0 bg-slate-900/90">
          <button
            onClick={() => setTab('presets')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'presets'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            精选爆款示例库 ({SAMPLE_PRODUCTS.length})
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'custom'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            上传自定义商品 / 多张实拍角度库
            {customImages.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30">
                {customImages.length}张
              </span>
            )}
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {tab === 'presets' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SAMPLE_PRODUCTS.map((prod) => {
                const isSelected = currentProduct.id === prod.id;
                const prodImages = prod.images || [prod.imageUrl];
                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      onSelectProduct(prod);
                      onClose();
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/50'
                        : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex gap-3.5 items-start">
                      <div className="relative flex-shrink-0">
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-lg object-cover bg-slate-950 border border-slate-700"
                        />
                        {prodImages.length > 1 && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] text-slate-200 font-bold border border-slate-700">
                            {prodImages.length}角度
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-medium">
                            {prod.category}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-semibold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> 当前使用
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-white truncate mb-1">{prod.name}</h4>
                        <div className="flex items-baseline gap-1.5 mb-1.5">
                          <span className="text-sm font-bold text-rose-400">¥{prod.price}</span>
                          <span className="text-[10px] text-slate-500 line-through">¥{prod.originalPrice}</span>
                          <span className="text-[10px] text-amber-400 font-medium">{prod.discountTag}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {prod.sellingPoints[0]}
                        </p>
                      </div>
                    </div>

                    {/* Multi-angle Mini Thumbnails Strip */}
                    {prodImages.length > 1 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 flex-shrink-0">多视角实拍:</span>
                        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                          {prodImages.map((imgUrl, imgIdx) => (
                            <img
                              key={imgIdx}
                              src={imgUrl}
                              alt={`Angle ${imgIdx + 1}`}
                              className="w-7 h-7 rounded object-cover border border-slate-700 flex-shrink-0 bg-slate-900"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Multi-Image Upload Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-rose-400" />
                    <span>商品多角度实拍原图上传 (支持多选批量上传)</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      {customImages.length > 0 ? `已上传 ${customImages.length} 张实拍图` : '可上传正面、侧面、微距特写、使用场景图等'}
                    </span>
                  </label>
                </div>

                {/* Upload Gallery Grid */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 transition-all ${
                    isDraggingOver 
                      ? 'border-rose-500 bg-rose-500/10' 
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  {customImages.length === 0 ? (
                    <label className="flex flex-col items-center justify-center h-44 cursor-pointer">
                      <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-rose-400 mb-2 shadow-inner">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-200">点击批量选择多张实拍图，或将多张图片拖拽到此处</span>
                      <span className="text-[10px] text-slate-400 mt-1">支持同时上传 1~10 张图片 (PNG, JPG, WebP 格式，白底或实拍均可)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {customImages.map((imgUrl, index) => {
                          const isPrimary = index === primaryImageIndex;
                          return (
                            <div
                              key={index}
                              onClick={() => handleSetPrimaryImage(index)}
                              className={`group relative rounded-xl border p-1.5 cursor-pointer transition-all flex flex-col justify-between ${
                                isPrimary
                                  ? 'border-rose-500 bg-rose-950/40 shadow-lg ring-2 ring-rose-500/50'
                                  : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'
                              }`}
                            >
                              {/* Photo Tag Header */}
                              <div className="flex items-center justify-between gap-1 mb-1 px-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isPrimary ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {isPrimary ? '⭐ 主图基底' : `角度 #${index + 1}`}
                                </span>
                                <button
                                  onClick={(e) => handleRemoveImage(index, e)}
                                  className="p-1 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                                  title="删除该实拍图"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Thumbnail */}
                              <div className="aspect-square w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-800 relative">
                                <img
                                  src={imgUrl}
                                  alt={`Product angle ${index + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                {isPrimary && (
                                  <div className="absolute inset-0 border-2 border-rose-500 rounded-lg pointer-events-none" />
                                )}
                              </div>

                              {/* Bottom Action */}
                              <div className="mt-1.5 text-center">
                                {isPrimary ? (
                                  <span className="text-[10px] text-rose-400 font-bold flex items-center justify-center gap-0.5">
                                    <Check className="w-3 h-3" /> 默认首图
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors">
                                    点击设为主图
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add More Photos Card */}
                        <label className="border-2 border-dashed border-slate-700 hover:border-rose-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-900/40 hover:bg-slate-800/40 transition-all min-h-[140px] text-center">
                          <Plus className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-xs font-bold text-slate-300">添加更多实拍角度</span>
                          <span className="text-[9px] text-slate-500 mt-0.5">支持批量选图</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">商品标题</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="例如：极简空间音频无线降噪耳机"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">所属类目</label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">优惠打标</label>
                      <input
                        type="text"
                        value={customDiscountTag}
                        onChange={(e) => setCustomDiscountTag(e.target.value)}
                        placeholder="例如：买一赠一"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">活动售价 (¥)</label>
                      <input
                        type="text"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">划线原价 (¥)</label>
                      <input
                        type="text"
                        value={customOriginalPrice}
                        onChange={(e) => setCustomOriginalPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Selling Points */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-rose-400" />
                      <span>商品核心卖点列表</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {customSellingPoints.length}条
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAiSmartFill}
                      disabled={isExtractingAi}
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-70 cursor-pointer active:scale-95"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isExtractingAi ? 'animate-spin text-purple-200' : 'text-yellow-300'}`} />
                      <span>{isExtractingAi ? 'AI 正在智能提炼...' : 'AI 一键提炼卖点'}</span>
                    </button>
                  </div>

                  {extractSuccessMsg && (
                    <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{extractSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPointInput}
                      onChange={(e) => setCustomPointInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSellingPoint()}
                      placeholder="输入单条卖点，如：45dB深度降噪，静享天籁"
                      className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSellingPoint()}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-white font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 添加
                    </button>
                  </div>

                  {/* Quick Click-to-add Inspiration Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>💡 灵感推荐:</span>
                    </span>
                    {(() => {
                      const n = customName.toLowerCase();
                      const c = customCategory.toLowerCase();
                      if (n.includes('腮红') || n.includes('胭脂') || n.includes('blush')) {
                        return ['微米级细腻粉质', '自然元气血色感', '12H持妆不飞粉', '黄皮一抹显白', '软糯贴肤隐形毛孔', '颊眼唇多用'];
                      }
                      if (n.includes('口红') || n.includes('唇膏') || n.includes('唇釉') || n.includes('眼影') || n.includes('散粉') || n.includes('彩妆')) {
                        return ['浓郁显色不卡纹', '养肤植萃配方', '全天候锁色持妆', '特调显白亚洲色', '轻盈丝绒哑光'];
                      }
                      if (n.includes('水') || n.includes('霜') || n.includes('精华') || n.includes('乳') || c.includes('美妆') || c.includes('护肤')) {
                        return ['高活性专利配方', '7天淡纹紧致', '敏感肌专研认证', '深层修护肌底', '0添加温和无刺激', '清爽秒吸收'];
                      }
                      if (n.includes('耳') || n.includes('音') || n.includes('headphone') || n.includes('audio') || c.includes('数码') || c.includes('3c')) {
                        return ['45dB双馈深度降噪', 'Hi-Res空间音频', '60h超长续航', '航空铝机身', '零压轻量佩戴', '双麦高清通话'];
                      }
                      if (n.includes('茶') || n.includes('咖啡') || n.includes('食') || n.includes('饮') || c.includes('食品')) {
                        return ['北纬黄金产区直采', '0反式脂肪0蔗糖', '充氮锁鲜独立包装', 'SGS质检权威认证', '醇厚鲜活回甘'];
                      }
                      if (n.includes('衣') || n.includes('裤') || n.includes('鞋') || n.includes('服') || c.includes('服装') || c.includes('鞋包')) {
                        return ['100%精梳长绒棉', '立体显瘦包容版型', '活性环保印染', '亲肤透气不易变形', '四针六线精工'];
                      }
                      return ['高品质精工质感', '官方正品保障', '人性化舒适体验', '高性价比爆款', '严苛品控认证'];
                    })().map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddSellingPoint(chip)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-colors flex items-center gap-0.5 cursor-pointer"
                        title="点击快速添加到卖点列表"
                      >
                        <Plus className="w-2.5 h-2.5 text-rose-400" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {customSellingPoints.map((point, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-md text-xs text-slate-200 group hover:border-slate-600 transition-colors"
                      >
                        <span className="truncate flex-1">{point}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePoint(index)}
                          className="text-slate-500 hover:text-red-400 ml-2 p-0.5 rounded hover:bg-slate-700/50 transition-colors"
                          title="删除该卖点"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0 z-10">
          <span className="text-xs text-slate-400">
            {customImages.length > 0 ? `已就绪 ${customImages.length} 张实拍图，主图工坊与详情页可自由切换使用。` : '选中商品后，主图工坊与详情页将实时同步物料。'}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              取消
            </button>
            {tab === 'custom' && (
              <button
                type="button"
                onClick={handleSaveCustom}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 active:scale-95 text-xs font-bold text-white shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer ring-1 ring-white/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>保存并应用该商品 ({customImages.length}张实拍)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

