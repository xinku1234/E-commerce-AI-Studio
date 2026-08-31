import React, { useState } from 'react';
import { 
  Zap, 
  Download, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Trash2, 
  FolderDown,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { BatchTask, ProductItem, PlatformId } from '../../types';
import { PLATFORMS_DATA, SAMPLE_PRODUCTS, SCENE_STYLES } from '../../data/presets';
import { packageAndDownloadZip, fireSuccessConfetti } from '../../utils/exportUtils';
import { uniqueId } from '../../utils/uniqueId';
import { safeFetchJson } from '../../utils/apiUtils';
import { synthesizeCommercialStudioScene, renderCompleteHeroSlotImage } from '../../utils/sceneSynthesizer';
import { validateEcommerceOutput } from '../../utils/imageQuality';

interface BatchStudioProps {
  batchTasks: BatchTask[];
  onUpdateTasks: (tasks: BatchTask[]) => void;
  onClearTasks: () => void;
  currentProduct: ProductItem;
  onNavigateToPublish: () => void;
}

export const BatchStudio: React.FC<BatchStudioProps> = ({
  batchTasks,
  onUpdateTasks,
  onClearTasks,
  currentProduct,
  onNavigateToPublish
}) => {
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const availableProducts = [currentProduct, ...SAMPLE_PRODUCTS.filter(product => product.id !== currentProduct.id)];
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([currentProduct.id, SAMPLE_PRODUCTS[1].id]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['taobao', 'jd', 'douyin', 'amazon']);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Quick generate matrix
  const handleGenerateMatrix = () => {
    const newTasks: BatchTask[] = [];
    
    selectedProductIds.forEach((pId) => {
      const prod = availableProducts.find(p => p.id === pId) || currentProduct;
      selectedPlatforms.forEach((platId) => {
        const plat = PLATFORMS_DATA.find(p => p.id === platId) || PLATFORMS_DATA[0];
        newTasks.push({
          id: uniqueId(`batch_${pId}_${platId}`),
          productId: prod.id,
          productName: prod.name,
          productImage: prod.imageUrl,
          platform: platId,
          aspectRatio: plat.primaryRatio,
          styleId: platId === 'amazon' ? 'scene_pure_white_compliance' : 'scene_studio_minimal',
          status: 'pending',
          progress: 0,
          createdAt: new Date().toLocaleTimeString(),
          complianceScore: platId === 'amazon' ? 100 : 98
        });
      });
    });

    onUpdateTasks([...batchTasks, ...newTasks]);
    handleStartBatchRun([...batchTasks, ...newTasks]);
  };

  const handleStartBatchRun = async (tasksToRun: BatchTask[]) => {
    setIsProcessingBatch(true);
    setBatchError(null);
    let updated = [...tasksToRun];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== 'completed') {
        const task = updated[i];
        const product = availableProducts.find(p => p.id === task.productId) || currentProduct;
        updated[i] = { ...task, status: 'processing', progress: 15 };
        onUpdateTasks([...updated]);

        try {
          const response = await safeFetchJson('/api/generate-product-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Commercial e-commerce product photography for ${product.name}, optimized for ${task.platform}.`,
              negativePrompt: 'blurry, distorted product, duplicate object, watermark, illegible text',
              aspectRatio: task.aspectRatio,
              imageBase64: product.imageUrl,
              stylePreset: task.styleId,
              imageModel: 'gemini-3.1-flash-image'
            })
          }, 25000);
          const data = response.data || {};
          if (data.code === 'MODEL_REQUIRED') {
            throw new Error(data.error || '未绑定可用模型，请先在主图工作台完成模型绑定与连接测试。');
          }
          updated[i] = { ...updated[i], progress: 65 };
          onUpdateTasks([...updated]);

          const aiBackground = data.imageUrl || synthesizeCommercialStudioScene({
            sceneStyleId: task.styleId,
            platformId: task.platform,
            aspectRatio: task.aspectRatio,
            productName: product.name
          });
          const resultImageUrl = await renderCompleteHeroSlotImage({
            slot: task.platform === 'amazon' ? 'slot_5_whitebg' : 'slot_1_ctr',
            productImage: product.imageUrl,
            productName: product.name,
            category: product.category,
            sellingPoints: product.sellingPoints,
            specs: product.specs,
            platformId: task.platform,
            bgImageUrl: aiBackground,
            headline: product.sellingPoints?.[0],
            subheadline: product.sellingPoints?.[1],
            badgeText: task.platform === 'amazon' ? undefined : '商品主图',
            displayMode: task.platform === 'amazon' ? 'pure_photo' : 'commercial_banner',
            width: task.aspectRatio === '3:4' ? 768 : 1024,
            height: task.aspectRatio === '3:4' ? 1024 : 1024
          });
          if (!resultImageUrl) throw new Error('渲染结果为空');
          const quality = await validateEcommerceOutput(resultImageUrl, {
            aspectRatio: task.aspectRatio,
            requireWhiteBackground: task.platform === 'amazon'
          });

          updated[i] = {
            ...updated[i],
            status: 'completed',
            progress: 100,
            resultImageUrl,
            complianceScore: quality.score
          };
        } catch (error: any) {
          updated[i] = { ...updated[i], status: 'failed', progress: 0 };
          setBatchError(error?.message || `任务 ${task.productName} 生成失败`);
        }
        onUpdateTasks([...updated]);
      }
    }

    setIsProcessingBatch(false);
    if (updated.some(task => task.status === 'completed')) fireSuccessConfetti();
  };

  const handleDownloadAllZip = async () => {
    const files: { name: string; folder: string; textContent?: string }[] = [];

    batchTasks.forEach((task, idx) => {
      const platName = PLATFORMS_DATA.find(p => p.id === task.platform)?.name || task.platform;
      files.push({
        name: `${task.productName}_${platName}_${task.aspectRatio}_主图.txt`,
        folder: `${platName}物料包`,
        textContent: `商品: ${task.productName}\n平台: ${platName}\n比例: ${task.aspectRatio}\n合规分: ${task.complianceScore}%\n生成状态: ${task.status}`
      });
      if (task.resultImageUrl) {
        files.push({
          name: `${task.productName}_${platName}_${task.aspectRatio}_主图.png`,
          folder: `${platName}物料包`,
          dataUrl: task.resultImageUrl
        } as any);
      }
    });

    await packageAndDownloadZip(files as any, `电商多渠道批量主图与物料包_${Date.now()}.zip`);
  };

  const filteredTasks = batchTasks.filter(t => {
    if (filterPlatform === 'all') return true;
    return t.platform === filterPlatform;
  });

  const completedCount = batchTasks.filter(t => t.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Batch Controller Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                批量多平台矩阵生成引擎
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {completedCount}/{batchTasks.length} 完成
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                支持勾选多款商品与多个电商渠道，一键交叉裂变生成各平台定制主图与详情物料。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartBatchRun(batchTasks)}
              disabled={isProcessingBatch || batchTasks.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isProcessingBatch ? '批量生成中...' : '开始全部队列生成'}
            </button>

            <button
              onClick={handleDownloadAllZip}
              disabled={batchTasks.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <FolderDown className="w-4 h-4 text-emerald-400" />
              打包下载全部物料 (ZIP)
            </button>
          </div>
        </div>

        {batchError && (
          <div className="px-3 py-2 bg-rose-950/30 border border-rose-800/60 rounded-lg text-xs text-rose-200">
            {batchError} 失败任务可点击“开始全部队列生成”重试。
          </div>
        )}

        {/* Matrix Generator Selector Box */}
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            快速构建新矩阵 (选择参与批量生成的商品与平台)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product selection */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">选择商品：</label>
              <div className="flex flex-wrap gap-1.5">
                {availableProducts.map((prod) => {
                  const isChecked = selectedProductIds.includes(prod.id);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      aria-label={`选择商品 ${prod.name}`}
                      aria-pressed={isChecked}
                      onClick={() => {
                        if (isChecked) {
                          if (selectedProductIds.length > 1) {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== prod.id));
                          }
                        } else {
                          setSelectedProductIds([...selectedProductIds, prod.id]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isChecked
                          ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                          : 'border-slate-800 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {prod.name.slice(0, 8)}...
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platform selection */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">选择目标平台：</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS_DATA.map((plat) => {
                  const isChecked = selectedPlatforms.includes(plat.id);
                  return (
                    <button
                      key={plat.id}
                      type="button"
                      aria-label={`选择平台 ${plat.name}`}
                      aria-pressed={isChecked}
                      onClick={() => {
                        if (isChecked) {
                          if (selectedPlatforms.length > 1) {
                            setSelectedPlatforms(selectedPlatforms.filter(id => id !== plat.id));
                          }
                        } else {
                          setSelectedPlatforms([...selectedPlatforms, plat.id]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
                        isChecked
                          ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                          : 'border-slate-800 bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span>{plat.icon}</span>
                      <span>{plat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              id="btn-create-batch-matrix"
              onClick={handleGenerateMatrix}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-bold shadow"
            >
              + 一键添加 {selectedProductIds.length * selectedPlatforms.length} 组裂变任务
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Tasks Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Filter Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">平台筛选：</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterPlatform('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  filterPlatform === 'all'
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                全部 ({batchTasks.length})
              </button>
              {PLATFORMS_DATA.map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => setFilterPlatform(plat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    filterPlatform === plat.id
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {plat.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onClearTasks}
            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空任务队列
          </button>
        </div>

        {/* Tasks List / Grid */}
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            暂无任务，请点击上方构建新矩阵添加任务。
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const plat = PLATFORMS_DATA.find(p => p.id === task.platform);
              return (
                <div
                  key={task.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex gap-3 items-start">
                    <img
                      src={task.resultImageUrl || task.productImage}
                      alt={task.productName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover bg-slate-900 border border-slate-700 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                          {plat?.name} ({task.aspectRatio})
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> {task.complianceScore}%
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">{task.productName}</h4>
                      <div className="text-[10px] text-slate-400 mt-1">
                        规格：{plat?.recommendedSize}
                      </div>
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs">
                      {task.status === 'completed' ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 已完成
                        </span>
                      ) : task.status === 'processing' ? (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> 生成中 ({task.progress}%)
                        </span>
                      ) : task.status === 'failed' ? (
                        <span className="text-rose-400 font-medium flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5" /> 生成失败
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">排队等待中</span>
                      )}
                    </div>

                    <button
                      onClick={onNavigateToPublish}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                    >
                      发布此项 →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
