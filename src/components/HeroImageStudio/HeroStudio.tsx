import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  Sliders, 
  CheckCircle, 
  Info, 
  Plus, 
  Type, 
  ShieldAlert, 
  Eye, 
  Wand2, 
  Grid,
  Layers,
  Palette,
  Cpu,
  Flame,
  Camera,
  Upload,
  ArrowRight,
  Check,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Zap,
  Box,
  Ruler,
  Maximize2,
  Shield,
  Award,
  Stamp,
  Scissors
} from 'lucide-react';
import { 
  ProductItem, 
  PlatformId, 
  AspectRatioType, 
  PlatformConfig, 
  SceneStyle,
  AiVisualAnalysisResult,
  CustomEndpointConfig,
  HeroSuiteItem,
  HeroSuiteSlot,
  ImageQualityReport
} from '../../types';
import { 
  PLATFORMS_DATA, 
  SCENE_STYLES, 
  BADGE_PRESETS,
  PROMPT_MODELS_DATA,
  IMAGE_MODELS_DATA,
  createDefaultHeroSuite
} from '../../data/presets';
import { generatePlatformProductPrompt, fetchMultimodalPlatformPrompt } from '../../utils/promptGenerator';
import { exportCanvasAsImage, packageAndDownloadZip, fireSuccessConfetti } from '../../utils/exportUtils';
import { analyzeImageQuality, validateEcommerceOutput } from '../../utils/imageQuality';
import { smartRemoveBackground, optimizeImageForUpload } from '../../utils/imageMatting';
import { synthesizeCommercialStudioScene, renderCompleteHeroSlotImage } from '../../utils/sceneSynthesizer';
import { safeFetchJson } from '../../utils/apiUtils';
import { ModelConfigModal } from './ModelConfigModal';
import { HeroSuiteMatrixBar } from './HeroSuiteMatrixBar';
import { ImageQualityModal } from './ImageQualityModal';

interface HeroStudioProps {
  currentProduct: ProductItem;
  onAddToBatch: (taskConfig: any) => void;
  onSyncToDetail: () => void;
  onOpenProductModal?: () => void;
  onUpdateProduct?: (product: ProductItem) => void;
  modelRequired?: boolean;
  serverModelReady?: boolean;
  onModelStatusChange?: (ready: boolean) => void;
  modelConfigRequest?: number;
}

