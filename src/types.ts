export type PlatformId = 'taobao' | 'jd' | 'pinduoduo' | '1688' | 'douyin' | 'xiaohongshu' | 'amazon' | 'shopify';

export type AspectRatioType = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export type HeroSuiteSlot = 'slot_1_ctr' | 'slot_2_detail' | 'slot_3_dimension' | 'slot_4_scene' | 'slot_5_whitebg';

export interface HeroSuiteItem {
  id: string;
  slot: HeroSuiteSlot;
  slotIndex: number; // 1 to 5
  slotTitle: string;
  slotShortName: string;
  slotPurpose: string;
  prompt: string;
  promptCn?: string;
  imageUrl?: string;
  badgeText?: string;
  headline?: string;
  subheadline?: string;
  specsHighlight?: string;
  dimensionsOverlay?: {
    width?: string;
    height?: string;
    depth?: string;
    unit?: string;
    label?: string;
  };
  isGenerated: boolean;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  customStyleName?: string;
}

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  enName: string;
  icon: string;
  primaryRatio: AspectRatioType;
  supportedRatios: AspectRatioType[];
  recommendedSize: string;
  tagline: string;
  themeColor: string;
  bgAccent: string;
  rules: {
    maxTextRatio: number; // e.g. 0.2 for 20%
    requiresPureWhiteBgFirst: boolean;
    bannerStyle: 'bold_promo' | 'minimal_luxury' | 'high_contrast' | 'live_stream' | 'lifestyle' | 'pure_spec';
    complianceNotes: string[];
  };
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: string;
  originalPrice?: string;
  discountTag?: string;
  imageUrl: string;
  images?: string[]; // Multiple real photos / multi-angle product shots
  cutoutImageUrl?: string;
  sellingPoints: string[];
  heroTitles: string[];
  badges: string[];
  painPoints?: string[];
  specs?: { key: string; value: string }[];
  targetAudience?: string;
}

export interface SceneStyle {
  id: string;
  name: string;
  category: string;
  prompt: string;
  previewBg: string;
  lightingType: string;
  description: string;
  suitableCategories: string[];
}

export interface BadgeTemplate {
  id: string;
  name: string;
  type: 'ribbon' | 'circle' | 'pill' | 'waist_band' | 'official_seal';
  text: string;
  subText?: string;
  color: string;
  textColor: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-bar' | 'top-bar';
}

export interface DetailPageModule {
  id: string;
  type: 'hero' | 'comparison' | 'features' | 'scenarios' | 'specs' | 'guarantee' | 'custom';
  title: string;
  subtitle: string;
  tag?: string;
  accentColor: string;
  bgStyle: 'luxury-dark' | 'clean-light' | 'tech-mesh' | 'warm-lifestyle' | 'vibrant-red';
  content: {
    highlight?: string;
    bulletPoints?: string[];
    traditional?: string[];
    ours?: string[];
    featuresList?: { name: string; desc: string; icon?: string }[];
    scenes?: { title: string; desc: string; imageHint?: string }[];
    specsList?: { key: string; value: string }[];
    badges?: { label: string; sub: string }[];
    customHtmlOrText?: string;
  };
  enabled: boolean;
}

export interface BatchTask {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  platform: PlatformId;
  aspectRatio: AspectRatioType;
  styleId: string;
  badgeId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultImageUrl?: string;
  progress: number;
  createdAt: string;
  complianceScore: number;
}

export interface ChannelStore {
  id: PlatformId;
  name: string;
  storeName: string;
  connected: boolean;
  status: 'active' | 'syncing' | 'error';
  lastSyncTime?: string;
  productCount: number;
  salesVolume: string;
  authExpiry: string;
}

export interface PromptModelOption {
  id: string;
  name: string;
  provider: string;
  tag: string;
  description: string;
  supportsVision: boolean;
  isCustom?: boolean;
}

export interface ImageModelOption {
  id: string;
  name: string;
  provider: string;
  tag: string;
  description: string;
  supportsImg2Img: boolean;
  isCustom?: boolean;
}

export interface AiVisualAnalysisResult {
  productIdentified: string;
  materialsDetected: string[];
  lightingMood: string;
  compositionTip: string;
  visualPrompt: string;
  visualPromptCn: string;
  negativePrompt: string;
  coreSellingPoints: string[];
  heroTitles: string[];
  badges: string[];
  painPoints: string[];
  platformOptimizations: {
    platform: string;
    aspectRatio: string;
    colorScheme: string;
    visualTip: string;
    complianceNote: string;
  };
  targetAudience: string;
}

export interface CustomEndpointConfig {
  endpointUrl: string;
  apiKey: string;
  selectedModel: string;
  manualModel: string;
  useManual: boolean;
  fetchedModels: string[];
  lastTestedAt?: string;
  latencyMs?: number;
  testStatus?: 'idle' | 'testing' | 'success' | 'failed';
  testMessage?: string;
}

export interface ImageQualityReport {
  overallScore: number; // 0 - 100
  grade: 'S' | 'A' | 'B' | 'C';
  gradeText: string;
  isReadyForAI: boolean;
  sharpness: {
    score: number; // 0 - 100
    variance: number;
    status: 'pass' | 'warn' | 'fail';
    description: string;
  };
  brightness: {
    score: number; // 0 - 100
    meanLuminance: number; // 0 - 255
    contrastRatio: number;
    status: 'pass' | 'warn' | 'fail';
    description: string;
  };
  resolution: {
    score: number; // 0 - 100
    width: number;
    height: number;
    megapixels: number;
    aspectRatioText: string;
    status: 'pass' | 'warn' | 'fail';
    description: string;
  };
  recommendations: string[];
  analyzedAt: string;
}

export interface PublishRecord {
  id: string;
  batchId: string;
  productName: string;
  channels: PlatformId[];
  heroImagesCount: number;
  detailPagesCount: number;
  publishedAt: string;
  status: 'success' | 'draft' | 'pending';
  complianceReport: {
    passed: boolean;
    issues: string[];
  };
}

