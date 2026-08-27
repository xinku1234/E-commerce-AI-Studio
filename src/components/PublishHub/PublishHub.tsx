import React, { useState } from 'react';
import { 
  Send, 
  ShieldCheck, 
  Store, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  RefreshCw,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { ProductItem, ChannelStore, PlatformId } from '../../types';
import { INITIAL_CHANNELS, PLATFORMS_DATA } from '../../data/presets';
import { fireSuccessConfetti } from '../../utils/exportUtils';
import { safeFetchJson } from '../../utils/apiUtils';

interface PublishHubProps {
  currentProduct: ProductItem;
}

export const PublishHub: React.FC<PublishHubProps> = ({ currentProduct }) => {
  const [channels, setChannels] = useState<ChannelStore[]>(INITIAL_CHANNELS);
  const [selectedChannelIds, setSelectedChannelIds] = useState<PlatformId[]>(['taobao', 'jd', 'douyin', 'amazon']);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccessModal, setPublishSuccessModal] = useState<any | null>(null);
  
  // Publish configuration
  const [syncStock, setSyncStock] = useState<number>(500);
  const [syncPrice, setSyncPrice] = useState<string>(currentProduct.price || '399');
  const [publishStatusType, setPublishStatusType] = useState<'publish' | 'draft'>('publish');

  // Channel toggle
  const toggleChannel = (id: PlatformId) => {
    if (selectedChannelIds.includes(id)) {
      if (selectedChannelIds.length > 1) {
        setSelectedChannelIds(selectedChannelIds.filter(c => c !== id));
      }
    } else {
      setSelectedChannelIds([...selectedChannelIds, id]);
    }
  };

  // Publish trigger
  const handleExecutePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await safeFetchJson('/api/publish-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productPayload: {
            id: currentProduct.id,
            name: currentProduct.name,
            category: currentProduct.category,
            price: syncPrice,
            stock: syncStock
          },
          targetChannels: selectedChannelIds,
          publishOptions: {
            mode: publishStatusType
          }
        })
      }, 15000);

      const data = res.data;
      if (data && data.success) {
        setPublishSuccessModal(data);
        fireSuccessConfetti();
      }
    } catch (e) {
      console.error('Publish error:', e);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              多电商渠道一键发布与同步中枢
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                已接入 {channels.filter(c => c.connected).length} 个官方商家后台
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              自动执行平台合规审查（广告法违禁词、纯白底色值、安全边距），直接将主图与详情页长图推送至各平台草稿箱或正式上架。
            </p>
          </div>
        </div>

        <button
          id="btn-publish-all"
          onClick={handleExecutePublish}
          disabled={isPublishing || selectedChannelIds.length === 0}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-2 shadow-xl shadow-rose-600/30 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {isPublishing ? '正在全网同步物料...' : `一键发布至选中的 ${selectedChannelIds.length} 个电商平台`}
        </button>
      </div>

      {/* Grid: Connected Stores (Left 7 Cols) & Publish Configuration (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Stores & Compliance Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Store className="w-4 h-4 text-rose-500" />
                已授权电商店铺列表 (勾选目标分发渠道)
              </span>
              <span className="text-xs text-slate-400">已选中 {selectedChannelIds.length} 家店铺</span>
            </div>

            <div className="space-y-3">
              {channels.map((ch) => {
                const isSelected = selectedChannelIds.includes(ch.id);
                const platData = PLATFORMS_DATA.find(p => p.id === ch.id);
                return (
                  <div
                    key={ch.id}
                    onClick={() => ch.connected && toggleChannel(ch.id)}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      !ch.connected
                        ? 'opacity-60 bg-slate-900/40 border-slate-800 cursor-not-allowed'
                        : isSelected
                        ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/40 cursor-pointer shadow-md'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{platData?.icon || '🛍️'}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{ch.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">({ch.storeName})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                          <span>在线商品：{ch.productCount}件</span>
                          <span>月流水：{ch.salesVolume}</span>
                          <span>最近同步：{ch.lastSyncTime || '刚刚'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {ch.connected ? (
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-800 border border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400">
                          未连接API
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Pre-flight Parameters & Compliance Audit */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                全网同步参数配置
              </span>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> AI合规自检通过
              </span>
            </div>

            {/* Current Product Preview */}
            <div className="flex gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl items-center">
              <img
                src={currentProduct.imageUrl}
                alt={currentProduct.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-lg object-cover bg-slate-900 border border-slate-700"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{currentProduct.name}</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">{currentProduct.category}</div>
                <div className="text-xs font-bold text-rose-400 mt-1">¥{currentProduct.price}</div>
              </div>
            </div>

            {/* Price & Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">统一同步售价 (¥)</label>
                <input
                  type="text"
                  value={syncPrice}
                  onChange={(e) => setSyncPrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">初始全网可售库存</label>
                <input
                  type="number"
                  value={syncStock}
                  onChange={(e) => setSyncStock(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Publish Mode */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">分发目标状态：</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPublishStatusType('publish')}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    publishStatusType === 'publish'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  🚀 直接上架销售
                </button>
                <button
                  onClick={() => setPublishStatusType('draft')}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    publishStatusType === 'draft'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  📝 同步至草稿箱 (人工终审)
                </button>
              </div>
            </div>

            {/* Real-time compliance report box */}
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-1.5 text-xs">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                广告法与平台合规自检报告 (已自动修正)
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                <li>已剔除国家广告法极限词（顶级、全网第一等）</li>
                <li>Amazon 跨境首图自动生成纯白 RGB(255,255,255) 独立物料</li>
                <li>已避开抖音/小红书底部交互与购物车 UI 遮挡区域</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {publishSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">多渠道分发成功！</h3>
                <p className="text-xs text-slate-400">
                  批次编号：{publishSuccessModal.batchId} ｜ 成功同步 {publishSuccessModal.dispatchedCount} 个电商渠道
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {publishSuccessModal.channelsResult?.map((res: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{res.channelName}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      远程商品编号: {res.remoteItemId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      已同步
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setPublishSuccessModal(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 text-white text-xs font-semibold shadow-md"
              >
                完成并返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