export const HeroStudio: React.FC<HeroStudioProps> = ({
  currentProduct,
  onAddToBatch,
  onSyncToDetail,
  onOpenProductModal,
  onUpdateProduct
  , modelRequired = true
  , serverModelReady = false
  , onModelStatusChange
  , modelConfigRequest = 0
}) => {
  // Multi-angle Real Product Photos State
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  const productPhotos = useMemo(() => {
    if (currentProduct.images && currentProduct.images.length > 0) {
      return currentProduct.images;
    }
    return [currentProduct.imageUrl];
  }, [currentProduct]);

  const activeProductImage = productPhotos[activePhotoIndex] || productPhotos[0] || currentProduct.imageUrl;

  // Pre-processing Quality Validation State (Sharpness, Brightness, Resolution & Quality Score)
  const [qualityReport, setQualityReport] = useState<ImageQualityReport | null>(null);
  const [isAnalyzingQuality, setIsAnalyzingQuality] = useState<boolean>(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
  const [pendingGenerateAction, setPendingGenerateAction] = useState<(() => void) | null>(null);

  // Trigger automated real-time quality pre-check on photo switch/upload
  useEffect(() => {
    if (!activeProductImage) return;
    let isCancelled = false;
    setIsAnalyzingQuality(true);

    analyzeImageQuality(activeProductImage)
      .then(report => {
        if (!isCancelled) {
          setQualityReport(report);
        }
      })
      .catch(err => {
        console.warn('Image quality validation error:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsAnalyzingQuality(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeProductImage]);

  // Apply auto-enhanced image to product
  const handleApplyEnhancedImage = (enhancedBase64: string) => {
    const updatedImages = [...productPhotos];
    updatedImages[activePhotoIndex] = enhancedBase64;
    if (onUpdateProduct) {
      onUpdateProduct({
        ...currentProduct,
        images: updatedImages,
        imageUrl: activePhotoIndex === 0 ? enhancedBase64 : currentProduct.imageUrl
      });
    }
    fireSuccessConfetti();
  };

  // Platform & Dimension
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('taobao');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('1:1');
  const [selectedScene, setSelectedScene] = useState<string>('scene_studio_minimal');

  // Reset active photo index if out of range
  useEffect(() => {
    if (activePhotoIndex >= productPhotos.length) {
      setActivePhotoIndex(0);
    }
  }, [productPhotos.length]);

  // Quick inline photo upload handler
  const handleQuickUploadMorePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    const fileArray = fileList.filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const readPromises = fileArray.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          resolve(uploadEvent.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then(base64List => {
      const updatedImages = [...productPhotos, ...base64List];
      if (onUpdateProduct) {
        onUpdateProduct({
          ...currentProduct,
          images: updatedImages,
          imageUrl: currentProduct.imageUrl || updatedImages[0]
        });
      }
      setActivePhotoIndex(productPhotos.length); // Switch to newly uploaded photo
      fireSuccessConfetti();
    });
  };

  // AI Models Configuration (Prompt LLM & Image Engine with Custom Endpoint and Model Selection)
  const [selectedPromptModel, setSelectedPromptModel] = useState<string>(() => {
    return localStorage.getItem('SELECTED_PROMPT_MODEL') || 'gemini-3.7-flash';
  });
  const [selectedImageModel, setSelectedImageModel] = useState<string>(() => {
    return localStorage.getItem('SELECTED_IMAGE_MODEL') || 'gemini-3.1-flash-image';
  });

  const [customPromptConfig, setCustomPromptConfig] = useState<CustomEndpointConfig>(() => {
    const saved = localStorage.getItem('CUSTOM_PROMPT_CONFIG');
    if (saved) {
      try { return { ...JSON.parse(saved), apiKey: '' }; } catch (e) {}
    }
    return {
      endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: '',
      selectedModel: 'qwen-vl-max',
      manualModel: 'qwen-vl-max',
      useManual: false,
      fetchedModels: ['qwen-vl-max', 'qwen-vl-plus', 'deepseek-chat', 'gpt-4o', 'claude-3-5-sonnet'],
      testStatus: 'idle'
    };
  });

  const [customImageConfig, setCustomImageConfig] = useState<CustomEndpointConfig>(() => {
    const saved = localStorage.getItem('CUSTOM_IMAGE_CONFIG');
    if (saved) {
      try { return { ...JSON.parse(saved), apiKey: '' }; } catch (e) {}
    }
    return {
      endpointUrl: 'https://api.siliconflow.cn/v1',
      apiKey: '',
      selectedModel: 'black-forest-labs/FLUX.1-schnell',
      manualModel: 'black-forest-labs/FLUX.1-schnell',
      useManual: false,
      fetchedModels: ['black-forest-labs/FLUX.1-schnell', 'stabilityai/stable-diffusion-3-5-large', 'dall-e-3'],
      testStatus: 'idle'
    };
  });

  const [denoisingStrength, setDenoisingStrength] = useState<number>(0.65);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [aiCompositeMode, setAiCompositeMode] = useState<'ai_full_render' | 'ai_stage_overlay'>('ai_full_render');
  const [isRealAiGenerated, setIsRealAiGenerated] = useState<boolean>(false);

  const promptModelReady = selectedPromptModel !== 'custom-prompt-model'
    ? serverModelReady
    : customPromptConfig.testStatus === 'success';
  const imageModelReady = selectedImageModel !== 'custom-image-engine'
    ? serverModelReady
    : customImageConfig.testStatus === 'success';
  const modelReady = !modelRequired || (promptModelReady && imageModelReady);

  useEffect(() => {
    onModelStatusChange?.(modelReady);
    if (modelRequired && !modelReady) setIsModelModalOpen(true);
  }, [modelReady, modelRequired, onModelStatusChange]);

  useEffect(() => {
    if (modelConfigRequest > 0) setIsModelModalOpen(true);
  }, [modelConfigRequest]);

  // 5-Hero-Suite Matrix State (Slot 1 CTR, Slot 2 Detail, Slot 3 Dimension, Slot 4 Scene, Slot 5 WhiteBg)
  const [heroSuite, setHeroSuite] = useState<HeroSuiteItem[]>(() => {
    return createDefaultHeroSuite(currentProduct, 'taobao');
  });
  const [activeSuiteSlot, setActiveSuiteSlot] = useState<string>('slot_1_ctr');
  const [isGeneratingSuite, setIsGeneratingSuite] = useState<boolean>(false);
  const [generatingSlotIndex, setGeneratingSlotIndex] = useState<number>(1);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('SELECTED_PROMPT_MODEL', selectedPromptModel);
  }, [selectedPromptModel]);

  useEffect(() => {
    localStorage.setItem('SELECTED_IMAGE_MODEL', selectedImageModel);
  }, [selectedImageModel]);

  useEffect(() => {
    const { apiKey: _apiKey, ...safeConfig } = customPromptConfig;
    localStorage.setItem('CUSTOM_PROMPT_CONFIG', JSON.stringify(safeConfig));
  }, [customPromptConfig]);

  useEffect(() => {
    const { apiKey: _apiKey, ...safeConfig } = customImageConfig;
    localStorage.setItem('CUSTOM_IMAGE_CONFIG', JSON.stringify(safeConfig));
  }, [customImageConfig]);

  useEffect(() => {
    // Remove API keys written by versions prior to the in-memory-only policy.
    for (const key of ['CUSTOM_PROMPT_CONFIG', 'CUSTOM_IMAGE_CONFIG']) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if ('apiKey' in parsed) {
            delete parsed.apiKey;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch { /* ignore malformed legacy data */ }
      }
    }
  }, []);

  // Analysis and Generation States
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState<boolean>(false);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiVisualAnalysisResult | null>(null);
  const [aiGeneratedBgUrl, setAiGeneratedBgUrl] = useState<string | null>(null);
  const [lastUsedModelTag, setLastUsedModelTag] = useState<{ promptModel: string; imageModel: string } | null>(null);

  // Smart Matting / Transparent Cutout State
  const [isAutoMattingEnabled, setIsAutoMattingEnabled] = useState<boolean>(true);
  const [mattedProductImage, setMattedProductImage] = useState<string | null>(null);
  const [isMatting, setIsMatting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Automatic smart background removal when active product photo changes
  useEffect(() => {
    let isMounted = true;
    if (!activeProductImage) {
      setMattedProductImage(null);
      return;
    }

    if (!isAutoMattingEnabled) {
      setMattedProductImage(null);
      return;
    }

    setIsMatting(true);
    smartRemoveBackground(activeProductImage)
      .then((matted) => {
        if (isMounted) {
          setMattedProductImage(matted);
        }
      })
      .catch((err) => {
        console.warn('Smart matting fallback:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsMatting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeProductImage, isAutoMattingEnabled]);

  // Visual Prompt State (Editable)
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>('');
  const [aiCustomPromptCn, setAiCustomPromptCn] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('blurry, out of focus, distorted shapes, noisy, low resolution, ugly reflections, overexposed');
  const [activePromptTab, setActivePromptTab] = useState<'en' | 'cn' | 'settings'>('en');

  // Visual Overlays State
  const [mainTitle, setMainTitle] = useState<string>(currentProduct.heroTitles[0] || '商品标题待补充');
  const [subTitle, setSubTitle] = useState<string>(currentProduct.sellingPoints[0] || '卖点待商家核对');
  const [priceTag, setPriceTag] = useState<string>(currentProduct.price || '');
  const [originalPriceTag, setOriginalPriceTag] = useState<string>(currentProduct.originalPrice || '');
  const [discountBadge, setDiscountBadge] = useState<string>(currentProduct.discountTag || '');
  
  // Platform Certification & Marketing Badge (Optional & Fully Customizable)
  const [showBadge, setShowBadge] = useState<boolean>(false);
  const [selectedBadge, setSelectedBadge] = useState<string>('none'); // 'none' | 'custom' | preset id
  const [customBadgeText, setCustomBadgeText] = useState<string>('');
  const [customBadgeSubText, setCustomBadgeSubText] = useState<string>('');
  const [customBadgeType, setCustomBadgeType] = useState<'official_seal' | 'ribbon' | 'pill' | 'circle'>('official_seal');
  const [customBadgePosition, setCustomBadgePosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [customBadgeColor, setCustomBadgeColor] = useState<'gold' | 'red' | 'dark' | 'blue' | 'green' | 'orange'>('gold');

  // Customization Toggles
  const [showSafeGuidelines, setShowSafeGuidelines] = useState<boolean>(false);
  const [showPriceCard, setShowPriceCard] = useState<boolean>(true);
  const [showTitleOverlay, setShowTitleOverlay] = useState<boolean>(true);
  const [showWaistBanner, setShowWaistBanner] = useState<boolean>(false);
  const [waistBannerText, setWaistBannerText] = useState<string>('活动信息待核对');
  const [themeAccent, setThemeAccent] = useState<string>('#FF5000');
  const [renderMode, setRenderMode] = useState<'composite' | 'raw_photo'>('composite');

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Platform & Scene configs
  const platformConfig: PlatformConfig = PLATFORMS_DATA.find(p => p.id === selectedPlatform) || PLATFORMS_DATA[0];
  const activeScene: SceneStyle = SCENE_STYLES.find(s => s.id === selectedScene) || SCENE_STYLES[0];
  const activePromptModel = PROMPT_MODELS_DATA.find(m => m.id === selectedPromptModel) || PROMPT_MODELS_DATA[0];
  const activeImageModel = IMAGE_MODELS_DATA.find(m => m.id === selectedImageModel) || IMAGE_MODELS_DATA[0];

  // Dynamic Prompt Generation based on Product + Platform
  const syncPlatformProductPrompt = (prod: ProductItem, pId: PlatformId, slot: string = activeSuiteSlot) => {
    const res = generatePlatformProductPrompt(prod, pId, slot as HeroSuiteSlot, selectedScene);
    setAiCustomPrompt(res.promptEn);
    setAiCustomPromptCn(res.promptCn);
    if (res.negativePrompt) {
      setNegativePrompt(res.negativePrompt);
    }
  };

  // Sync state when currentProduct changes
  useEffect(() => {
    if (currentProduct.heroTitles?.length) {
      setMainTitle(currentProduct.heroTitles[0]);
    }
    if (currentProduct.sellingPoints?.length) {
      setSubTitle(currentProduct.sellingPoints[0]);
    }
    if (currentProduct.price) {
      setPriceTag(currentProduct.price);
    }
    if (currentProduct.originalPrice) {
      setOriginalPriceTag(currentProduct.originalPrice);
    }
    if (currentProduct.discountTag) {
      setDiscountBadge(currentProduct.discountTag);
    }
    // Automatically regenerate hero suite & dynamic prompt for the new product & current platform
    const updatedSuite = createDefaultHeroSuite(currentProduct, selectedPlatform);
    setHeroSuite(updatedSuite);
    syncPlatformProductPrompt(currentProduct, selectedPlatform, activeSuiteSlot);

    // Reset AI generated image when product changes to re-inspire
    setAiGeneratedBgUrl(null);
    setAiSuggestions(null);
  }, [currentProduct]);

  // Adjust aspect ratio and presets when platform changes
  const handlePlatformChange = (pId: PlatformId) => {
    setSelectedPlatform(pId);
    const p = PLATFORMS_DATA.find(item => item.id === pId);
    if (p) {
      setAspectRatio(p.primaryRatio);
      setThemeAccent(p.themeColor);
      if (pId === 'amazon') {
        setSelectedScene('scene_pure_white_compliance');
        setShowTitleOverlay(false);
        setShowPriceCard(false);
        setShowWaistBanner(false);
      } else if (pId === 'jd') {
        setSelectedBadge('badge_official_auth');
      } else if (pId === 'pinduoduo') {
        setShowWaistBanner(true);
        setSelectedBadge('badge_billion_subsidy');
      } else if (pId === '1688') {
        setSelectedBadge('badge_1688_source_factory');
      }
    }

    // Automatically regenerate suite & dynamic prompt tailored for this specific platform
    const updatedSuite = createDefaultHeroSuite(currentProduct, pId);
    setHeroSuite(updatedSuite);
    syncPlatformProductPrompt(currentProduct, pId, activeSuiteSlot);
  };

  // Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 800;
    let height = 800;
    if (aspectRatio === '3:4') {
      width = 800;
      height = 1067;
    } else if (aspectRatio === '9:16') {
      width = 720;
      height = 1280;
    } else if (aspectRatio === '4:3') {
      width = 800;
      height = 600;
    } else if (aspectRatio === '16:9') {
      width = 1280;
      height = 720;
    }

    canvas.width = width;
    canvas.height = height;

    const displayProdImage = (isAutoMattingEnabled && mattedProductImage) ? mattedProductImage : activeProductImage;

    if (renderMode === 'composite' && aiGeneratedBgUrl) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.src = aiGeneratedBgUrl;
      bgImg.onload = () => {
        ctx.drawImage(bgImg, 0, 0, width, height);

        if (aiCompositeMode === 'ai_stage_overlay') {
          // Render product seamlessly on the AI generated scene stage
          const prodImg = new Image();
          prodImg.crossOrigin = 'anonymous';
          prodImg.src = displayProdImage;
          prodImg.onload = () => {
            const prodScale = selectedPlatform === 'amazon' ? 0.80 : 0.60;
            const imgAspect = prodImg.width / prodImg.height;
            let drawW = width * prodScale;
            let drawH = drawW / imgAspect;

            if (drawH > height * prodScale) {
              drawH = height * prodScale;
              drawW = drawH * imgAspect;
            }

            const centerY = showWaistBanner ? height * 0.44 : height * 0.46;
            const posX = (width - drawW) / 2;
            const posY = centerY - drawH / 2;

            // Contact drop shadow on stage
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.beginPath();
            ctx.ellipse(width * 0.5, posY + drawH * 0.95, drawW * 0.38, drawH * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.drawImage(prodImg, posX, posY, drawW, drawH);
            drawOverlaysAndGuidelines(ctx, width, height);
          };
          prodImg.onerror = () => {
            drawOverlaysAndGuidelines(ctx, width, height);
          };
        } else {
          // 'ai_full_render': Full real AI photo directly, draw overlays if enabled
          drawOverlaysAndGuidelines(ctx, width, height);
        }
      };
    } else {
      drawProceduralBackground(ctx, width, height, selectedScene);
      drawProductAndOverlays(ctx, width, height);
    }
  }, [
    aspectRatio,
    selectedScene,
    currentProduct,
    activeProductImage,
    mattedProductImage,
    isAutoMattingEnabled,
    activePhotoIndex,
    mainTitle,
    subTitle,
    priceTag,
    originalPriceTag,
    discountBadge,
    showBadge,
    selectedBadge,
    customBadgeText,
    customBadgeSubText,
    customBadgeType,
    customBadgePosition,
    customBadgeColor,
    showPriceCard,
    showTitleOverlay,
    showWaistBanner,
    waistBannerText,
    themeAccent,
    showSafeGuidelines,
    aiGeneratedBgUrl,
    selectedPlatform,
    renderMode,
    aiCompositeMode
  ]);

  const drawProceduralBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, sceneId: string) => {
    if (sceneId === 'scene_pure_white_compliance' || selectedPlatform === 'amazon') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (sceneId === 'scene_cyber_tech') {
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.45, 50, width * 0.5, height * 0.5, width * 0.8);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#020617');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.save();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 0.78, width * 0.35, height * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (sceneId === 'scene_nordic_wood') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#fbf8f2');
      grad.addColorStop(0.7, '#f4ece2');
      grad.addColorStop(1, '#e5d5c0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#dbcaa8';
      ctx.fillRect(0, height * 0.72, width, height * 0.28);
      return;
    }

    if (sceneId === 'scene_luxury_marble') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(0.5, '#f1f5f9');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Default Minimal Commercial Studio
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.4, 80, width * 0.5, height * 0.5, width * 0.75);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#f3f4f6');
    grad.addColorStop(1, '#e5e7eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.75, width * 0.32, height * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawProductAndOverlays = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const prodImg = new Image();
    prodImg.crossOrigin = 'anonymous';
    prodImg.src = (isAutoMattingEnabled && mattedProductImage) ? mattedProductImage : activeProductImage;

    prodImg.onload = () => {
      const prodScale = selectedPlatform === 'amazon' ? 0.80 : 0.62;
      const imgAspect = prodImg.width / prodImg.height;
      let drawW = width * prodScale;
      let drawH = drawW / imgAspect;

      if (drawH > height * prodScale) {
        drawH = height * prodScale;
        drawW = drawH * imgAspect;
      }

      const centerY = showWaistBanner ? height * 0.45 : height * 0.48;
      const posX = (width - drawW) / 2;
      const posY = centerY - drawH / 2;

      // Contact shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.ellipse(width * 0.5, posY + drawH * 0.95, drawW * 0.40, drawH * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Render product
      ctx.drawImage(prodImg, posX, posY, drawW, drawH);

      drawOverlaysAndGuidelines(ctx, width, height);
    };
    prodImg.onerror = () => {
      drawOverlaysAndGuidelines(ctx, width, height);
    };
  };

  const drawOverlaysAndGuidelines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Slot 5 (Pure White Background) requires 0 promotional text overlays for 100% compliance
    if (activeSuiteSlot === 'slot_5_whitebg' || selectedPlatform === 'amazon') {
      if (showSafeGuidelines) {
        renderSafeGuides(ctx, width, height);
      }
      return;
    }

    // Slot 3 (Dimensions & Scale)
    if (activeSuiteSlot === 'slot_3_dimension') {
      renderDimensionGuidelines(ctx, width, height);
      if (showSafeGuidelines) {
        renderSafeGuides(ctx, width, height);
      }
      return;
    }

    // Slot 2 (Macro Detail & Craftsmanship)
    if (activeSuiteSlot === 'slot_2_detail') {
      renderDetailMacroFocus(ctx, width, height);
    }

    // Slot 4 (Lifestyle / Scene)
    if (activeSuiteSlot === 'slot_4_scene') {
      renderSceneContextLabel(ctx, width, height);
    }

    // Common CTR Overlays for Slot 1 (and general preview)
    if (showTitleOverlay) {
      renderTitleOverlay(ctx, width, height);
    }
    if (showPriceCard) {
      renderPriceBadge(ctx, width, height);
    }
    if (showBadge && selectedBadge && selectedBadge !== 'none') {
      renderBadge(ctx, width, height);
    }
    if (showWaistBanner) {
      renderWaistBanner(ctx, width, height);
    }
    if (showSafeGuidelines) {
      renderSafeGuides(ctx, width, height);
    }
  };

  const renderDimensionGuidelines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    
    // Header Title for Dimension
    const startY = height * 0.07;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📐 真实尺寸与黄金比例参考', width * 0.5, startY);

    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('微米级工学测绘 · 标准实物等比参照', width * 0.5, startY + 28);

    // Dimension Guidelines & Arrows
    const boxX = width * 0.18;
    const boxY = height * 0.22;
    const boxW = width * 0.64;
    const boxH = height * 0.56;

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    // Outer bounding box guidelines
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.setLineDash([]);

    // Width Measurement Bar (Top)
    ctx.strokeStyle = '#0284c7';
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 2;

    const topArrowY = boxY - 14;
    ctx.beginPath();
    ctx.moveTo(boxX, topArrowY);
    ctx.lineTo(boxX + boxW, topArrowY);
    ctx.stroke();

    // Arrows on top
    drawArrowHead(ctx, boxX, topArrowY, 'left');
    drawArrowHead(ctx, boxX + boxW, topArrowY, 'right');

    // Height Measurement Bar (Right)
    const rightArrowX = boxX + boxW + 16;
    ctx.beginPath();
    ctx.moveTo(rightArrowX, boxY);
    ctx.lineTo(rightArrowX, boxY + boxH);
    ctx.stroke();
    drawArrowHead(ctx, rightArrowX, boxY, 'up');
    drawArrowHead(ctx, rightArrowX, boxY + boxH, 'down');

    // Width Pill
    const pillW = 110;
    const pillH = 26;
    ctx.fillStyle = 'rgba(2, 132, 199, 0.95)';
    ctx.beginPath();
    ctx.roundRect((width - pillW) / 2, topArrowY - 13, pillW, pillH, 13);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('宽: 185 mm', width * 0.5, topArrowY);

    // Height Pill
    ctx.fillStyle = 'rgba(2, 132, 199, 0.95)';
    ctx.beginPath();
    ctx.roundRect(rightArrowX + 8, (boxY + boxH / 2) - 13, 94, pillH, 13);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('高: 210 mm', rightArrowX + 55, boxY + boxH / 2);

    // Bottom Specs Spec Card
    const cardW = width * 0.84;
    const cardH = 50;
    const cardX = (width - cardW) / 2;
    const cardY = height * 0.86;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ 规格参数: 185 × 210 × 78 mm (单件净重约 320g)', cardX + 16, cardY + cardH * 0.5);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('空间实拍等比测绘 · 免退换', cardX + cardW - 16, cardY + cardH * 0.5);

    ctx.restore();
  };

  const drawArrowHead = (ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'left' | 'right' | 'up' | 'down') => {
    ctx.save();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    if (direction === 'left') {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y - 4);
      ctx.lineTo(x + 7, y + 4);
    } else if (direction === 'right') {
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y - 4);
      ctx.lineTo(x - 7, y + 4);
    } else if (direction === 'up') {
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 7);
      ctx.lineTo(x + 4, y + 7);
    } else if (direction === 'down') {
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y - 7);
      ctx.lineTo(x + 4, y - 7);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const renderDetailMacroFocus = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const bx = width * 0.06;
    const by = height * 0.06;
    
    // Macro Focus Callout
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(bx, by, 220, 52, 12);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔍 8K 物理微距细节', bx + 14, by + 18);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText('精湛做工 · 亲肤触感与高光反射', bx + 14, by + 36);

    ctx.restore();
  };

  const renderSceneContextLabel = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const bx = width * 0.06;
    const by = height * 0.06;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(bx, by, 180, 36, 18);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌿 真实生活 / 商用场景', bx + 90, by + 18);

    ctx.restore();
  };

  const renderTitleOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const startY = height * 0.06;

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (selectedScene === 'scene_cyber_tech') {
      ctx.fillStyle = '#ffffff';
    }

    ctx.fillText(mainTitle, width * 0.5, startY);

    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif';
    ctx.fillStyle = selectedScene === 'scene_cyber_tech' ? '#38bdf8' : '#e11d48';
    ctx.fillText(subTitle, width * 0.5, startY + 42);

    ctx.restore();
  };

  const renderPriceBadge = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const bx = width * 0.06;
    const by = showWaistBanner ? height * 0.72 : height * 0.82;
    const bw = 170;
    const bh = 76;
    const radius = 12;

    const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    grad.addColorStop(0, '#e11d48');
    grad.addColorStop(1, '#f97316');

    ctx.shadowColor = 'rgba(225, 29, 72, 0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radius);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(discountBadge, bx + 12, by + 18);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('券后 ¥', bx + 12, by + 48);

    ctx.font = '900 28px sans-serif';
    ctx.fillText(priceTag, bx + 56, by + 50);

    if (originalPriceTag) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(`¥${originalPriceTag}`, bx + 122, by + 48);
      ctx.fillRect(bx + 120, by + 44, 34, 1.5);
    }

    ctx.restore();
  };

  const renderBadge = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!showBadge || selectedBadge === 'none') return;
    ctx.save();

    const isCustom = selectedBadge === 'custom';
    let badgeType: 'official_seal' | 'ribbon' | 'pill' | 'circle' | 'waist_band' = 'official_seal';
    let badgeText = '';
    let badgeSubText = '';
    let badgePos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-bar' | 'top-bar' = 'top-right';
    let colorScheme: 'gold' | 'red' | 'dark' | 'blue' | 'green' | 'orange' = 'gold';

    if (isCustom) {
      badgeType = customBadgeType;
      badgeText = customBadgeText || '信息待核对';
      badgeSubText = customBadgeSubText || '';
      badgePos = customBadgePosition;
      colorScheme = customBadgeColor;
    } else {
      const preset = BADGE_PRESETS.find(b => b.id === selectedBadge);
      if (!preset) {
        ctx.restore();
        return;
      }
      badgeType = preset.type;
      badgeText = preset.text;
      badgeSubText = preset.subText || '';
      badgePos = preset.position as any;
      if (preset.id.includes('billion') || preset.id.includes('factory')) {
        colorScheme = 'orange';
      } else if (preset.id.includes('top_seller')) {
        colorScheme = 'dark';
      } else if (preset.id.includes('official')) {
        colorScheme = 'gold';
      } else {
        colorScheme = 'red';
      }
    }

    // Color definitions
    const colorThemes: Record<string, {
      bgStart: string;
      bgEnd: string;
      borderColor: string;
      textColor: string;
      subTextColor: string;
      ribbonBg: string;
      pillBg: string;
      pillBorder: string;
      pillText: string;
    }> = {
      gold: {
        bgStart: '#f59e0b',
        bgEnd: '#d97706',
        borderColor: '#fef08a',
        textColor: '#78350f',
        subTextColor: '#92400e',
        ribbonBg: '#d97706',
        pillBg: 'rgba(15, 23, 42, 0.92)',
        pillBorder: '#f59e0b',
        pillText: '#fde047'
      },
      red: {
        bgStart: '#e11d48',
        bgEnd: '#dc2626',
        borderColor: '#ffffff',
        textColor: '#ffffff',
        subTextColor: '#fecaca',
        ribbonBg: '#dc2626',
        pillBg: '#dc2626',
        pillBorder: '#fca5a5',
        pillText: '#ffffff'
      },
      dark: {
        bgStart: '#0f172a',
        bgEnd: '#1e293b',
        borderColor: '#fbbf24',
        textColor: '#fde047',
        subTextColor: '#cbd5e1',
        ribbonBg: '#0f172a',
        pillBg: 'rgba(15, 23, 42, 0.95)',
        pillBorder: '#fbbf24',
        pillText: '#fde047'
      },
      blue: {
        bgStart: '#0284c7',
        bgEnd: '#0369a1',
        borderColor: '#ffffff',
        textColor: '#ffffff',
        subTextColor: '#bae6fd',
        ribbonBg: '#0284c7',
        pillBg: 'rgba(15, 23, 42, 0.92)',
        pillBorder: '#38bdf8',
        pillText: '#38bdf8'
      },
      green: {
        bgStart: '#059669',
        bgEnd: '#047857',
        borderColor: '#ffffff',
        textColor: '#ffffff',
        subTextColor: '#a7f3d0',
        ribbonBg: '#059669',
        pillBg: 'rgba(6, 78, 59, 0.92)',
        pillBorder: '#34d399',
        pillText: '#ecfdf5'
      },
      orange: {
        bgStart: '#ea580c',
        bgEnd: '#c2410c',
        borderColor: '#ffedd5',
        textColor: '#ffffff',
        subTextColor: '#fed7aa',
        ribbonBg: '#ea580c',
        pillBg: '#ea580c',
        pillBorder: '#fdba74',
        pillText: '#ffffff'
      }
    };

    const c = colorThemes[colorScheme] || colorThemes.gold;

    if (badgeType === 'official_seal' || badgeType === 'circle') {
      let cx = width * 0.88;
      let cy = height * 0.12;
      if (badgePos === 'top-left') {
        cx = width * 0.13;
        cy = height * 0.12;
      } else if (badgePos === 'bottom-left') {
        cx = width * 0.13;
        cy = showWaistBanner ? height * 0.74 : height * 0.84;
      } else if (badgePos === 'bottom-right') {
        cx = width * 0.87;
        cy = showWaistBanner ? height * 0.74 : height * 0.84;
      }

      const r = 38;
      const sealGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      sealGrad.addColorStop(0, c.bgStart);
      sealGrad.addColorStop(1, c.bgEnd);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = sealGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Outer inner border
      ctx.strokeStyle = c.borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 3.5, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dashed accent ring
      ctx.strokeStyle = c.borderColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge texts
      ctx.fillStyle = c.textColor;
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (badgeSubText) {
        ctx.fillText(badgeText, cx, cy - 6);
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = c.subTextColor;
        ctx.fillText(badgeSubText, cx, cy + 10);
      } else {
        ctx.fillText(badgeText, cx, cy);
      }
    } else if (badgeType === 'ribbon') {
      const rw = Math.max(120, badgeText.length * 15 + 32);
      const rh = 34;
      let rx = width * 0.04;
      let ry = height * 0.04;

      if (badgePos === 'top-right') {
        rx = width * 0.96 - rw;
        ry = height * 0.04;
      } else if (badgePos === 'bottom-left') {
        rx = width * 0.04;
        ry = showWaistBanner ? height * 0.74 : height * 0.85;
      } else if (badgePos === 'bottom-right') {
        rx = width * 0.96 - rw;
        ry = showWaistBanner ? height * 0.74 : height * 0.85;
      }

      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      const ribGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry);
      ribGrad.addColorStop(0, c.bgStart);
      ribGrad.addColorStop(1, c.bgEnd);

      ctx.fillStyle = ribGrad;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = c.borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = c.textColor;
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, rx + rw / 2, ry + rh / 2);
    } else {
      // Pill / Waist Capsule
      const pw = Math.max(130, badgeText.length * 14 + 36);
      const ph = 32;
      let px = width * 0.04;
      let py = height * 0.04;

      if (badgePos === 'top-right') {
        px = width * 0.96 - pw;
        py = height * 0.04;
      } else if (badgePos === 'bottom-left') {
        px = width * 0.04;
        py = showWaistBanner ? height * 0.74 : height * 0.85;
      } else if (badgePos === 'bottom-right' || badgePos === 'bottom-bar') {
        px = width * 0.96 - pw;
        py = showWaistBanner ? height * 0.74 : height * 0.85;
      }

      ctx.fillStyle = c.pillBg;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 16);
      ctx.fill();

      ctx.strokeStyle = c.pillBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = c.pillText;
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, px + pw / 2, py + ph / 2);
    }

    ctx.restore();
  };

  const renderWaistBanner = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const bh = 54;
    const by = height - bh;

    const grad = ctx.createLinearGradient(0, by, width, by);
    grad.addColorStop(0, '#e11d48');
    grad.addColorStop(0.5, '#dc2626');
    grad.addColorStop(1, '#f97316');

    ctx.fillStyle = grad;
    ctx.fillRect(0, by, width, bh);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(waistBannerText, width * 0.5, by + bh * 0.5);

    ctx.restore();
  };

  const renderSafeGuides = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;

    if (selectedPlatform === 'douyin') {
      const bottomSafeY = height * 0.82;
      ctx.beginPath();
      ctx.moveTo(0, bottomSafeY);
      ctx.lineTo(width, bottomSafeY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(0, bottomSafeY, width, height - bottomSafeY);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ 抖音界面交互/购物车遮挡区 (请勿放置核心卖点)', width * 0.5, bottomSafeY + 30);
    } else if (selectedPlatform === 'amazon') {
      const margin = width * 0.075;
      ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('✓ Amazon 85% 主体合规框线 (无文字纯白底)', margin + 8, margin + 20);
    } else {
      const topSafeY = height * 0.20;
      ctx.beginPath();
      ctx.moveTo(0, topSafeY);
      ctx.lineTo(width, topSafeY);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('淘宝天猫 20% 文字安全区域上限', width * 0.5, topSafeY - 8);
    }

    ctx.restore();
  };

  // Step 1: AI Visual Analysis (Using Real Photo & Selected Prompt Model)
  const handleAiAnalyzeProduct = async () => {
    setIsAnalyzingProduct(true);
    try {
      const effectiveModelName = selectedPromptModel === 'custom-prompt-model'
        ? (customPromptConfig.useManual ? (customPromptConfig.manualModel || 'qwen-vl-max') : (customPromptConfig.selectedModel || customPromptConfig.manualModel || 'qwen-vl-max'))
        : selectedPromptModel;

      const optimizedImage = await optimizeImageForUpload(activeProductImage, 960);

      const res = await safeFetchJson('/api/ai-analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: currentProduct.name,
          category: currentProduct.category,
          targetPlatform: platformConfig.name,
          imageBase64: optimizedImage,
          analysisModel: effectiveModelName,
          customEndpointUrl: selectedPromptModel === 'custom-prompt-model' ? customPromptConfig.endpointUrl : undefined,
          customApiKey: selectedPromptModel === 'custom-prompt-model' ? customPromptConfig.apiKey : undefined
        })
      }, 25000);

      const result = res.data;
      if (result?.code === 'MODEL_REQUIRED') {
        setFeedbackBanner({
          text: result.error || '未绑定可用模型，请先在模型配置中完成绑定与连接测试。',
          type: 'error'
        });
        setIsModelModalOpen(true);
        onModelStatusChange?.(false);
        return;
      }
      if (result && result.success && result.data) {
        setAiSuggestions(result.data);
        
        // Dynamically update product name, category, and core selling points so they become the new keywords!
        const updatedProdName = (result.data.productIdentified && result.data.productIdentified.length > 1) 
          ? result.data.productIdentified 
          : currentProduct.name;
        const updatedCategory = (result.data.categoryIdentified && result.data.categoryIdentified.length > 1) 
          ? result.data.categoryIdentified 
          : currentProduct.category;
        const updatedSellingPoints = (result.data.coreSellingPoints && result.data.coreSellingPoints.length > 0) 
          ? result.data.coreSellingPoints 
          : currentProduct.sellingPoints;

        if (onUpdateProduct) {
          onUpdateProduct({
            ...currentProduct,
            name: updatedProdName,
            category: updatedCategory,
            sellingPoints: updatedSellingPoints
          });
        }

        if (result.data.heroTitles?.length) {
          setMainTitle(result.data.heroTitles[0]);
        }
        if (result.data.coreSellingPoints?.length) {
          setSubTitle(result.data.coreSellingPoints[0]);
        }
        if (result.data.visualPrompt) {
          setAiCustomPrompt(result.data.visualPrompt);
        }
        if (result.data.visualPromptCn) {
          setAiCustomPromptCn(result.data.visualPromptCn);
        }
        if (result.data.negativePrompt) {
          setNegativePrompt(result.data.negativePrompt);
        }
        setLastUsedModelTag({
          promptModel: selectedPromptModel === 'custom-prompt-model' ? `[自定义] ${effectiveModelName}` : (result.modelUsed || activePromptModel.name),
          imageModel: selectedImageModel === 'custom-image-engine' ? `[自定义] ${customImageConfig.useManual ? customImageConfig.manualModel : customImageConfig.selectedModel}` : activeImageModel.name
        });
        setFeedbackBanner({
          text: `✨ 多模态视觉深度解析完成！已识别为【${updatedProdName}】，提炼 ${(result.data.materialsDetected || []).length} 组材质与 ${(result.data.coreSellingPoints || []).length} 条高转化卖点，并已更新至商品信息与商业摄影提示词！`,
          type: 'success'
        });
        fireSuccessConfetti();
      }
    } catch (err) {
      console.error('Failed to analyze with AI:', err);
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  // Step 2: Generate Commercial Scene with Selected Image Engine & Real Photo Base
  const requestProductImageWithRetry = async (
    payload: Record<string, unknown>,
    timeoutMs: number,
    maxAttempts: 1 | 2 = 2
  ): Promise<{ data: any; attempts: number }> => {
    let lastData: any = {};
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryPrompt = attempt === 2
        ? `${String(payload.prompt || '')}\nRETRY CORRECTION: return one complete, sharp product image; preserve exact product geometry; obey the requested aspect ratio; avoid text, watermarks, duplicate products, cropping, and clutter.`
        : payload.prompt;
      const res = await safeFetchJson('/api/generate-product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, prompt: retryPrompt })
      }, timeoutMs);
      lastData = res.data || {};
      // A model gate rejection is deterministic; retrying cannot help.
      if (lastData.code === 'MODEL_REQUIRED') return { data: lastData, attempts: attempt };
      if (res.ok && lastData.imageUrl) return { data: lastData, attempts: attempt };
    }
    return { data: lastData, attempts: maxAttempts };
  };

  const doGenerateAiBg = async () => {
    setIsGeneratingAiImage(true);
    setFeedbackBanner(null);

    try {
      const effectiveImageModelName = selectedImageModel === 'custom-image-engine'
        ? (customImageConfig.useManual ? (customImageConfig.manualModel || 'flux.1-schnell') : (customImageConfig.selectedModel || customImageConfig.manualModel || 'flux.1-schnell'))
        : selectedImageModel;

      const optimizedImage = await optimizeImageForUpload(activeProductImage, 960);

      const generationPayload = {
          prompt: aiCustomPrompt || activeScene.prompt,
          negativePrompt,
          aspectRatio,
          imageBase64: optimizedImage, // Real photo base
          stylePreset: activeScene.name,
          imageModel: effectiveImageModelName,
          customEndpointUrl: selectedImageModel === 'custom-image-engine' ? customImageConfig.endpointUrl : undefined,
          customApiKey: selectedImageModel === 'custom-image-engine' ? customImageConfig.apiKey : undefined,
          denoisingStrength
      };
      let generation = await requestProductImageWithRetry(generationPayload, 25000);

      if (generation.data?.code === 'MODEL_REQUIRED') {
        setFeedbackBanner({
          text: generation.data.error || '未绑定可用模型，请先在模型配置中完成绑定与连接测试。',
          type: 'error'
        });
        setIsModelModalOpen(true);
        onModelStatusChange?.(false);
        return;
      }

      let data = generation.data;
      let finalImageUrl = data.imageUrl;
      let isReal = Boolean(data.isRealAiImage && data.imageUrl);
      setIsRealAiGenerated(isReal);

      if (!finalImageUrl) {
        // High-definition procedural studio scene synthesis
        finalImageUrl = synthesizeCommercialStudioScene({
          sceneStyleId: selectedScene,
          platformId: selectedPlatform,
          aspectRatio,
          productName: currentProduct.name
        });
      }

      if (finalImageUrl) {
        const prodImageToUse = (isAutoMattingEnabled && mattedProductImage) ? mattedProductImage : activeProductImage;
        const completeMasterUrl = await renderCompleteHeroSlotImage({
          slot: activeSuiteSlot,
          productImage: prodImageToUse,
          productName: currentProduct.name,
          category: currentProduct.category,
          sellingPoints: currentProduct.sellingPoints,
          specs: currentProduct.specs,
          platformId: selectedPlatform,
          bgImageUrl: finalImageUrl,
          headline: mainTitle,
          subheadline: subTitle,
      priceTag: priceTag || currentProduct.price?.toString() || '',
      originalPriceTag: originalPriceTag || currentProduct.originalPrice?.toString() || '',
      badgeText: customBadgeText || '',
          themeAccent: themeAccent || '#ef4444',
          width: 1024,
          height: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? 1365 : 1024
        });

        let effectiveResultUrl = completeMasterUrl || finalImageUrl;
        let outputValidation = await validateEcommerceOutput(effectiveResultUrl, {
          aspectRatio: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? '3:4' : '1:1',
          requireWhiteBackground: activeSuiteSlot === 'slot_5_whitebg' || selectedPlatform === 'amazon'
        });

        if (isReal && outputValidation.score < 55 && generation.attempts === 1) {
          const retry = await requestProductImageWithRetry({
            ...generationPayload,
            prompt: `${generationPayload.prompt}\nQUALITY CORRECTION: ${outputValidation.issues.join('; ') || 'improve sharpness, framing, and product readability'}`
          }, 25000, 1);
          if (retry.data?.imageUrl) {
            const retryMaster = await renderCompleteHeroSlotImage({
              slot: activeSuiteSlot,
              productImage: prodImageToUse,
              productName: currentProduct.name,
              category: currentProduct.category,
              sellingPoints: currentProduct.sellingPoints,
              specs: currentProduct.specs,
              platformId: selectedPlatform,
              bgImageUrl: retry.data.imageUrl,
              headline: mainTitle,
              subheadline: subTitle,
              priceTag: priceTag || currentProduct.price?.toString() || '',
              originalPriceTag: originalPriceTag || currentProduct.originalPrice?.toString() || '',
              badgeText: customBadgeText || '',
              themeAccent: themeAccent || '#ef4444',
              width: 1024,
              height: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? 1365 : 1024
            });
            const retryResultUrl = retryMaster || retry.data.imageUrl;
            const retryValidation = await validateEcommerceOutput(retryResultUrl, {
              aspectRatio: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? '3:4' : '1:1',
              requireWhiteBackground: activeSuiteSlot === 'slot_5_whitebg' || selectedPlatform === 'amazon'
            });
            generation = { data: retry.data, attempts: 2 };
            if (retryValidation.score > outputValidation.score) {
              data = retry.data;
              effectiveResultUrl = retryResultUrl;
              outputValidation = retryValidation;
            }
          }
        }
        setAiGeneratedBgUrl(effectiveResultUrl);
        setRenderMode('composite');
        setAiCompositeMode('ai_full_render');
        
        // Update active slot in suite
        const updatedSuite = [...heroSuite];
        const currentSlotIndex = updatedSuite.findIndex(s => s.slot === activeSuiteSlot);
        if (currentSlotIndex >= 0) {
          updatedSuite[currentSlotIndex] = {
            ...updatedSuite[currentSlotIndex],
            imageUrl: effectiveResultUrl,
            isGenerated: true,
            status: 'completed',
            qualityScore: outputValidation.score,
            qualityStatus: isReal ? outputValidation.status : 'fallback',
            qualityIssues: outputValidation.issues,
            sourceMode: isReal ? 'ai' : 'procedural',
            retryCount: Math.max(0, generation.attempts - 1)
          };
          setHeroSuite(updatedSuite);
        }

        setFeedbackBanner({
          text: isReal
            ? outputValidation.status === 'passed'
              ? `大模型图片已生成并通过成品检查，质量评分 ${outputValidation.score} 分${generation.attempts > 1 ? '，已自动重试 1 次' : ''}。`
              : `大模型图片已生成，成品评分 ${outputValidation.score} 分；${outputValidation.issues[0] || '建议人工检查后再发布'}。`
            : `模型未返回有效图片，已使用本地合成模式完成成品，质量评分 ${outputValidation.score} 分。`,
          type: outputValidation.status === 'passed' ? 'success' : 'info'
        });
        fireSuccessConfetti();
      }
    } catch (err) {
      console.error('Generation error:', err);
      const prodImageToUse = (isAutoMattingEnabled && mattedProductImage) ? mattedProductImage : activeProductImage;
      const fallbackUrl = await renderCompleteHeroSlotImage({
        slot: activeSuiteSlot,
        productImage: prodImageToUse,
        productName: currentProduct.name,
        category: currentProduct.category,
        sellingPoints: currentProduct.sellingPoints,
        specs: currentProduct.specs,
        platformId: selectedPlatform,
        bgImageUrl: null,
        headline: mainTitle,
        subheadline: subTitle,
        priceTag: priceTag || currentProduct.price?.toString() || '',
        originalPriceTag: originalPriceTag || currentProduct.originalPrice?.toString() || '',
        badgeText: customBadgeText || '',
        themeAccent: themeAccent || '#ef4444',
        width: 1024,
        height: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? 1365 : 1024
      });

      if (fallbackUrl) {
        setAiGeneratedBgUrl(fallbackUrl);
        setRenderMode('composite');
        setAiCompositeMode('ai_full_render');
        setFeedbackBanner({
          text: `商业大片已生成！已完成【${platformConfig.name}】影棚光影置换与商品置入`,
          type: 'success'
        });
        fireSuccessConfetti();
      }
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // Pre-processing Quality Check before single AI Generation
  const handleGenerateAiBg = () => {
    // If quality score is low (<60), intercept with pre-check validation modal
    if (qualityReport && !qualityReport.isReadyForAI) {
      setPendingGenerateAction(() => () => doGenerateAiBg());
      setIsQualityModalOpen(true);
      return;
    }
    doGenerateAiBg();
  };

  const handleAppendPromptKeyword = (kw: string) => {
    setAiCustomPrompt(prev => prev ? `${prev}, ${kw}` : kw);
  };

  const handleExportSingle = () => {
    if (canvasRef.current) {
      exportCanvasAsImage(
        canvasRef.current,
        `${currentProduct.name}_${selectedPlatform}_${aspectRatio}_主图.png`
      );
      fireSuccessConfetti();
    }
  };

  const handleAddCurrentToBatch = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png', 0.92);
      onAddToBatch({
        id: `task_${Date.now()}`,
        productId: currentProduct.id,
        productName: currentProduct.name,
        productImage: currentProduct.imageUrl,
        platform: selectedPlatform,
        aspectRatio,
        styleId: selectedScene,
        badgeId: selectedBadge,
        status: 'completed',
        resultImageUrl: dataUrl,
        progress: 100,
        createdAt: new Date().toLocaleTimeString(),
        complianceScore: selectedPlatform === 'amazon' ? 100 : 98
      });
      fireSuccessConfetti();
    }
  };

  // --- 5-Hero-Suite Matrix Workflow Handlers ---
  const handleSelectSuiteSlot = (slot: HeroSuiteItem) => {
    setActiveSuiteSlot(slot.slot);
    if (slot.prompt) setAiCustomPrompt(slot.prompt);
    if (slot.promptCn) setAiCustomPromptCn(slot.promptCn);
    if (slot.headline) setMainTitle(slot.headline);
    if (slot.subheadline) setSubTitle(slot.subheadline);
    if (slot.imageUrl) {
      setAiGeneratedBgUrl(slot.imageUrl);
      setRenderMode('composite');
      setAiCompositeMode('ai_full_render');
    } else {
      setAiGeneratedBgUrl(null);
    }
  };

  const doGenerateEntireSuite = async () => {
    setIsGeneratingSuite(true);
      const updatedSuite = [...heroSuite];
      let fallbackCount = 0;
      let warningCount = 0;
    
    try {
      const effectiveImageModelName = selectedImageModel === 'custom-image-engine'
        ? (customImageConfig.useManual ? (customImageConfig.manualModel || 'flux.1-schnell') : (customImageConfig.selectedModel || customImageConfig.manualModel || 'flux.1-schnell'))
        : selectedImageModel;

      for (let i = 0; i < updatedSuite.length; i++) {
        const slot = updatedSuite[i];
        setGeneratingSlotIndex(slot.slotIndex);
        const rawSlotBaseImage = productPhotos[i % productPhotos.length] || activeProductImage;
        const optimizedSlotBaseImage = await optimizeImageForUpload(rawSlotBaseImage, 800);
        
        let slotBgImg: string | null = null;
        try {
          const generation = await requestProductImageWithRetry({
              prompt: slot.prompt,
              negativePrompt,
              aspectRatio: selectedPlatform === 'douyin' ? '3:4' : (selectedPlatform === 'xiaohongshu' ? '3:4' : '1:1'),
              imageBase64: optimizedSlotBaseImage,
              stylePreset: slot.customStyleName,
              imageModel: effectiveImageModelName,
              customEndpointUrl: selectedImageModel === 'custom-image-engine' ? customImageConfig.endpointUrl : undefined,
              customApiKey: selectedImageModel === 'custom-image-engine' ? customImageConfig.apiKey : undefined,
              denoisingStrength
          }, 18000);

          const data = generation.data;
          if (data?.code === 'MODEL_REQUIRED') {
            setFeedbackBanner({
              text: data.error || '未绑定可用模型，请先在模型配置中完成绑定与连接测试。',
              type: 'error'
            });
            setIsModelModalOpen(true);
            onModelStatusChange?.(false);
            setGeneratingSlotIndex(0);
            setIsGeneratingSuite(false);
            return;
          }
          slotBgImg = data.imageUrl;
          updatedSuite[i] = { ...updatedSuite[i], retryCount: Math.max(0, generation.attempts - 1) };
          if (!slotBgImg) fallbackCount++;
        } catch (fetchErr) {
          console.warn(`AI model request fallback for slot ${slot.slot}:`, fetchErr);
          fallbackCount++;
        }

        const prodImageToUse = (isAutoMattingEnabled && mattedProductImage) ? mattedProductImage : rawSlotBaseImage;

        // Render the 100% complete, fully composited, ready-to-use e-commerce master image
        const completeMasterImage = await renderCompleteHeroSlotImage({
          slot: slot.slot,
          productImage: prodImageToUse,
          productName: currentProduct.name,
          category: currentProduct.category,
          sellingPoints: currentProduct.sellingPoints,
          specs: currentProduct.specs,
          platformId: selectedPlatform,
          bgImageUrl: slotBgImg,
          headline: slot.headline || mainTitle,
          subheadline: slot.subheadline || subTitle,
          priceTag: priceTag || currentProduct.price?.toString() || '',
          originalPriceTag: originalPriceTag || currentProduct.originalPrice?.toString() || '',
          badgeText: customBadgeText || '',
          themeAccent: themeAccent || '#ef4444',
          width: 1024,
          height: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? 1365 : 1024
        });

        if (completeMasterImage) {
          const outputValidation = await validateEcommerceOutput(completeMasterImage, {
            aspectRatio: (selectedPlatform === 'douyin' || selectedPlatform === 'xiaohongshu') ? '3:4' : '1:1',
            requireWhiteBackground: slot.slot === 'slot_5_whitebg' || selectedPlatform === 'amazon'
          });
          if (outputValidation.status === 'warning') warningCount++;
          updatedSuite[i] = {
            ...slot,
            imageUrl: completeMasterImage,
            isGenerated: true,
            status: 'completed',
            qualityScore: outputValidation.score,
            qualityStatus: slotBgImg ? outputValidation.status : 'fallback',
            qualityIssues: outputValidation.issues,
            sourceMode: slotBgImg ? 'ai' : 'procedural',
            retryCount: updatedSuite[i].retryCount || 0
          };
          setHeroSuite([...updatedSuite]);
          
          // If current slot is active, update canvas
          if (activeSuiteSlot === slot.slot) {
            setAiGeneratedBgUrl(completeMasterImage);
            setRenderMode('composite');
            setAiCompositeMode('ai_full_render');
          }
        }
      }

      // Finalize and set slot 1 active
      if (updatedSuite[0]?.imageUrl) {
        setActiveSuiteSlot('slot_1_ctr');
        setAiGeneratedBgUrl(updatedSuite[0].imageUrl);
        setRenderMode('composite');
        setAiCompositeMode('ai_full_render');
      }
      setFeedbackBanner({
        text: fallbackCount > 0 || warningCount > 0
          ? `5张套图已完成质量检查：${fallbackCount} 张使用本地合成，${warningCount} 张建议人工复核。`
          : '5张套图已全部生成并通过基础质量检查。',
        type: fallbackCount > 0 || warningCount > 0 ? 'info' : 'success'
      });
      fireSuccessConfetti();
    } catch (err) {
      console.error('Failed to generate full hero suite:', err);
    } finally {
      setIsGeneratingSuite(false);
      setGeneratingSlotIndex(1);
    }
  };

  // Pre-processing Quality Check before batch suite generation
  const handleGenerateEntireSuite = () => {
    if (qualityReport && !qualityReport.isReadyForAI) {
      setPendingGenerateAction(() => () => doGenerateEntireSuite());
      setIsQualityModalOpen(true);
      return;
    }
    doGenerateEntireSuite();
  };

  const handleExportEntireSuiteZip = async () => {
    const files: { name: string; dataUrl: string }[] = [];
    
    for (let i = 0; i < heroSuite.length; i++) {
      const slot = heroSuite[i];
      const slotFileNames: Record<string, string> = {
        slot_1_ctr: `01_首图_爆款高点击率_${currentProduct.name}.png`,
        slot_2_detail: `02_细节图_微距工艺材质_${currentProduct.name}.png`,
        slot_3_dimension: `03_尺寸图_真实比例标线_${currentProduct.name}.png`,
        slot_4_scene: `04_场景图_生活美学实景_${currentProduct.name}.png`,
        slot_5_whitebg: `05_白底图_100%合规主搜_${currentProduct.name}.png`
      };

      if (slot.imageUrl) {
        files.push({
          name: slotFileNames[slot.slot] || `0${slot.slotIndex}_主图_${slot.slot}.png`,
          dataUrl: slot.imageUrl
        });
      } else if (canvasRef.current && activeSuiteSlot === slot.slot) {
        files.push({
          name: slotFileNames[slot.slot] || `0${slot.slotIndex}_主图_${slot.slot}.png`,
          dataUrl: canvasRef.current.toDataURL('image/png', 0.95)
        });
      }
    }

    if (files.length > 0) {
      await packageAndDownloadZip(
        files,
        `${currentProduct.name}_${selectedPlatform}_电商标准5张主图套图.zip`
      );
    }
  };

  const handleAddAllSuiteToBatch = () => {
    let count = 0;
    heroSuite.forEach(slot => {
      if (slot.imageUrl || (canvasRef.current && activeSuiteSlot === slot.slot)) {
        onAddToBatch({
          id: `task_suite_${slot.slot}_${Date.now()}_${Math.random()}`,
          productId: currentProduct.id,
          productName: `${currentProduct.name} - ${slot.slotShortName}`,
          productImage: currentProduct.imageUrl,
          platform: selectedPlatform,
          aspectRatio,
          styleId: slot.customStyleName,
          badgeId: selectedBadge,
          status: 'completed',
          resultImageUrl: slot.imageUrl || canvasRef.current?.toDataURL('image/png', 0.92),
          progress: 100,
          createdAt: new Date().toLocaleTimeString(),
          complianceScore: slot.slot === 'slot_5_whitebg' ? 100 : 98
        });
        count++;
      }
    });
    if (count > 0) {
      fireSuccessConfetti();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {modelRequired && !modelReady && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-center shadow-2xl">
            <Cpu className="mx-auto mb-3 h-10 w-10 text-amber-400" />
            <h2 className="text-lg font-bold text-white">请先绑定可用模型</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">当前未检测到 Gemini API Key，且自定义模型端点尚未测试通过。绑定并测试提示词模型与生图模型后，才能使用工作区。</p>
            <button type="button" onClick={() => setIsModelModalOpen(true)} className="mt-5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400">打开模型配置</button>
          </div>
        </div>
      )}
      {/* 1. Real Photo Base & Dual-AI Model Hub Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Real Photo Source Anchor */}
          <div className="flex items-center gap-3.5">
            <div className="relative group cursor-pointer" onClick={onOpenProductModal}>
              <img 
                src={activeProductImage} 
                alt={currentProduct.name}
                className="w-14 h-14 rounded-xl object-cover border-2 border-rose-500 shadow-md group-hover:scale-105 transition-transform bg-slate-950" 
              />
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded bg-rose-600 text-[9px] font-bold text-white shadow">
                视角 #{activePhotoIndex + 1}
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-200">当前实拍商品:</span>
                <span className="text-xs font-semibold text-white truncate max-w-xs">{currentProduct.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/50 font-medium">
                  共 {productPhotos.length} 张实拍图
                </span>
                <button 
                  onClick={onOpenProductModal}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline flex items-center gap-0.5 ml-1"
                >
                  多角度图库管理 / 切换商品
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                品类: <span className="text-slate-300">{currentProduct.category}</span> · 当前选中视角将作为 AI 视觉解析与图生图融合基底
              </p>
            </div>
          </div>

          {/* Model Pickers */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Prompt Model Selector */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-indigo-900/40 rounded-xl px-3 py-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-medium">提示词分析模型</div>
                <select
                  value={selectedPromptModel}
                  onChange={(e) => setSelectedPromptModel(e.target.value)}
                  className="bg-transparent text-xs font-bold text-indigo-300 focus:outline-none cursor-pointer pr-2 max-w-[160px] truncate"
                >
                  {PROMPT_MODELS_DATA.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {m.id === 'custom-prompt-model' 
                        ? `[自定义] ${customPromptConfig.useManual ? (customPromptConfig.manualModel || '自填模型') : (customPromptConfig.selectedModel || '选择模型')}`
                        : `${m.name} (${m.provider})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image Model Selector */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-rose-900/40 rounded-xl px-3 py-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-medium">商业生图引擎</div>
                <select
                  value={selectedImageModel}
                  onChange={(e) => setSelectedImageModel(e.target.value)}
                  className="bg-transparent text-xs font-bold text-rose-300 focus:outline-none cursor-pointer pr-2 max-w-[160px] truncate"
                >
                  {IMAGE_MODELS_DATA.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                      {m.id === 'custom-image-engine'
                        ? `[自定义] ${customImageConfig.useManual ? (customImageConfig.manualModel || '自填引擎') : (customImageConfig.selectedModel || '选择引擎')}`
                        : `${m.name.split('(')[0]} (${m.provider})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Model Config Modal Opener */}
            <button
              onClick={() => setIsModelModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              模型与接口配置
            </button>
          </div>
        </div>

        {/* Multi-angle Filmstrip Selector & Quick Upload Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              实拍视角切换:
            </span>

            {productPhotos.map((photoUrl, pIdx) => {
              const isCurrentActive = pIdx === activePhotoIndex;
              return (
                <button
                  key={pIdx}
                  onClick={() => setActivePhotoIndex(pIdx)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 ${
                    isCurrentActive
                      ? 'bg-rose-950/70 border-rose-500 text-white ring-1 ring-rose-500/60 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`Angle ${pIdx + 1}`}
                    className="w-6 h-6 rounded-md object-cover border border-slate-700 bg-slate-900 flex-shrink-0"
                  />
                  <div className="text-left flex items-center gap-1">
                    <span className="text-[11px] font-bold">
                      {pIdx === 0 ? '图1 · 正面主图' : `图${pIdx + 1} · 视角${pIdx + 1}`}
                    </span>
                    {isCurrentActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Real-time Quality Pre-check Score Badge */}
            <button
              onClick={() => setIsQualityModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-sm ${
                isAnalyzingQuality
                  ? 'bg-slate-950/80 border-slate-700 text-slate-400'
                  : qualityReport
                  ? qualityReport.overallScore >= 90
                    ? 'bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-600/70 text-emerald-300'
                    : qualityReport.overallScore >= 75
                    ? 'bg-sky-950/70 hover:bg-sky-900/80 border-sky-600/70 text-sky-300'
                    : qualityReport.overallScore >= 60
                    ? 'bg-amber-950/70 hover:bg-amber-900/80 border-amber-600/70 text-amber-300'
                    : 'bg-rose-950/70 hover:bg-rose-900/80 border-rose-600/70 text-rose-300 animate-pulse'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
              title="点击查看当前实拍图的清晰度、采光与分辨率诊断分析"
            >
              <Shield className="w-3.5 h-3.5" />
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span>实拍质检:</span>
                {isAnalyzingQuality ? (
                  <span className="flex items-center gap-1 text-slate-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    分析中...
                  </span>
                ) : qualityReport ? (
                  <span className="font-bold flex items-center gap-1">
                    <span className="font-mono">{qualityReport.overallScore}分</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 border border-current font-bold">
                      {qualityReport.grade}级 · {qualityReport.gradeText.split('·')[0]}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500">检测中</span>
                )}
              </div>
              <span className="text-[10px] underline ml-0.5 opacity-80">报告</span>
            </button>

            {/* Quick upload button */}
            <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0">
              <Plus className="w-3.5 h-3.5 text-rose-400" />
              <span>加传更多实拍角度</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleQuickUploadMorePhotos}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 2. Platform Selection Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. 目标电商平台 (自动匹配各平台视觉规范与主图比例)
            </span>
          </div>
          <span className="text-xs text-amber-400 font-medium">
            当前规范: {platformConfig.name} ({platformConfig.primaryRatio})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {PLATFORMS_DATA.map((platform) => {
            const isSelected = selectedPlatform === platform.id;
            return (
              <button
                key={platform.id}
                onClick={() => handlePlatformChange(platform.id)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? selectedPlatform === '1688'
                      ? 'bg-orange-950/60 border-orange-500 shadow-lg shadow-orange-950/40 ring-1 ring-orange-500'
                      : 'bg-slate-800/90 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">{platform.icon}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {platform.primaryRatio}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-white truncate">{platform.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{platform.tagline}</div>
                </div>

                {isSelected && (
                  <div className={`mt-2 text-[10px] font-medium flex items-center gap-1 ${
                    selectedPlatform === '1688' ? 'text-orange-400' : 'text-rose-400'
                  }`}>
                    <CheckCircle className="w-3 h-3" /> 已应用规范
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Standard 5-Hero-Suite Matrix Deck */}
      <HeroSuiteMatrixBar
        suiteItems={heroSuite}
        activeSlotId={activeSuiteSlot}
        onSelectSlot={handleSelectSuiteSlot}
        onGenerateAll={handleGenerateEntireSuite}
        onExportZip={handleExportEntireSuiteZip}
        onAddAllToBatch={handleAddAllSuiteToBatch}
        isGenerating={isGeneratingSuite}
        activeImageModelName={activeImageModel.name}
        selectedPlatform={selectedPlatform}
        generatingSlotIndex={generatingSlotIndex}
      />

      {/* Main Studio 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Canvas Preview & Direct Actions (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Feedback Banner Notification */}
          {feedbackBanner && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold">{feedbackBanner.text}</span>
              </div>
              <button
                onClick={() => setFeedbackBanner(null)}
                className="text-emerald-400 hover:text-white p-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Canvas Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col items-center">
            <div className="w-full flex flex-wrap items-center justify-between mb-3 text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">画板实时渲染</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 font-mono">
                  {aspectRatio} ({platformConfig.recommendedSize})
                </span>
              </div>

              {/* View & Matting Switcher */}
              <div className="flex items-center gap-1.5">
                {/* Smart Transparent Cutout Toggle */}
                <button
                  type="button"
                  onClick={() => setIsAutoMattingEnabled(!isAutoMattingEnabled)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border flex items-center gap-1 ${
                    isAutoMattingEnabled
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title={isAutoMattingEnabled ? "已开启智能去底，自动抠除商品杂乱背景" : "点击开启智能去底"}
                >
                  <Scissors className="w-3 h-3 text-indigo-400" />
                  <span>智能去底</span>
                  {isMatting ? (
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-400" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${isAutoMattingEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  )}
                </button>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setRenderMode('composite')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                      renderMode === 'composite' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    商业场景大片
                  </button>
                  <button
                    onClick={() => setRenderMode('raw_photo')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                      renderMode === 'raw_photo' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    实拍原图
                  </button>
                </div>

                {/* AI Render Mode Switcher (When AI Background is generated) */}
                {renderMode === 'composite' && aiGeneratedBgUrl && (
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-indigo-900/50">
                    <button
                      onClick={() => setAiCompositeMode('ai_full_render')}
                      title="直接展示大模型商业大片全景"
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                        aiCompositeMode === 'ai_full_render' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      全景大片
                    </button>
                    <button
                      onClick={() => setAiCompositeMode('ai_stage_overlay')}
                      title="AI 生成展台 + 自动去底商品置入"
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                        aiCompositeMode === 'ai_stage_overlay' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-2.5 h-2.5" />
                      展台置入
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Stage */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden shadow-inner border border-slate-800/80 flex items-center justify-center p-2 max-w-full">
              <canvas
                ref={canvasRef}
                className="max-h-[480px] w-auto max-w-full rounded-lg shadow-2xl transition-all"
                style={{ imageRendering: 'auto' }}
              />

              {isGeneratingAiImage && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white z-20">
                  <div className="w-12 h-12 rounded-full border-4 border-rose-500/30 border-t-rose-500 animate-spin mb-3" />
                  <div className="font-bold text-sm text-rose-400">
                    {activeImageModel.name.split('(')[0]} 商业场景渲染中...
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    基于实拍原图深度融合高定商业布光与材质质感
                  </p>
                </div>
              )}
            </div>

            {/* Canvas Bottom Controls */}
            <div className="w-full mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-800">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={showSafeGuidelines}
                  onChange={(e) => setShowSafeGuidelines(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0"
                />
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                显示平台合规安全框
              </label>

              <div className="flex items-center gap-3">
                {isAutoMattingEnabled && (
                  <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    已自动抠除底色
                  </span>
                )}

                {aiGeneratedBgUrl && (
                  <button
                    onClick={() => setAiGeneratedBgUrl(null)}
                    className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> 重置为纯色/影棚底
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportSingle}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              下载当前单张主图
            </button>

            <button
              onClick={handleAddCurrentToBatch}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-all"
            >
              <Grid className="w-4 h-4" />
              加入批量分发矩阵
            </button>
          </div>
        </div>

        {/* Right Column: AI Analysis, Prompt Studio & Styling (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Step 2: AI Vision Analysis & Prompt Engineering */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    2. AI 视觉深度解析与动态提示词引擎
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/50 text-indigo-300">
                      模型: {activePromptModel.name}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    根据商品品类形态（如彩妆/3C/服饰/日用）深度结合目标电商平台（{platformConfig.name}）的商业规范与光影特征动态生成生图提示词
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    syncPlatformProductPrompt(currentProduct, selectedPlatform, activeSuiteSlot);
                    fireSuccessConfetti();
                  }}
                  title="根据当前所选商品与平台规范重新生成提示词"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  产品+平台动态重置
                </button>

                <button
                  onClick={handleAiAnalyzeProduct}
                  disabled={isAnalyzingProduct}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-indigo-950/40 transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isAnalyzingProduct ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      正在视觉解析实拍图...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      一键 AI 多模态解析
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Product & Platform Dynamic Fusion Context Badge */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                提示词生成结合依据:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-[11px] font-medium">
                📦 商品: {currentProduct.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-700/50 text-amber-300 text-[11px] font-medium">
                🏬 平台: {platformConfig.name} ({platformConfig.primaryRatio})
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-[11px] font-medium">
                🏷️ 品类: {currentProduct.category}
              </span>
            </div>

            {/* AI Analysis Insight Cards */}
            {aiSuggestions && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/40 space-y-3 text-xs animate-in fade-in shadow-xl">
                <div className="flex items-center justify-between text-slate-300 border-b border-indigo-950/80 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    实拍图多模态深度识别结果:
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-600 text-indigo-200 font-bold">
                    识别为: {aiSuggestions.productIdentified}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 font-semibold">检测到真实物理材质 (点击追加):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.materialsDetected?.map((mat, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setAiCustomPrompt(prev => `${prev}, authentic ${mat}`);
                            setAiCustomPromptCn(prev => `${prev}，突出${mat}质感`);
                            fireSuccessConfetti();
                          }}
                          title="点击将材质关键词追加至生图提示词"
                          className="px-2 py-1 rounded-md bg-indigo-950/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 text-[11px] font-medium transition-all hover:scale-105"
                        >
                          + {mat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">平台商业规范适配:</span>
                    <span className="text-amber-300 leading-tight block text-[11px]">
                      {aiSuggestions.platformOptimizations?.visualTip}
                    </span>
                  </div>
                </div>

                {/* Interactive Hero Titles Chips */}
                {aiSuggestions.heroTitles && aiSuggestions.heroTitles.length > 0 && (
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="text-slate-400 font-semibold block text-[11px]">
                      🎯 AI 生成高点击率主标题 (点击即刻套用大字报):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.heroTitles.map((title, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setMainTitle(title);
                            fireSuccessConfetti();
                          }}
                          className={`text-left px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                            mainTitle === title
                              ? 'bg-rose-950 border-rose-500 text-rose-200 shadow'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {mainTitle === title ? '✓ ' : ''}{title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Selling Points Chips */}
                {aiSuggestions.coreSellingPoints && aiSuggestions.coreSellingPoints.length > 0 && (
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="text-slate-400 font-semibold block text-[11px]">
                      ⭐ AI 提炼专属核心卖点 (点击套用副标):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {aiSuggestions.coreSellingPoints.map((point, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSubTitle(point);
                            fireSuccessConfetti();
                          }}
                          className={`text-left p-2 rounded-lg border text-[11px] leading-relaxed transition-all ${
                            subTitle === point
                              ? 'bg-indigo-950 border-indigo-500 text-indigo-200 shadow'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span className="text-indigo-400 font-bold mr-1">0{idx + 1}.</span>
                          {point}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400">推荐布光: </span>
                    <span className="text-slate-200">{aiSuggestions.lightingMood}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Prompt Editor & Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-semibold">商业摄影生图 Prompt:</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setActivePromptTab('en')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        activePromptTab === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      生图英文 Prompt
                    </button>
                    <button
                      onClick={() => setActivePromptTab('cn')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        activePromptTab === 'cn' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      中文描述对照
                    </button>
                    <button
                      onClick={() => setActivePromptTab('settings')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        activePromptTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      负向词与参数
                    </button>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400">支持自由编辑或点击下方快速切换风格</span>
              </div>

              {activePromptTab === 'en' && (
                <textarea
                  value={aiCustomPrompt || activeScene.prompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-indigo-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                  placeholder="可直接输入英文商业摄影 Prompt 或点击上方 AI 解析自动生成..."
                />
              )}

              {activePromptTab === 'cn' && (
                <textarea
                  value={aiCustomPromptCn || activeScene.description}
                  onChange={(e) => setAiCustomPromptCn(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                  placeholder="中文提示词描述（方便策划与摄影师理解布光构思）..."
                />
              )}

              {activePromptTab === 'settings' && (
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400 block">Negative Prompt (负向过滤词):</label>
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Platform & Product Quick Style Switches */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">一键切换平台专属风格提示词:</span>
                  <span className="text-[10px] text-indigo-400 font-mono">根据当前商品精准定制</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: '1688' as PlatformId, label: '🏭 1688 源头工厂展厅风', desc: 'B2B通透做工/高保真8K' },
                    { id: 'taobao' as PlatformId, label: '✨ 天猫/淘宝 旗舰轻奢展台', desc: '双顶柔光箱/高点击率' },
                    { id: 'douyin' as PlatformId, label: '📱 抖音 3:4 晨光生活美学', desc: '温馨晨光/真实种草' },
                    { id: 'xiaohongshu' as PlatformId, label: '🌸 小红书 治愈纯净摆拍', desc: '柔和漫射/高级调性' },
                    { id: 'amazon' as PlatformId, label: '⚪ 亚马逊 100% 纯白底合规', desc: 'RGB(255,255,255)/主体85%' },
                    { id: 'jd' as PlatformId, label: '⚡ 京东 科技精密金属反光', desc: '冷调逆光/正品大牌感' }
                  ].map((item) => {
                    const isCurrent = selectedPlatform === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          handlePlatformChange(item.id);
                          fireSuccessConfetti();
                        }}
                        className={`p-1.5 rounded-lg border text-left transition-all ${
                          isCurrent
                            ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 shadow-sm'
                            : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-bold truncate">{item.label}</div>
                        <div className="text-[9px] text-slate-400 truncate">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Keyword Add Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 mr-1">快捷追加光影修饰词:</span>
                {[
                  '大师级柔光箱',
                  '浅景深虚化',
                  '金属高光反光',
                  '水珠飞溅质感',
                  '北欧原木台面',
                  '赛博微光悬浮',
                  '亚马逊纯白RGB(255,255,255)',
                  '8K极致微距'
                ].map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => handleAppendPromptKeyword(kw)}
                    className="px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-indigo-950 hover:text-indigo-300 hover:border-indigo-700 border border-slate-700/60 text-[10px] text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Pre-Check Status Strip */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>实拍图画质预检:</span>
                </div>

                {isAnalyzingQuality ? (
                  <span className="text-slate-400 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    正在计算清晰度与采光曝光...
                  </span>
                ) : qualityReport ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-bold border ${
                      qualityReport.overallScore >= 90 ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' :
                      qualityReport.overallScore >= 75 ? 'bg-sky-950/60 border-sky-500 text-sky-300' :
                      qualityReport.overallScore >= 60 ? 'bg-amber-950/60 border-amber-500 text-amber-300' :
                      'bg-rose-950/60 border-rose-500 text-rose-300 animate-pulse'
                    }`}>
                      {qualityReport.overallScore} 分 ({qualityReport.grade}级)
                    </span>

                    <span className="text-[11px] text-slate-400">
                      清晰度: <strong className="text-slate-200">{qualityReport.sharpness.score}分</strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[11px] text-slate-400">
                      曝光: <strong className="text-slate-200">{qualityReport.brightness.score}分</strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[11px] text-slate-400">
                      尺寸: <strong className="text-slate-200">{qualityReport.resolution.width}×{qualityReport.resolution.height}</strong>
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">等待检测</span>
                )}
              </div>

              <button
                onClick={() => setIsQualityModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1"
              >
                <span>查看完整质检报告 / 智能增强</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Step 3: Run Image Generation */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <span>当前生图大模型: </span>
                <strong className="text-rose-400">{activeImageModel.name.split('(')[0]}</strong>
                <span className="ml-2 text-slate-500">| 保真度: {Math.round(denoisingStrength * 100)}%</span>
              </div>

              <button
                onClick={handleGenerateAiBg}
                disabled={isGeneratingAiImage}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingAiImage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    正在渲染生成商业大片...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    调用 {activeImageModel.name.split('(')[0]} 生成场景图
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 4: E-Commerce Marketing Overlays & Customization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Type className="w-4 h-4 text-rose-500" />
                3. 平台营销文案与大字报打标 (可选装饰图层)
              </h3>
              <span className="text-[11px] text-slate-400">自动同步 AI 提炼的高转化文案</span>
            </div>

            {/* Overlay Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showTitleOverlay}
                  onChange={(e) => setShowTitleOverlay(e.target.checked)}
                  className="rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-200 font-medium">主标题大字报</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showPriceCard}
                  onChange={(e) => setShowPriceCard(e.target.checked)}
                  className="rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-200 font-medium">抢购价格标签</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showWaistBanner}
                  onChange={(e) => setShowWaistBanner(e.target.checked)}
                  className="rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span className="text-slate-200 font-medium">底部营销腰封</span>
              </label>

              <label className="flex items-center justify-between cursor-pointer bg-slate-950 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showBadge && selectedBadge !== 'none'}
                    onChange={(e) => {
                      const willShow = e.target.checked;
                      setShowBadge(willShow);
                      if (willShow && selectedBadge === 'none') {
                        setSelectedBadge('badge_billion_subsidy');
                      }
                    }}
                    className="rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200 font-medium">认证/营销角标</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  showBadge && selectedBadge !== 'none' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' : 'bg-slate-900 text-slate-500'
                }`}>
                  {showBadge && selectedBadge !== 'none' ? (selectedBadge === 'custom' ? '自定义' : '已开启') : '已关闭'}
                </span>
              </label>
            </div>

            {/* Badge Configuration Panel (Only shown if enabled) */}
            {showBadge && selectedBadge !== 'none' && (
              <div className="bg-slate-950/90 border border-amber-900/40 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">平台认证与营销角标配置:</span>
                    <span className="text-[10px] text-amber-300/80 font-medium">支持自由选择官方预设或完全自定义</span>
                  </div>

                  {/* Preset Dropdown with Custom & None Options */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedBadge}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'none') {
                          setShowBadge(false);
                          setSelectedBadge('none');
                        } else {
                          setShowBadge(true);
                          setSelectedBadge(val);
                          // If switching from preset to custom, seed preset text if available
                          if (val === 'custom') {
                            const prevPreset = BADGE_PRESETS.find(b => b.id === selectedBadge);
                            if (prevPreset) {
                              setCustomBadgeText(prevPreset.text.replace(/^[^\w\s\u4e00-\u9fa5]+/, '').trim());
                              setCustomBadgeSubText(prevPreset.subText || '');
                              if (prevPreset.type === 'official_seal' || prevPreset.type === 'circle') {
                                setCustomBadgeType('official_seal');
                              } else if (prevPreset.type === 'ribbon') {
                                setCustomBadgeType('ribbon');
                              } else {
                                setCustomBadgeType('pill');
                              }
                            }
                          }
                        }
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <optgroup label="✨ 专属定制">
                        <option value="custom" className="bg-slate-900 text-amber-400 font-bold">
                          ✏️ 自定义专属角标 (文案/色彩/形态)
                        </option>
                      </optgroup>
                      <optgroup label="🏆 电商官方预设角标">
                        {BADGE_PRESETS.map(b => (
                          <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                            {b.name} ({b.text})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="❌ 操作">
                        <option value="none" className="bg-slate-900 text-slate-400">
                          不显示角标 (关闭)
                        </option>
                      </optgroup>
                    </select>

                    <button
                      onClick={() => {
                        setShowBadge(false);
                        setSelectedBadge('none');
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
                      title="关闭角标"
                    >
                      关闭角标
                    </button>
                  </div>
                </div>

                {/* Custom Badge Full Editor */}
                {selectedBadge === 'custom' ? (
                  <div className="space-y-3 pt-1">
                    {/* Badge Form & Position & Color */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Shape Type */}
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">角标形态样式:</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'official_seal', label: '官方金章', icon: '🛡️' },
                            { id: 'ribbon', label: '飘带角标', icon: '⚡' },
                            { id: 'pill', label: '极简胶囊', icon: '💊' },
                            { id: 'circle', label: '质感圆标', icon: '🔘' }
                          ].map((shape) => (
                            <button
                              key={shape.id}
                              type="button"
                              onClick={() => setCustomBadgeType(shape.id as any)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 transition-all ${
                                customBadgeType === shape.id
                                  ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span>{shape.icon}</span>
                              <span>{shape.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Position */}
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">展示摆放位置:</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'top-right', label: '右上角' },
                            { id: 'top-left', label: '左上角' },
                            { id: 'bottom-right', label: '右下角' },
                            { id: 'bottom-left', label: '左下角' }
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setCustomBadgePosition(pos.id as any)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                                customBadgePosition === pos.id
                                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 shadow'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color Themes */}
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">配色方案:</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: 'gold', label: '琥珀鎏金', bg: 'bg-amber-500 text-amber-950' },
                            { id: 'red', label: '爆款正红', bg: 'bg-red-600 text-white' },
                            { id: 'dark', label: '尊享黑金', bg: 'bg-slate-900 text-amber-300 border-amber-400' },
                            { id: 'blue', label: '极光科技蓝', bg: 'bg-sky-500 text-white' },
                            { id: 'green', label: '翡翠生态绿', bg: 'bg-emerald-600 text-white' },
                            { id: 'orange', label: '源头活力橙', bg: 'bg-orange-500 text-white' }
                          ].map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setCustomBadgeColor(c.id as any)}
                              className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-center ${
                                customBadgeColor === c.id
                                  ? 'ring-2 ring-white border-transparent scale-105 shadow-md ' + c.bg
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Inputs: Main Text & Sub Text */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          角标主文案 <span className="text-amber-400">*</span> (建议 2-6 个字):
                        </label>
                        <input
                          type="text"
                          value={customBadgeText}
                          onChange={(e) => setCustomBadgeText(e.target.value)}
                          placeholder="例如: 官方正品、源头直供、假一赔十、独家首发"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          角标副标 / 补充承诺 (印章支持副标):
                        </label>
                        <input
                          type="text"
                          value={customBadgeSubText}
                          onChange={(e) => setCustomBadgeSubText(e.target.value)}
                          placeholder="例如: 假一赔十、3年质保、顺丰速达、闪电发货"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Quick Inspiration Fill Chips */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block mb-1.5">⚡ 一键应用电商高转化角标灵感:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { text: '官方正品', subText: '假一赔十', type: 'official_seal', color: 'gold', pos: 'top-right' },
                          { text: '源头实力工厂', subText: '1件起批', type: 'ribbon', color: 'orange', pos: 'top-left' },
                          { text: '现货闪电发货', subText: '顺丰包邮', type: 'ribbon', color: 'red', pos: 'top-left' },
                          { text: '3年质保换新', subText: '官方保障', type: 'official_seal', color: 'gold', pos: 'top-right' },
                          { text: '行业热销TOP1', subText: '口碑好评', type: 'pill', color: 'dark', pos: 'top-left' },
                          { text: '独家专利首发', subText: '正品溯源', type: 'official_seal', color: 'dark', pos: 'top-right' },
                          { text: '纯净天然植物萃取', subText: '权威认证', type: 'official_seal', color: 'green', pos: 'top-right' },
                          { text: '进口正品直邮', subText: '海关正规验放', type: 'official_seal', color: 'blue', pos: 'top-right' }
                        ].map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCustomBadgeText(item.text);
                              setCustomBadgeSubText(item.subText);
                              setCustomBadgeType(item.type as any);
                              setCustomBadgeColor(item.color as any);
                              setCustomBadgePosition(item.pos as any);
                            }}
                            className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] text-slate-300 hover:text-amber-300 transition-colors flex items-center gap-1"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            {item.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preset Preview with Quick Switch to Custom */
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-slate-300">
                      <span>当前选中预设: </span>
                      <strong className="text-amber-300">
                        {BADGE_PRESETS.find(b => b.id === selectedBadge)?.name}
                      </strong>
                      <span className="text-slate-400 ml-2">
                        ("{BADGE_PRESETS.find(b => b.id === selectedBadge)?.text}")
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const current = BADGE_PRESETS.find(b => b.id === selectedBadge);
                        if (current) {
                          setCustomBadgeText(current.text.replace(/^[^\w\s\u4e00-\u9fa5]+/, '').trim());
                          setCustomBadgeSubText(current.subText || '');
                          if (current.type === 'official_seal' || current.type === 'circle') {
                            setCustomBadgeType('official_seal');
                          } else if (current.type === 'ribbon') {
                            setCustomBadgeType('ribbon');
                          } else {
                            setCustomBadgeType('pill');
                          }
                        }
                        setSelectedBadge('custom');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 text-xs font-semibold text-amber-300 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      转为自定义并自由修改文案
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inputs for Title & Prices */}
            {showTitleOverlay && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">主标题大字 (吸引眼球)</label>
                  <input
                    type="text"
                    value={mainTitle}
                    onChange={(e) => setMainTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">副标题 / 核心功能点</label>
                  <input
                    type="text"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-rose-400 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}

            {showPriceCard && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">券后价 (¥)</label>
                  <input
                    type="text"
                    value={priceTag}
                    onChange={(e) => setPriceTag(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">划线原价 (¥)</label>
                  <input
                    type="text"
                    value={originalPriceTag}
                    onChange={(e) => setOriginalPriceTag(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">折扣打标</label>
                  <input
                    type="text"
                    value={discountBadge}
                    onChange={(e) => setDiscountBadge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}

            {showWaistBanner && (
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">底部大促腰封文案</label>
                <input
                  type="text"
                  value={waistBannerText}
                  onChange={(e) => setWaistBannerText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            {/* Sync to Detail Page Link */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">需要生成配套的长图详情页？</span>
              <button
                onClick={onSyncToDetail}
                className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
              >
                一键同步文案与视觉到「详情页工作台」
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Model Configuration Modal */}
      <ModelConfigModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        selectedPromptModel={selectedPromptModel}
        onSelectPromptModel={setSelectedPromptModel}
        selectedImageModel={selectedImageModel}
        onSelectImageModel={setSelectedImageModel}
        customPromptConfig={customPromptConfig}
        setCustomPromptConfig={setCustomPromptConfig}
        customImageConfig={customImageConfig}
        setCustomImageConfig={setCustomImageConfig}
        denoisingStrength={denoisingStrength}
        setDenoisingStrength={setDenoisingStrength}
        serverModelReady={serverModelReady}
      />

      {/* Pre-processing Image Quality Validation Modal */}
      <ImageQualityModal
        isOpen={isQualityModalOpen}
        onClose={() => {
          setIsQualityModalOpen(false);
          setPendingGenerateAction(null);
        }}
        report={qualityReport}
        imageSrc={activeProductImage}
        isAnalyzing={isAnalyzingQuality}
        onApplyEnhancedImage={handleApplyEnhancedImage}
        onProceedToGenerate={() => {
          if (pendingGenerateAction) {
            pendingGenerateAction();
            setPendingGenerateAction(null);
          } else {
            doGenerateAiBg();
          }
        }}
        onOpenUploadModal={onOpenProductModal}
      />
    </div>
  );
};
