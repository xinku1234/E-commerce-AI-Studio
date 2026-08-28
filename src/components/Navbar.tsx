import React from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Layers, 
  Send, 
  Zap, 
  ShieldCheck, 
  PackageCheck
} from 'lucide-react';
import { ProductItem } from '../types';

interface NavbarProps {
  activeTab: 'hero' | 'detail' | 'batch' | 'publish';
  setActiveTab: (tab: 'hero' | 'detail' | 'batch' | 'publish') => void;
  currentProduct: ProductItem;
  onOpenProductModal: () => void;
  batchCount: number;
  modelReady?: boolean;
  onRequireModel?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentProduct,
  onOpenProductModal,
  batchCount
  , modelReady = true
  , onRequireModel
}) => {
  const tabs = [
    { id: 'hero' as const, label: '主图', icon: ImageIcon },
    { id: 'detail' as const, label: '详情', icon: Layers },
    { id: 'batch' as const, label: '批量', icon: Zap },
    { id: 'publish' as const, label: '发布', icon: Send }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent whitespace-nowrap">
                智绘电商 · AI视觉中台
              </span>
              <span className="hidden lg:inline text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                多渠道矩阵版
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400 font-normal">
              智能主图 · 详情页长图 · 平台定制 · 批量分发
            </p>
          </div>
        </div>

        {/* Center: Main Workflow Switcher */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            id="nav-hero-tab"
            onClick={() => modelReady ? setActiveTab('hero') : onRequireModel?.()}
            disabled={!modelReady}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'hero'
                ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>智能主图工坊</span>
          </button>

          <button
            id="nav-detail-tab"
            onClick={() => modelReady ? setActiveTab('detail') : onRequireModel?.()}
            disabled={!modelReady}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'detail'
                ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>详情页长图工坊</span>
          </button>

          <button
            id="nav-batch-tab"
            onClick={() => modelReady ? setActiveTab('batch') : onRequireModel?.()}
            disabled={!modelReady}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
              activeTab === 'batch'
                ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>批量矩阵生成</span>
            {batchCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {batchCount}
              </span>
            )}
          </button>

          <button
            id="nav-publish-tab"
            onClick={() => modelReady ? setActiveTab('publish') : onRequireModel?.()}
            disabled={!modelReady}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'publish'
                ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>一键多渠道分发</span>
          </button>
        </nav>

        {/* Right: Active Product Switcher */}
        <div className="flex items-center gap-2">
          <button
            id="active-product-btn"
            onClick={onOpenProductModal}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs transition-colors group text-left"
            title="点击切换当前编辑商品或上传新商品"
          >
            <img
              src={currentProduct.imageUrl}
              alt={currentProduct.name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-md object-cover border border-slate-600"
            />
            <div className="hidden lg:block max-w-[130px] truncate">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                当前商品
              </div>
              <div className="font-medium text-slate-200 truncate">{currentProduct.name}</div>
            </div>
            <PackageCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>合规引擎就绪</span>
          </div>
        </div>
      </div>

      <nav className="md:hidden grid grid-cols-4 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={`切换到${label}工作区`}
            onClick={() => setActiveTab(id)}
            className={`h-12 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              activeTab === id ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="relative">
              <Icon className="w-4 h-4" />
              {id === 'batch' && batchCount > 0 && (
                <span className="absolute -right-2 -top-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-amber-500 text-slate-950 text-[8px] font-bold flex items-center justify-center">
                  {Math.min(batchCount, 99)}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};
