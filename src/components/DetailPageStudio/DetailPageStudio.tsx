import React, { useState, useRef } from 'react';
import { 
  Layers, 
  Sparkles, 
  Download, 
  Smartphone, 
  Monitor, 
  MoveUp, 
  MoveDown, 
  CheckCircle, 
  ShieldCheck, 
  Cpu, 
  Scissors, 
  Palette, 
  Trash2,
  Image as ImageIcon,
  Check,
  Eye
} from 'lucide-react';
import { ProductItem, DetailPageModule } from '../../types';
import { DEFAULT_DETAIL_MODULES } from '../../data/presets';
import { packageAndDownloadZip, fireSuccessConfetti } from '../../utils/exportUtils';
import { safeFetchJson } from '../../utils/apiUtils';
import { renderFullDetailPageLongImage } from '../../utils/detailPageRenderer';

interface DetailPageStudioProps {
  currentProduct: ProductItem;
  onNavigateToPublish: () => void;
}

export const DetailPageStudio: React.FC<DetailPageStudioProps> = ({
  currentProduct,
  onNavigateToPublish
}) => {
  const [modules, setModules] = useState<DetailPageModule[]>(DEFAULT_DETAIL_MODULES);
  const [activeModuleId, setActiveModuleId] = useState<string>(DEFAULT_DETAIL_MODULES[0].id);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [pageTheme, setPageTheme] = useState<'luxury-dark' | 'clean-light' | 'tech-mesh' | 'warm-lifestyle'>('luxury-dark');
  const [longImagePreviewUrl, setLongImagePreviewUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Active module
  const activeModule = modules.find(m => m.id === activeModuleId) || modules[0];

  // AI Generation of entire detail page
  const handleAiRegenerateDetailPage = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await safeFetchJson('/api/generate-detail-page-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: currentProduct.name,
          category: currentProduct.category,
          sellingPoints: currentProduct.sellingPoints,
          customSpecs: currentProduct.specs
        })
      }, 25000);

      const data = res.data;
      if (data && data.success && data.modules?.length) {
        setModules(data.modules.map((m: any, idx: number) => ({
          ...m,
          id: m.id || `mod_${idx}_${Date.now()}`,
          enabled: true
        })));
        setActiveModuleId(data.modules[0].id || 'mod_hero');
        fireSuccessConfetti();
      }
    } catch (e) {
      console.error('Failed to generate detail page:', e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleToggleModule = (id: string) => {
    setModules(modules.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const handleMoveModule = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= modules.length) return;
    const newModules = [...modules];
    const temp = newModules[index];
    newModules[index] = newModules[newIdx];
    newModules[newIdx] = temp;
    setModules(newModules);
  };

  const handleDeleteModule = (id: string) => {
    if (modules.length <= 1) return;
    const filtered = modules.filter(m => m.id !== id);
    setModules(filtered);
    setActiveModuleId(filtered[0].id);
  };

  const handleUpdateActiveModule = (updatedFields: Partial<DetailPageModule>) => {
    setModules(modules.map(m => m.id === activeModuleId ? { ...m, ...updatedFields } : m));
  };

  // 1. Export High-Res 750px Single Long Detail Image (PNG)
  const handleExportFullLongImage = async () => {
    setIsExporting(true);
    try {
      const renderResult = await renderFullDetailPageLongImage(currentProduct, modules, pageTheme);
      const link = document.createElement('a');
      link.download = `${currentProduct.name}_750px电商高清详情页长图.png`;
      link.href = renderResult.fullLongImageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      fireSuccessConfetti();
    } catch (e) {
      console.error('Failed to export long image:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export Standard Slices ZIP (All slices rendered as 750px PNG + manifest JSON)
  const handleExportSlices = async () => {
    setIsExporting(true);
    try {
      const renderResult = await renderFullDetailPageLongImage(currentProduct, modules, pageTheme);
      const files: { name: string; folder: string; dataUrl?: string; textContent?: string }[] = [];

      // Add each slice image
      for (const slice of renderResult.slices) {
        files.push({
          name: slice.filename,
          folder: '详情页物料包/高清切片图',
          dataUrl: slice.dataUrl
        });
      }

      // Add full long image
      files.push({
        name: '00_完整750px高清长图.png',
        folder: '详情页物料包',
        dataUrl: renderResult.fullLongImageDataUrl
      });

      // Add manifest JSON
      const manifestText = JSON.stringify({
        productName: currentProduct.name,
        category: currentProduct.category,
        price: currentProduct.price,
        theme: pageTheme,
        generatedAt: new Date().toISOString(),
        modulesCount: modules.filter(m => m.enabled).length,
        modules: modules.filter(m => m.enabled)
      }, null, 2);

      files.push({
        name: 'detail_page_config.json',
        folder: '详情页物料包',
        textContent: manifestText
      });

      await packageAndDownloadZip(files as any, `${currentProduct.name}_电商全套详情页切片物料包.zip`);
    } catch (e) {
      console.error('Failed to export slices:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Preview full long image
  const handlePreviewFullLongImage = async () => {
    setIsExporting(true);
    try {
      const renderResult = await renderFullDetailPageLongImage(currentProduct, modules, pageTheme);
      setLongImagePreviewUrl(renderResult.fullLongImageDataUrl);
    } catch (e) {
      console.error('Failed to preview long image:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Action & AI Generation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 flex items-center justify-center text-white shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              智能详情页长图工坊
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                750px 标准高清切片
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              当前商品：<strong className="text-slate-200">{currentProduct.name}</strong> (已加载 {modules.length} 个核心营销模块)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI One Click Regeneration */}
          <button
            id="btn-ai-detail-gen"
            onClick={handleAiRegenerateDetailPage}
            disabled={isGeneratingAi}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isGeneratingAi ? 'Gemini 正在策划长图...' : 'AI 一键生成完整详情页'}
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                viewMode === 'mobile'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              手机端 750px
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                viewMode === 'desktop'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              宽屏展开
            </button>
          </div>

          {/* Preview Canvas Button */}
          <button
            onClick={handlePreviewFullLongImage}
            disabled={isExporting}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            预览长图
          </button>

          {/* Export Full Long Image */}
          <button
            id="btn-export-full-long-image"
            onClick={handleExportFullLongImage}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '正在渲染长图...' : '下载完整长图 (PNG)'}
          </button>

          {/* Export Slices ZIP */}
          <button
            id="btn-export-detail-slices"
            onClick={handleExportSlices}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            导出切片物料包 (ZIP)
          </button>
        </div>
      </div>

      {/* Main Grid: Left Modules List, Center Preview, Right Module Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Module Manager (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Theme Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              视觉风格主题
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'luxury-dark', label: '黑金旗舰', bg: 'from-slate-900 to-slate-950' },
                { id: 'clean-light', label: '极简白透', bg: 'from-slate-100 to-slate-200 text-slate-900' },
                { id: 'tech-mesh', label: '硬核科技', bg: 'from-indigo-950 to-slate-950' },
                { id: 'warm-lifestyle', label: '暖阳生活', bg: 'from-amber-100 to-orange-100 text-slate-900' }
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => setPageTheme(th.id as any)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                    pageTheme === th.id
                      ? 'border-rose-500 bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/50'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-500" />
                模块编排 ({modules.length})
              </span>
            </div>

            {/* Modules List */}
            <div className="space-y-2">
              {modules.map((mod, index) => {
                const isSelected = activeModuleId === mod.id;
                return (
                  <div
                    key={mod.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/50'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                    }`}
                  >
                    <div
                      onClick={() => setActiveModuleId(mod.id)}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {mod.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {mod.type === 'hero' ? '首屏核心主张' : 
                         mod.type === 'comparison' ? '痛点与革新对比' :
                         mod.type === 'features' ? '4重黑科技拆解' :
                         mod.type === 'scenarios' ? '使用场景应用' :
                         mod.type === 'specs' ? '规格参数表' : '售后与品牌保证'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveModule(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <MoveUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveModule(index, 'down')}
                        disabled={index === modules.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <MoveDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleToggleModule(mod.id)}
                        className={`p-1 rounded text-xs ${
                          mod.enabled ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                        title={mod.enabled ? '已启用' : '已隐藏'}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Column: Live Long Detail Canvas (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div
            className={`w-full ${
              viewMode === 'mobile'
                ? 'max-w-[400px] border-[10px] border-slate-800 rounded-[40px] shadow-2xl bg-slate-950 overflow-hidden'
                : 'max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl'
            }`}
          >
            {/* Phone Top Notch */}
            {viewMode === 'mobile' && (
              <div className="bg-slate-900 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>09:41</span>
                <div className="w-16 h-3.5 bg-slate-950 rounded-full mx-auto"></div>
                <span>5G 100%</span>
              </div>
            )}

            {/* Scrollable Detail Modules Canvas */}
            <div
              ref={containerRef}
              className={`max-h-[660px] overflow-y-auto space-y-4 p-3.5 divide-y divide-slate-800/80 ${
                pageTheme === 'clean-light' ? 'bg-slate-100' : 
                pageTheme === 'warm-lifestyle' ? 'bg-amber-50' : 'bg-slate-950'
              }`}
            >
              {modules
                .filter(m => m.enabled)
                .map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setActiveModuleId(m.id)}
                    className={`pt-3.5 cursor-pointer rounded-xl transition-all ${
                      activeModuleId === m.id
                        ? 'ring-2 ring-rose-500/80 p-2 bg-slate-900/60'
                        : 'hover:bg-slate-900/30'
                    }`}
                  >
                    {/* Render Module: Hero */}
                    {m.type === 'hero' && (
                      <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl p-4 border border-slate-800 text-center space-y-3 relative overflow-hidden">
                        <span className="inline-block text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                          {m.tag || '2026 年度旗舰首发'}
                        </span>
                        <h3 className="text-base font-extrabold text-white leading-tight">
                          {m.title}
                        </h3>
                        <p className="text-xs text-slate-400">{m.subtitle}</p>
                        <div className="relative py-2">
                          <img
                            src={currentProduct.imageUrl}
                            alt={currentProduct.name}
                            referrerPolicy="no-referrer"
                            className="w-48 h-48 object-contain mx-auto drop-shadow-2xl"
                          />
                        </div>
                        <div className="text-[11px] text-amber-300 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                          ✦ {m.content.highlight || '精工品质保障 · 官方正品首发'}
                        </div>
                      </div>
                    )}

                    {/* Render Module: Comparison */}
                    {m.type === 'comparison' && (
                      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-white">{m.title}</h4>
                          <p className="text-[11px] text-slate-400">{m.subtitle}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 space-y-1.5">
                            <div className="font-bold text-[11px] text-red-400 flex items-center gap-1">
                              ✕ 普通传统产品
                            </div>
                            {m.content.traditional?.map((item, i) => (
                              <div key={i} className="text-[10px] text-slate-400 leading-snug">
                                • {item}
                              </div>
                            ))}
                          </div>
                          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-1.5 shadow-sm">
                            <div className="font-bold text-[11px] text-emerald-400 flex items-center gap-1">
                              ✓ 极简智造旗舰
                            </div>
                            {m.content.ours?.map((item, i) => (
                              <div key={i} className="text-[10px] text-slate-200 leading-snug font-medium">
                                • {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Render Module: Features */}
                    {m.type === 'features' && (
                      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                            <Cpu className="w-4 h-4 text-cyan-400" />
                            {m.title}
                          </h4>
                          <p className="text-[11px] text-slate-400">{m.subtitle}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {m.content.featuresList?.map((feat, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1"
                            >
                              <div className="text-xs font-bold text-cyan-300">{feat.name}</div>
                              <div className="text-[10px] text-slate-400 leading-tight">
                                {feat.desc}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render Module: Scenarios */}
                    {m.type === 'scenarios' && (
                      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-white">{m.title}</h4>
                          <p className="text-[11px] text-slate-400">{m.subtitle}</p>
                        </div>
                        <div className="space-y-2">
                          {m.content.scenes?.map((scene, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg bg-gradient-to-r from-amber-950/20 to-slate-900 border border-amber-900/30 flex items-start gap-2"
                            >
                              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                0{i + 1}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-amber-200">{scene.title}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{scene.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render Module: Specs */}
                    {m.type === 'specs' && (
                      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-3">
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-white">{m.title}</h4>
                          <p className="text-[11px] text-slate-400">{m.subtitle}</p>
                        </div>
                        <div className="border border-slate-800 rounded-lg overflow-hidden text-xs">
                          {m.content.specsList?.map((spec, i) => (
                            <div
                              key={i}
                              className={`flex justify-between p-2 text-[11px] ${
                                i % 2 === 0 ? 'bg-slate-950/60' : 'bg-slate-900/40'
                              }`}
                            >
                              <span className="text-slate-400 font-medium">{spec.key}</span>
                              <span className="text-slate-200 font-semibold text-right">{spec.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render Module: Guarantee */}
                    {m.type === 'guarantee' && (
                      <div className="bg-gradient-to-b from-slate-900 to-red-950/30 rounded-xl p-4 border border-red-900/30 space-y-3">
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-rose-500" />
                            {m.title}
                          </h4>
                          <p className="text-[11px] text-slate-400">{m.subtitle}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {m.content.badges?.map((bg, i) => (
                            <div
                              key={i}
                              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-center"
                            >
                              <div className="text-xs font-bold text-white">{bg.label}</div>
                              <div className="text-[10px] text-rose-400 mt-0.5">{bg.sub}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Column: In-Place Module Content Editor (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                正在编辑模块：{activeModule.title}
              </h3>
              <button
                onClick={() => handleDeleteModule(activeModule.id)}
                className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-0.5"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">模块主标题</label>
                <input
                  type="text"
                  value={activeModule.title}
                  onChange={(e) => handleUpdateActiveModule({ title: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">模块副标题/说服文案</label>
                <input
                  type="text"
                  value={activeModule.subtitle}
                  onChange={(e) => handleUpdateActiveModule({ subtitle: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                />
              </div>

              {activeModule.type === 'hero' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">旗舰标语/亮点</label>
                  <input
                    type="text"
                    value={activeModule.content.highlight || ''}
                    onChange={(e) => handleUpdateActiveModule({
                      content: { ...activeModule.content, highlight: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-amber-300 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={onNavigateToPublish}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                前往多渠道一键发布中心 →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Long Image Preview Modal */}
      {longImagePreviewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rose-500" />
                750px 高清详情页长图预览
              </h3>
              <button
                onClick={() => setLongImagePreviewUrl(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-lg"
              >
                关闭
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-950 flex justify-center">
              <img
                src={longImagePreviewUrl}
                alt="详情页长图预览"
                className="max-w-[375px] w-full rounded shadow-xl object-contain border border-slate-800"
              />
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `${currentProduct.name}_750px电商高清详情页长图.png`;
                  link.href = longImagePreviewUrl;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setLongImagePreviewUrl(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                立即保存高清长图
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
