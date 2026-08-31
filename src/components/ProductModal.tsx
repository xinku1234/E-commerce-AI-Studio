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
import { ModelBinding } from '../hooks/useModelBinding';
import { describeModelFailure } from '../utils/modelErrors';
import { uniqueId } from '../utils/uniqueId';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProduct: ProductItem;
  onSelectProduct: (product: ProductItem) => void;
  onSaveNewProduct: (product: ProductItem) => void | Promise<void>;
  modelBinding: ModelBinding;
  onRequireModel?: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  currentProduct,
  onSelectProduct,
  onSaveNewProduct,
  modelBinding,
  onRequireModel
}) => {
  // Selling-point extraction is a prompt/analysis task, so it runs on the same
  // prompt model binding as the hero studio instead of a private code path.
  const { modelRequired, promptModelReady, promptModelRequest, markBindingRejected } = modelBinding;
  const promptModelUsable = !modelRequired || promptModelReady;
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');
  
  // Custom product state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customOriginalPrice, setCustomOriginalPrice] = useState('');
  const [customDiscountTag, setCustomDiscountTag] = useState('');
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [customSellingPoints, setCustomSellingPoints] = useState<string[]>([]);
  const [customPointInput, setCustomPointInput] = useState('');
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getSafeFallbackPoints = (name: string, category: string): string[] => [
    `${name || '商品'}的主要材质、结构或配方特点（待商家按实物补充）`,
    `${category || '当前类目'}下的核心使用场景（待商家核对）`,
    '尺寸、容量、功率或适用范围等关键参数（待商家补充）',
    '发货、退换与质保政策（仅填写店铺真实承诺）'
  ];

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

  const handleAiSmartFill = async () => {
    const effectiveName = (customName && customName.trim() && customName !== '智能高品质商品') ? customName.trim() : '';

    if (!promptModelUsable) {
      setExtractError('未绑定可用的提示词分析模型，请先在「模型与接口配置」中完成绑定与连接测试。');
      onRequireModel?.();
      return;
    }
    if (customImages.length === 0) {
      setExtractError('请先上传至少 1 张商品实拍图，AI 才能识别真实卖点。');
      return;
    }

    setIsExtractingAi(true);
    setExtractSuccessMsg(null);
    setExtractError(null);

    try {
      const rawImg = customImages[primaryImageIndex] || customImages[0] || '';
      // Compress the product image to ~40KB so vision models receive it quickly.
      const compressedImg = rawImg ? await optimizeImageForUpload(rawImg, 640) : '';

      const res = await safeFetchJson('/api/ai-analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: effectiveName,
          category: customCategory,
          imageBase64: compressedImg,
          analysisModel: promptModelRequest.modelName,
          customEndpointUrl: promptModelRequest.customEndpointUrl,
          customApiKey: promptModelRequest.customApiKey
        })
      }, 25000);

      const data = res.data;
      if (data?.code === 'MODEL_REQUIRED') {
        markBindingRejected();
        setExtractError(describeModelFailure(res, '未绑定可用模型，请先完成模型绑定与连接测试。').message);
        onRequireModel?.();
        return;
      }
      if (data && data.success && data.generationMode === 'ai' && data.data?.coreSellingPoints?.length) {
        setCustomSellingPoints(data.data.coreSellingPoints);
        const identifiedName = data.data.productIdentified;
        if (identifiedName && (!customName || customName === '智能高品质商品' || customName.trim() === '')) {
          setCustomName(identifiedName);
        }
        if (data.data.categoryIdentified && (!customCategory.trim() || customCategory === '3C数码 / 生活美学')) {
          setCustomCategory(data.data.categoryIdentified);
        }
        setExtractSuccessMsg(`AI 视觉识别完成：【${identifiedName || customName || '商品'}】已提炼 ${data.data.coreSellingPoints.length} 条核心卖点，请核对后保存。`);
        return;
      }
      // No silent template fill: the model did not return a usable result, so
      // say so and leave the list untouched. The message names the provider that
      // actually failed instead of guessing.
      setExtractError(describeModelFailure(res, '模型未返回可用的识别结果，请检查模型绑定或稍后重试。').message);
    } catch (e) {
      console.warn('AI selling point extraction failed:', e);
      setExtractError('AI 请求失败，请检查模型绑定与网络后重试。');
    } finally {
      setIsExtractingAi(false);
    }
  };

  const handleFillManualFramework = () => {
    setCustomSellingPoints(getSafeFallbackPoints(
      (customName && customName.trim() && customName !== '智能高品质商品') ? customName.trim() : '',
      customCategory
    ));
    setExtractError(null);
    setExtractSuccessMsg('已填入待核对的卖点框架，请按实物逐条替换为真实信息。');
  };

  const processFiles = (files: FileList | File[]) => {
    setUploadError(null);
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const remainingSlots = Math.max(0, 10 - customImages.length);
    const fileList = Array.from(files);
    const invalidType = fileList.find(file => !allowedTypes.has(file.type));
    const tooLarge = fileList.find(file => file.size > 8 * 1024 * 1024);
    if (invalidType) return setUploadError(`不支持 ${invalidType.name} 的文件格式，仅支持 PNG、JPG 和 WebP。`);
    if (tooLarge) return setUploadError(`${tooLarge.name} 超过 8 MB，请压缩后上传。`);
    if (remainingSlots === 0) return setUploadError('最多上传 10 张商品图片。');
    const fileArray = fileList.slice(0, remainingSlots);
    if (fileList.length > remainingSlots) setUploadError(`最多保留 10 张图片，本次仅添加前 ${remainingSlots} 张。`);

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

  const handleSaveCustom = async () => {
    setFormError(null);
    if (!customName.trim()) return setFormError('请填写商品名称。');
    if (!customCategory.trim()) return setFormError('请填写商品类目。');
    if (!customPrice.trim() || !Number.isFinite(Number(customPrice)) || Number(customPrice) < 0) return setFormError('请填写有效的活动售价。');
    if (customImages.length === 0) return setFormError('请至少上传 1 张真实商品图片。');
    const mainImg = customImages[primaryImageIndex] || customImages[0];
    const allImgs = customImages;

    const newProd: ProductItem = {
      id: uniqueId('custom_prod'),
      name: customName.trim(),
      category: customCategory.trim(),
      price: customPrice.trim(),
      originalPrice: customOriginalPrice.trim() || undefined,
      discountTag: customDiscountTag.trim() || undefined,
      imageUrl: mainImg,
      images: allImgs,
      cutoutImageUrl: mainImg,
      sellingPoints: customSellingPoints.length > 0 ? customSellingPoints : ['核心卖点待商家补充'],
      heroTitles: [
        customName.trim(),
        `${customName.trim()} 商品展示`
      ],
      badges: []
    };
    setIsSaving(true);
    try {
      await onSaveNewProduct(newProd);
      onClose();
    } catch (error) {
      console.error('Unable to save custom product:', error);
      setFormError('商品保存失败，请检查浏览器存储权限后重试。');
    } finally {
      setIsSaving(false);
    }
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
                      <span className="inline-flex p-3 rounded-2xl bg-slate-800 border border-slate-700 text-rose-400 mb-2 shadow-inner">
                        <Upload className="w-6 h-6" />
                      </span>
                      <span className="text-xs font-bold text-slate-200">点击批量选择多张实拍图，或将多张图片拖拽到此处</span>
                      <span className="text-[10px] text-slate-400 mt-1">支持 1~10 张 PNG、JPG、WebP 图片，单张不超过 8 MB</span>
                      <input
                        type="file"
                        data-testid="custom-product-images"
                        aria-label="上传商品实拍图片"
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
                            data-testid="custom-product-images-more"
                            aria-label="添加更多商品实拍图片"
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
                      aria-label="商品标题"
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
                        aria-label="所属类目"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">优惠打标</label>
                      <input
                        type="text"
                        aria-label="优惠打标"
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
                        aria-label="活动售价"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">划线原价 (¥)</label>
                      <input
                        type="text"
                        aria-label="划线原价"
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
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleFillManualFramework}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                        title="不调用模型，仅填入需要手工核对的卖点框架"
                      >
                        填入手填框架
                      </button>
                      <button
                        type="button"
                        onClick={handleAiSmartFill}
                        disabled={isExtractingAi || !promptModelUsable}
                        title={promptModelUsable
                          ? `使用已绑定的提示词分析模型: ${promptModelRequest.modelName}`
                          : '未绑定可用的提示词分析模型，请先在模型与接口配置中完成绑定'}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isExtractingAi ? 'animate-spin text-purple-200' : 'text-yellow-300'}`} />
                        <span>{isExtractingAi ? 'AI 正在智能提炼...' : 'AI 一键提炼卖点'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    <span>
                      提炼卖点使用与主图工坊相同的提示词分析模型:
                      <strong className="ml-1 font-mono text-purple-300" data-testid="selling-point-model">{promptModelRequest.modelName}</strong>
                      {!promptModelUsable && <span className="ml-1 text-amber-300">(未绑定)</span>}
                    </span>
                  </div>

                  {extractSuccessMsg && (
                    <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{extractSuccessMsg}</span>
                    </div>
                  )}
                  {extractError && (
                    <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-600/60 text-rose-200 text-[11px] flex items-start gap-1.5 animate-fadeIn" role="alert">
                      <span>{extractError}</span>
                    </div>
                  )}
                   {uploadError && <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-600/60 text-rose-200 text-[11px]">{uploadError}</div>}

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
                    {['主要材质（待核对）', '核心功能（待核对）', '适用场景（待核对）', '尺寸规格（待核对）', '包装清单（待核对）', '售后政策（待核对）'].map((chip, idx) => (
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
        {formError && <div className="px-6 py-2 text-xs text-rose-200 bg-rose-950/50 border-t border-rose-800">{formError}</div>}
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
                disabled={isSaving}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 active:scale-95 text-xs font-bold text-white shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer ring-1 ring-white/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? '正在保存商品素材...' : `保存并应用该商品 (${customImages.length}张实拍)`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

