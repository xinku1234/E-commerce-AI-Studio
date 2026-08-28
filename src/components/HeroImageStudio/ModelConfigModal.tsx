import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Sparkles, 
  Sliders, 
  Check, 
  Plus, 
  Settings, 
  Layers, 
  Flame, 
  HelpCircle,
  Key,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Zap,
  Terminal,
  Server,
  Edit3,
  ListFilter,
  ArrowRight
} from 'lucide-react';
import { PromptModelOption, ImageModelOption, CustomEndpointConfig } from '../../types';
import { PROMPT_MODELS_DATA, IMAGE_MODELS_DATA } from '../../data/presets';
import { safeFetchJson } from '../../utils/apiUtils';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPromptModel: string;
  onSelectPromptModel: (modelId: string) => void;
  selectedImageModel: string;
  onSelectImageModel: (modelId: string) => void;
  customPromptConfig: CustomEndpointConfig;
  setCustomPromptConfig: React.Dispatch<React.SetStateAction<CustomEndpointConfig>>;
  customImageConfig: CustomEndpointConfig;
  setCustomImageConfig: React.Dispatch<React.SetStateAction<CustomEndpointConfig>>;
  denoisingStrength: number;
  setDenoisingStrength: (val: number) => void;
  serverModelReady?: boolean;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  isOpen,
  onClose,
  selectedPromptModel,
  onSelectPromptModel,
  selectedImageModel,
  onSelectImageModel,
  customPromptConfig,
  setCustomPromptConfig,
  customImageConfig,
  setCustomImageConfig,
  denoisingStrength,
  setDenoisingStrength,
  serverModelReady = false
}) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'image' | 'overview'>('prompt');
  const [showPromptKey, setShowPromptKey] = useState<boolean>(false);
  const [showImageKey, setShowImageKey] = useState<boolean>(false);

  if (!isOpen) return null;

  // Test Endpoint & Fetch Models Handler
  const handleTestEndpoint = async (type: 'prompt' | 'image') => {
    const config = type === 'prompt' ? customPromptConfig : customImageConfig;
    const setConfig = type === 'prompt' ? setCustomPromptConfig : setCustomImageConfig;

    if (!config.endpointUrl || !config.endpointUrl.trim()) {
      setConfig(prev => ({
        ...prev,
        testStatus: 'failed',
        testMessage: '请输入有效的 API 接口地址 (URL)'
      }));
      return;
    }

    setConfig(prev => ({
      ...prev,
      testStatus: 'testing',
      testMessage: '正在连接端点并拉取可用模型列表...'
    }));

    try {
      const res = await safeFetchJson('/api/test-custom-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: config.endpointUrl,
          apiKey: config.apiKey,
          endpointType: 'openai_compatible'
        })
      }, 15000);

      const data = res.data;
      if (data && data.success) {
        setConfig(prev => {
          const models: string[] = data.models || [];
          const currentSelected = prev.selectedModel;
          const nextSelected = models.includes(currentSelected) 
            ? currentSelected 
            : (models[0] || currentSelected || 'default-model');

          return {
            ...prev,
            fetchedModels: models,
            selectedModel: nextSelected,
            latencyMs: data.latencyMs,
            testStatus: 'success',
            testMessage: data.message || `连接成功！响应耗时 ${data.latencyMs}ms，共发现 ${models.length} 个可用模型`,
            lastTestedAt: new Date().toLocaleTimeString()
          };
        });
      } else {
        setConfig(prev => ({
          ...prev,
          testStatus: 'failed',
          testMessage: data?.message || res.error || '连接失败，请检查 API 地址与网络连通性',
          latencyMs: data?.latencyMs
        }));
      }
    } catch (err: any) {
      setConfig(prev => ({
        ...prev,
        testStatus: 'failed',
        testMessage: `网络错误: ${err.message || '无法连接到指定端点'}`
      }));
    }
  };

  const fillPromptPreset = (preset: { url: string; model: string }) => {
    setCustomPromptConfig(prev => ({
      ...prev,
      endpointUrl: preset.url,
      manualModel: preset.model,
      selectedModel: preset.model,
      testStatus: 'idle',
      testMessage: undefined
    }));
  };

  const fillImagePreset = (preset: { url: string; model: string }) => {
    setCustomImageConfig(prev => ({
      ...prev,
      endpointUrl: preset.url,
      manualModel: preset.model,
      selectedModel: preset.model,
      testStatus: 'idle',
      testMessage: undefined
    }));
  };

  const promptReady = selectedPromptModel === "custom-prompt-model"
    ? customPromptConfig.testStatus === "success"
    : serverModelReady;
  const imageReady = selectedImageModel === "custom-image-engine"
    ? customImageConfig.testStatus === "success"
    : serverModelReady;
  const bindingReady = promptReady && imageReady;

  const activeCustomPromptModelName = customPromptConfig.useManual 
    ? (customPromptConfig.manualModel || '未自填模型') 
    : (customPromptConfig.selectedModel || customPromptConfig.manualModel || '未选择模型');

  const activeCustomImageModelName = customImageConfig.useManual 
    ? (customImageConfig.manualModel || '未自填模型') 
    : (customImageConfig.selectedModel || customImageConfig.manualModel || '未选择模型');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                AI 大模型引擎与自定义接口配置
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                  支持 URL + API Key 测试拉取或自填模型
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                API Key 仅在当前页面会话中使用，不会保存到浏览器本地存储。
                可分别指定用于「视觉理解/提示词生成」的 LLM 模型，以及用于「商业生图渲染」的图像引擎
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

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-800 bg-slate-900/60">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'prompt'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            1. 视觉解析与提示词模型
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
              {selectedPromptModel === 'custom-prompt-model' ? `自定义: ${activeCustomPromptModelName}` : PROMPT_MODELS_DATA.find(m => m.id === selectedPromptModel)?.name}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'image'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4" />
            2. 商业摄影生图引擎
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
              {selectedImageModel === 'custom-image-engine' ? `自定义: ${activeCustomImageModelName}` : IMAGE_MODELS_DATA.find(m => m.id === selectedImageModel)?.name.split('(')[0]}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            3. 自定义端点连接总览
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: PROMPT VISION MODEL & CUSTOM CONFIG */}
          {activeTab === 'prompt' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  选择或自定义提示词生成大模型 (Prompt & Multimodal LLM)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  该模型接收商品实拍图，解析物理材质与光影，并结合电商平台规范自动生成高转化提示词与营销文案
                </p>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROMPT_MODELS_DATA.map((model) => {
                  const isSelected = selectedPromptModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => onSelectPromptModel(model.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500/90 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            {model.name}
                            {model.isCustom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                自定义接口
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isSelected 
                              ? 'bg-indigo-500 text-white font-bold' 
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {model.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-3">
                          {model.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-700/50 text-slate-400">
                        <span>供应商: <strong className="text-slate-200">{model.provider}</strong></span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="w-3 h-3" /> 多模态视觉输入
                        </span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dedicated Custom Prompt LLM Setup Section */}
              <div className={`p-5 rounded-2xl border transition-all ${
                selectedPromptModel === 'custom-prompt-model' 
                  ? 'bg-purple-950/20 border-purple-500/80 shadow-xl' 
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        自定义分析大模型配置 (URL + API Key + 测试拉取 / 自填)
                        {selectedPromptModel === 'custom-prompt-model' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold">
                            当前已激活
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        输入 OpenAI 兼容接口地址与 API Key，点击测试连接后自动获取所有可用模型供选择，或直接手动自填
                      </p>
                    </div>
                  </div>

                  {selectedPromptModel !== 'custom-prompt-model' && (
                    <button
                      onClick={() => onSelectPromptModel('custom-prompt-model')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-colors"
                    >
                      切换并使用此自定义端点
                    </button>
                  )}
                </div>

                {/* Preset Fast Fill Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> 快捷填入常用服务:
                  </span>
                  {[
                    { label: 'DeepSeek 官方', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
                    { label: '阿里通义千问 (DashScope)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
                    { label: '硅基流动 (SiliconFlow)', url: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-VL-72B-Instruct' },
                    { label: 'OpenAI 官方', url: 'https://api.openai.com/v1', model: 'gpt-4o' },
                    { label: 'Ollama 本地大模型', url: 'http://127.0.0.1:11434/v1', model: 'llama3.2-vision:latest' }
                  ].map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => fillPromptPreset(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-900/50 hover:text-purple-200 border border-slate-700 hover:border-purple-600 text-[11px] text-slate-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* URL and API Key Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      API 接口地址 (Base URL) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customPromptConfig.endpointUrl}
                      onChange={(e) => setCustomPromptConfig(prev => ({ ...prev, endpointUrl: e.target.value, testStatus: 'idle' }))}
                      placeholder="https://api.openai.com/v1 或 https://dashscope.aliyuncs.com/compatible-mode/v1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      API Key / Token (可选或必填)
                    </label>
                    <div className="relative">
                      <input
                        type={showPromptKey ? "text" : "password"}
                        value={customPromptConfig.apiKey}
                        onChange={(e) => setCustomPromptConfig(prev => ({ ...prev, apiKey: e.target.value, testStatus: 'idle' }))}
                        placeholder="sk-..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPromptKey(!showPromptKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPromptKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    <button
                      onClick={() => handleTestEndpoint('prompt')}
                      disabled={customPromptConfig.testStatus === 'testing'}
                      className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-1.5 h-[38px]"
                    >
                      {customPromptConfig.testStatus === 'testing' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          测试中
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          测试连接
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Feedback Notice */}
                {customPromptConfig.testStatus && customPromptConfig.testStatus !== 'idle' && (
                  <div className={`p-3 rounded-xl mb-3 flex items-start gap-2.5 text-xs ${
                    customPromptConfig.testStatus === 'success' 
                      ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
                      : customPromptConfig.testStatus === 'failed'
                      ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                      : 'bg-indigo-950/40 border border-indigo-800/60 text-indigo-300'
                  }`}>
                    {customPromptConfig.testStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {customPromptConfig.testStatus === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    {customPromptConfig.testStatus === 'testing' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div>{customPromptConfig.testMessage}</div>
                      {customPromptConfig.lastTestedAt && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          测试时间: {customPromptConfig.lastTestedAt} · 响应延迟: {customPromptConfig.latencyMs}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Model Selection Method (Select Fetched OR Self-Fill) */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-purple-400" />
                      模型指定方式:
                    </span>

                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setCustomPromptConfig(prev => ({ ...prev, useManual: false }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          !customPromptConfig.useManual 
                            ? 'bg-purple-600 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        从拉取列表中选择 ({customPromptConfig.fetchedModels.length || 0})
                      </button>
                      <button
                        onClick={() => setCustomPromptConfig(prev => ({ ...prev, useManual: true }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          customPromptConfig.useManual 
                            ? 'bg-purple-600 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        手动自填模型名称
                      </button>
                    </div>
                  </div>

                  {/* Option A: Dropdown from fetched models */}
                  {!customPromptConfig.useManual ? (
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block">
                        选择拉取到的可用模型:
                      </label>
                      {customPromptConfig.fetchedModels.length > 0 ? (
                        <select
                          value={customPromptConfig.selectedModel}
                          onChange={(e) => setCustomPromptConfig(prev => ({ ...prev, selectedModel: e.target.value }))}
                          className="w-full bg-slate-950 border border-purple-500/50 rounded-lg px-3 py-2 text-xs text-purple-200 font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
                        >
                          {customPromptConfig.fetchedModels.map((m, idx) => (
                            <option key={idx} value={m} className="bg-slate-900 text-white">
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span>尚未拉取模型列表，请点击上方「测试连接」按钮，或切换至「手动自填模型名称」</span>
                          <button
                            onClick={() => handleTestEndpoint('prompt')}
                            className="text-purple-400 hover:text-purple-300 underline font-bold"
                          >
                            立即测试拉取
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Option B: Manual text input */
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                        手动自填模型标识/名称 (如 qwen-vl-max / deepseek-chat / gpt-4o / llama3.2-vision):
                      </label>
                      <input
                        type="text"
                        value={customPromptConfig.manualModel}
                        onChange={(e) => setCustomPromptConfig(prev => ({ ...prev, manualModel: e.target.value }))}
                        placeholder="例如: qwen-vl-max / deepseek-chat / ft:gpt-4o:my-org:custom-01"
                        className="w-full bg-slate-950 border border-purple-500/50 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  )}

                  {/* Active Selected Model Notice */}
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>当前生效的自定义模型名: <strong className="text-purple-300 font-mono font-bold">{activeCustomPromptModelName}</strong></span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> 生图时自动调用此模型解析实拍图
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE GENERATION ENGINE & CUSTOM CONFIG */}
          {activeTab === 'image' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  选择或自定义商业生图渲染引擎 (Image Generation Engine)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  该生图大模型接收实拍原图与视觉提示词，执行商业影棚高定布光、材质渲染与高保真背景重构
                </p>
              </div>

              {/* Denoising / Fidelity Slider */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-rose-400" />
                    实物保真度 / 场景融合强度 (Denoising Strength): 
                    <span className="text-rose-400 font-bold ml-1">{Math.round(denoisingStrength * 100)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    数值越低越严格锁定实拍图外观轮廓；数值越高AI生成的商业环境与光影融合越丰富
                  </p>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.9"
                  step="0.05"
                  value={denoisingStrength}
                  onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
                  className="w-48 accent-rose-500 cursor-pointer"
                />
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {IMAGE_MODELS_DATA.map((model) => {
                  const isSelected = selectedImageModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => onSelectImageModel(model.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rose-950/50 border-rose-500/90 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            {model.name}
                            {model.isCustom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                自建/私有
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isSelected 
                              ? 'bg-rose-500 text-white font-bold' 
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {model.tag}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed mb-3">
                          {model.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-700/50 text-slate-400">
                        <span>引擎提供方: <strong className="text-slate-200">{model.provider}</strong></span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="w-3 h-3" /> 支持实拍图生图 (Img2Img)
                        </span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dedicated Custom Image Generation Setup Section */}
              <div className={`p-5 rounded-2xl border transition-all ${
                selectedImageModel === 'custom-image-engine' 
                  ? 'bg-emerald-950/20 border-emerald-500/80 shadow-xl' 
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        自定义生图引擎配置 (ComfyUI / SD API / 硅基流动 / OpenAI)
                        {selectedImageModel === 'custom-image-engine' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
                            当前已激活
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">
                        接入私有部署的 ComfyUI 工作流、SD WebUI 实例或三方生图 API，支持 URL + API Key 测试拉取或自填模型
                      </p>
                    </div>
                  </div>

                  {selectedImageModel !== 'custom-image-engine' && (
                    <button
                      onClick={() => onSelectImageModel('custom-image-engine')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
                    >
                      切换并使用此生图端点
                    </button>
                  )}
                </div>

                {/* Preset Fast Fill Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> 快捷填入常用生图端点:
                  </span>
                  {[
                    { label: '硅基流动 Flux API', url: 'https://api.siliconflow.cn/v1', model: 'black-forest-labs/FLUX.1-schnell' },
                    { label: 'ComfyUI 本地实例', url: 'http://127.0.0.1:8188', model: 'ComfyUI-ProductStage-v2' },
                    { label: 'SD WebUI 本地实例', url: 'http://127.0.0.1:7860', model: 'sd_xl_base_1.0' },
                    { label: 'OpenAI DALL-E 3', url: 'https://api.openai.com/v1', model: 'dall-e-3' }
                  ].map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => fillImagePreset(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-900/50 hover:text-emerald-200 border border-slate-700 hover:border-emerald-600 text-[11px] text-slate-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* URL and API Key Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      生图 API 接口地址 (Base URL) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customImageConfig.endpointUrl}
                      onChange={(e) => setCustomImageConfig(prev => ({ ...prev, endpointUrl: e.target.value, testStatus: 'idle' }))}
                      placeholder="https://api.siliconflow.cn/v1 或 http://127.0.0.1:8188"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      API Key / 鉴权 Token
                    </label>
                    <div className="relative">
                      <input
                        type={showImageKey ? "text" : "password"}
                        value={customImageConfig.apiKey}
                        onChange={(e) => setCustomImageConfig(prev => ({ ...prev, apiKey: e.target.value, testStatus: 'idle' }))}
                        placeholder="sk-... (本地 ComfyUI/SD 可留空)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImageKey(!showImageKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showImageKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    <button
                      onClick={() => handleTestEndpoint('image')}
                      disabled={customImageConfig.testStatus === 'testing'}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5 h-[38px]"
                    >
                      {customImageConfig.testStatus === 'testing' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          测试中
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          测试生图端点
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Feedback Notice */}
                {customImageConfig.testStatus && customImageConfig.testStatus !== 'idle' && (
                  <div className={`p-3 rounded-xl mb-3 flex items-start gap-2.5 text-xs ${
                    customImageConfig.testStatus === 'success' 
                      ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
                      : customImageConfig.testStatus === 'failed'
                      ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
                      : 'bg-indigo-950/40 border border-indigo-800/60 text-indigo-300'
                  }`}>
                    {customImageConfig.testStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {customImageConfig.testStatus === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    {customImageConfig.testStatus === 'testing' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div>{customImageConfig.testMessage}</div>
                      {customImageConfig.lastTestedAt && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          测试时间: {customImageConfig.lastTestedAt} · 响应延迟: {customImageConfig.latencyMs}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Model Selection Method (Select Fetched OR Self-Fill) */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                      生图模型指定方式:
                    </span>

                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setCustomImageConfig(prev => ({ ...prev, useManual: false }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          !customImageConfig.useManual 
                            ? 'bg-emerald-600 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        从拉取列表中选择 ({customImageConfig.fetchedModels.length || 0})
                      </button>
                      <button
                        onClick={() => setCustomImageConfig(prev => ({ ...prev, useManual: true }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          customImageConfig.useManual 
                            ? 'bg-emerald-600 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        手动自填生图模型名
                      </button>
                    </div>
                  </div>

                  {/* Option A: Dropdown */}
                  {!customImageConfig.useManual ? (
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block">
                        选择拉取到的可用生图模型:
                      </label>
                      {customImageConfig.fetchedModels.length > 0 ? (
                        <select
                          value={customImageConfig.selectedModel}
                          onChange={(e) => setCustomImageConfig(prev => ({ ...prev, selectedModel: e.target.value }))}
                          className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-emerald-200 font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                        >
                          {customImageConfig.fetchedModels.map((m, idx) => (
                            <option key={idx} value={m} className="bg-slate-900 text-white">
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span>尚未拉取生图模型，请点击上方「测试生图端点」，或切换至「手动自填生图模型名」</span>
                          <button
                            onClick={() => handleTestEndpoint('image')}
                            className="text-emerald-400 hover:text-emerald-300 underline font-bold"
                          >
                            立即测试拉取
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Option B: Manual text input */
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 block flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        手动自填生图模型/工作流名称 (如 black-forest-labs/FLUX.1-schnell / ComfyUI-ProductStage-v2):
                      </label>
                      <input
                        type="text"
                        value={customImageConfig.manualModel}
                        onChange={(e) => setCustomImageConfig(prev => ({ ...prev, manualModel: e.target.value }))}
                        placeholder="例如: black-forest-labs/FLUX.1-schnell / sd_xl_base_1.0 / ComfyUI-Ecom"
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  )}

                  {/* Active Selected Model Notice */}
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>当前生效的生图模型: <strong className="text-emerald-300 font-mono font-bold">{activeCustomImageModelName}</strong></span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> 生图时自动调用此图像引擎渲染
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OVERVIEW & PRIVATES */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    企业私有化模型接入与 API 连接监控中心
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    本电商图引擎全面支持商家通过自建算力网关、本地私有部署或三方 OpenAI 规范 API 进行商业化量产。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Prompt Model Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-purple-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">1. 提示词分析端点 (LLM)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        customPromptConfig.testStatus === 'success' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {customPromptConfig.testStatus === 'success' ? `已连通 (${customPromptConfig.latencyMs}ms)` : '待测试'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono truncate">
                      URL: {customPromptConfig.endpointUrl || '未配置'}
                    </div>
                    <div className="text-xs text-slate-400">
                      目标模型: <strong className="text-white">{activeCustomPromptModelName}</strong>
                    </div>
                    <button
                      onClick={() => { setActiveTab('prompt'); handleTestEndpoint('prompt'); }}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
                    >
                      进入配置与测试 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Image Model Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">2. 商业生图端点 (Image Engine)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        customImageConfig.testStatus === 'success' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {customImageConfig.testStatus === 'success' ? `已连通 (${customImageConfig.latencyMs}ms)` : '待测试'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono truncate">
                      URL: {customImageConfig.endpointUrl || '未配置'}
                    </div>
                    <div className="text-xs text-slate-400">
                      目标模型: <strong className="text-white">{activeCustomImageModelName}</strong>
                    </div>
                    <button
                      onClick={() => { setActiveTab('image'); handleTestEndpoint('image'); }}
                      className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                    >
                      进入配置与测试 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/40 text-xs text-indigo-300 leading-relaxed">
                  💡 提示：若未设置自定义 API，系统将自动使用 Google GenAI 高性能商业预置模型（已内置 Gemini 3.7 Flash 与 Gemini 3.1 Flash Image）。
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80">
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
            <span>当前提示词模型: <strong className="text-indigo-400 font-bold">
              {selectedPromptModel === 'custom-prompt-model' ? `[自定义] ${activeCustomPromptModelName}` : PROMPT_MODELS_DATA.find(m => m.id === selectedPromptModel)?.name}
            </strong></span>
            <span>·</span>
            <span>当前生图引擎: <strong className="text-rose-400 font-bold">
              {selectedImageModel === 'custom-image-engine' ? `[自定义] ${activeCustomImageModelName}` : IMAGE_MODELS_DATA.find(m => m.id === selectedImageModel)?.name.split('(')[0]}
            </strong></span>
          </div>

          <button
            onClick={onClose}
            disabled={!bindingReady}
            title={bindingReady ? undefined : "请先完成模型绑定：配置服务端 GEMINI_API_KEY，或选择自定义端点并测试连接成功"}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {bindingReady ? "保存配置并返回工作台" : "请先完成模型绑定"}
          </button>
        </div>
      </div>
    </div>
  );
};
