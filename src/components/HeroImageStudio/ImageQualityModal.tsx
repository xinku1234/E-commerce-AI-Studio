import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Wand2, 
  RefreshCw, 
  X, 
  Maximize2, 
  Sun, 
  Focus, 
  Layers, 
  ArrowRight,
  Info
} from 'lucide-react';
import { ImageQualityReport } from '../../types';
import { enhanceImageQuality } from '../../utils/imageQuality';

interface ImageQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ImageQualityReport | null;
  imageSrc: string;
  isAnalyzing: boolean;
  onApplyEnhancedImage?: (enhancedBase64: string) => void;
  onProceedToGenerate?: () => void;
  onReAnalyze?: () => void;
  onOpenUploadModal?: () => void;
}

export const ImageQualityModal: React.FC<ImageQualityModalProps> = ({
  isOpen,
  onClose,
  report,
  imageSrc,
  isAnalyzing,
  onApplyEnhancedImage,
  onProceedToGenerate,
  onReAnalyze,
  onOpenUploadModal
}) => {
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison'>('overview');

  if (!isOpen) return null;

  const handleEnhance = async () => {
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceImageQuality(imageSrc, {
        brightenPercent: 8,
        contrastBoost: 1.15,
        sharpenLevel: 0.6
      });
      setEnhancedPreview(enhanced);
      setActiveTab('comparison');
    } catch (err) {
      console.error('Enhancement error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyEnhanced = () => {
    if (enhancedPreview && onApplyEnhancedImage) {
      onApplyEnhancedImage(enhancedPreview);
      setEnhancedPreview(null);
      onClose();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500 bg-emerald-950/60';
    if (score >= 75) return 'text-sky-400 border-sky-500 bg-sky-950/60';
    if (score >= 60) return 'text-amber-400 border-amber-500 bg-amber-950/60';
    return 'text-rose-400 border-rose-500 bg-rose-950/60';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 90) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (score >= 75) return 'bg-gradient-to-r from-sky-500 to-blue-400';
    if (score >= 60) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-rose-600 to-rose-400';
  };

  const getStatusIcon = (status: 'pass' | 'warn' | 'fail') => {
    if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
    return <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">实拍图画质预检与质检诊断</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  Pre-AI Quality Check
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                实时分析实拍原图的清晰度、曝光采光与分辨率，确保 AI 生图获得最佳商业质感
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isAnalyzing ? (
            <div className="py-16 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-200">正在分析实拍像素与多维度画质指标...</div>
              <p className="text-xs text-slate-400">计算拉普拉斯清晰度方差、光度直方图分布与电商分辨率契合度</p>
            </div>
          ) : report ? (
            <>
              {/* Top Banner: Overall Score & Photo Preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {/* Image Snapshot */}
                <div className="md:col-span-4 flex flex-col items-center">
                  <div className="relative group w-full aspect-square rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-md flex items-center justify-center">
                    <img 
                      src={enhancedPreview || imageSrc} 
                      alt="Analyzed Product" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[10px] font-mono text-slate-300 border border-slate-700">
                      {enhancedPreview ? '✨ 智能增强效果' : '原始实拍图'}
                    </div>
                  </div>
                  {enhancedPreview && (
                    <button
                      onClick={() => setEnhancedPreview(null)}
                      className="mt-2 text-[11px] text-slate-400 hover:text-slate-200 underline"
                    >
                      查看原始实拍图
                    </button>
                  )}
                </div>

                {/* Score & Verdict */}
                <div className="md:col-span-8 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">综合实拍质检评分</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={`text-4xl font-extrabold font-mono ${
                          report.overallScore >= 90 ? 'text-emerald-400' :
                          report.overallScore >= 75 ? 'text-sky-400' :
                          report.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {report.overallScore}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">/ 100 分</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ml-2 ${getScoreColor(report.overallScore)}`}>
                          等级: {report.grade} ({report.gradeText})
                        </span>
                      </div>
                    </div>

                    {/* AI Readiness status */}
                    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                      report.isReadyForAI 
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300' 
                        : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                    }`}>
                      {report.isReadyForAI ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      <span className="text-xs font-semibold">
                        {report.isReadyForAI ? '实拍画质达标 · 契合AI生图' : '画质偏低 · 建议先优化'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${getProgressBarColor(report.overallScore)}`}
                      style={{ width: `${report.overallScore}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    💡 <strong className="text-white">AI 分析结论：</strong>
                    {report.overallScore >= 80 
                      ? '当前实拍光影均匀、主体轮廓锐利，多模态引擎在生成高点击率主图或场景融合时，能高保真还原商品反光与质地。' 
                      : '实拍图在清晰度或采光维度仍有提升空间。建议点击下方“一键智能画质增强”或直接上传更高清棚拍原图。'}
                  </p>
                </div>
              </div>

              {/* 3 Detailed Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                
                {/* 1. Sharpness */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Focus className="w-4 h-4 text-indigo-400" />
                      <span>主体清晰度 (Sharpness)</span>
                    </div>
                    {getStatusIcon(report.sharpness.status)}
                  </div>
                  
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">{report.sharpness.score} <span className="text-xs text-slate-400">分</span></span>
                    <span className="text-[10px] font-mono text-slate-400">方差: {report.sharpness.variance}</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getProgressBarColor(report.sharpness.score)}`} 
                      style={{ width: `${report.sharpness.score}%` }} 
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {report.sharpness.description}
                  </p>
                </div>

                {/* 2. Brightness */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Sun className="w-4 h-4 text-amber-400" />
                      <span>采光与曝光 (Exposure)</span>
                    </div>
                    {getStatusIcon(report.brightness.status)}
                  </div>
                  
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">{report.brightness.score} <span className="text-xs text-slate-400">分</span></span>
                    <span className="text-[10px] font-mono text-slate-400">亮度: {report.brightness.meanLuminance}</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getProgressBarColor(report.brightness.score)}`} 
                      style={{ width: `${report.brightness.score}%` }} 
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {report.brightness.description}
                  </p>
                </div>

                {/* 3. Resolution */}
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Maximize2 className="w-4 h-4 text-emerald-400" />
                      <span>尺寸与分辨率 (Resolution)</span>
                    </div>
                    {getStatusIcon(report.resolution.status)}
                  </div>
                  
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">{report.resolution.score} <span className="text-xs text-slate-400">分</span></span>
                    <span className="text-[10px] font-mono text-slate-400">{report.resolution.megapixels} MP</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getProgressBarColor(report.resolution.score)}`} 
                      style={{ width: `${report.resolution.score}%` }} 
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {report.resolution.width}×{report.resolution.height} · {report.resolution.description}
                  </p>
                </div>

              </div>

              {/* Recommendations & Actionable Checklist */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>电商实拍优化诊断清单:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  {report.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-start gap-2">
                      <span className="text-slate-400 flex-shrink-0">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">暂无质检报告数据</div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Auto Enhance Button */}
            <button
              onClick={handleEnhance}
              disabled={isEnhancing || isAnalyzing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isEnhancing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>智能画质与对比度增强</span>
            </button>

            {enhancedPreview && (
              <button
                onClick={handleApplyEnhanced}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md animate-pulse"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>应用增强后实拍图</span>
              </button>
            )}

            {onOpenUploadModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUploadModal();
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
              >
                更换高清实拍图
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
            >
              关闭
            </button>

            {onProceedToGenerate && (
              <button
                onClick={() => {
                  onClose();
                  onProceedToGenerate();
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-xs font-bold text-white shadow-lg transition-all flex items-center gap-1.5"
              >
                <span>确认无误，开始 AI 生图</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
