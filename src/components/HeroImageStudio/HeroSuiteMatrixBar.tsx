import React from 'react';
import { 
  Sparkles, 
  Layers, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Zap, 
  Image as ImageIcon,
  Flame,
  ArrowRight,
  Eye,
  Sliders,
  Check
} from 'lucide-react';
import { HeroSuiteItem, PlatformId } from '../../types';

interface HeroSuiteMatrixBarProps {
  suiteItems: HeroSuiteItem[];
  activeSlotId: string;
  onSelectSlot: (slot: HeroSuiteItem) => void;
  onGenerateAll: () => void;
  onExportZip: () => void;
  onAddAllToBatch: () => void;
  isGenerating: boolean;
  activeImageModelName: string;
  selectedPlatform: PlatformId;
  generatingSlotIndex?: number;
}

export const HeroSuiteMatrixBar: React.FC<HeroSuiteMatrixBarProps> = ({
  suiteItems,
  activeSlotId,
  onSelectSlot,
  onGenerateAll,
  onExportZip,
  onAddAllToBatch,
  isGenerating,
  activeImageModelName,
  selectedPlatform,
  generatingSlotIndex
}) => {
  const is1688 = selectedPlatform === '1688';
  const completedCount = suiteItems.filter(s => s.isGenerated || s.imageUrl).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 shadow-inner">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                电商标准 5 张主图矩阵套图
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                is1688 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' 
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}>
                {is1688 ? '🏭 1688 工厂批发专享' : '⚡ 行业爆款标准'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                ({completedCount}/5 张已就绪)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              第1张搞点击率 · 第2张细节质感 · 第3张尺寸标线 · 第4张真实场景 · 第5张合规纯白底
            </p>
          </div>
        </div>

        {/* Global 5-Suite Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={onGenerateAll}
            disabled={isGenerating}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
              is1688
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-950/40'
                : 'bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white shadow-rose-950/40'
            } disabled:opacity-50`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>套图生成中... ({generatingSlotIndex || 1}/5)</span>
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 text-yellow-300" />
                <span>⚡ 一键生成全套 5 张主图</span>
              </>
            )}
          </button>

          <button
            onClick={onExportZip}
            disabled={completedCount === 0 || isGenerating}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
            title="将当前5张主图打包导出为ZIP"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>打包导出 (ZIP)</span>
          </button>

          <button
            onClick={onAddAllToBatch}
            disabled={completedCount === 0 || isGenerating}
            className="px-3.5 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 disabled:opacity-40 text-indigo-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            title="将这5张图片推送到批量发布矩阵"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>加入全渠道发布</span>
          </button>
        </div>
      </div>

      {/* 5-Card Deck Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {suiteItems.map((item, index) => {
          const isActive = item.slot === activeSlotId;
          const isSlotGenerating = isGenerating && generatingSlotIndex === item.slotIndex;
          
          return (
            <div
              key={item.slot}
              onClick={() => onSelectSlot(item)}
              className={`group relative rounded-xl border p-3 cursor-pointer transition-all flex flex-col justify-between overflow-hidden ${
                isActive
                  ? is1688
                    ? 'bg-orange-950/40 border-orange-500 shadow-lg shadow-orange-950/50 ring-2 ring-orange-500/50'
                    : 'bg-slate-800/90 border-rose-500 shadow-lg shadow-rose-950/50 ring-2 ring-rose-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isActive
                    ? is1688 ? 'bg-orange-500 text-white' : 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  #{item.slotIndex} {item.slotShortName}
                </span>

                {item.isGenerated || item.imageUrl ? (
                  <span className={`flex items-center gap-1 text-[10px] font-medium ${
                    item.qualityStatus === 'warning' ? 'text-amber-400' :
                    item.qualityStatus === 'fallback' ? 'text-sky-400' : 'text-emerald-400'
                  }`} title={item.qualityIssues?.join('；')}>
                    <CheckCircle2 className="w-3 h-3" />
                    {item.qualityScore != null ? `${item.qualityScore}分` : '已就绪'}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">
                    待生成
                  </span>
                )}
              </div>

              {/* Card Thumbnail Preview */}
              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center my-1 group-hover:border-slate-600 transition-colors">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.slotTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-slate-500">
                    <ImageIcon className="w-6 h-6 mb-1 text-slate-600" />
                    <span className="text-[10px] font-medium leading-tight">
                      {item.slotShortName}
                    </span>
                  </div>
                )}

                {/* Overlaid Role Pill */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <div className="bg-slate-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-300 truncate text-center border border-slate-800">
                    {item.customStyleName}
                  </div>
                </div>

                {/* Loading Spinner */}
                {isSlotGenerating && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-2 text-center">
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-1" />
                    <span className="text-[10px] text-rose-400 font-bold">Nano生图中...</span>
                  </div>
                )}
              </div>

              {/* Card Footer Purpose */}
              <div className="mt-2">
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed" title={item.slotPurpose}>
                  {item.slotPurpose}
                </p>

                {item.sourceMode && (
                  <div className={`mt-1 text-[9px] font-medium ${item.sourceMode === 'ai' ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {item.sourceMode === 'ai' ? 'AI 生成' : '本地合成回退'}
                    {item.qualityStatus === 'warning' ? ' · 建议复核' : ''}
                    {item.retryCount ? ` · 重试 ${item.retryCount} 次` : ''}
                  </div>
                )}
                
                {isActive && (
                  <div className={`mt-1.5 text-[10px] font-bold flex items-center gap-1 ${
                    is1688 ? 'text-orange-400' : 'text-rose-400'
                  }`}>
                    <span>当前编辑槽位</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
