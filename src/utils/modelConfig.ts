import { CustomEndpointConfig } from '../types';

export const DEFAULT_PROMPT_ENDPOINT_CONFIG: CustomEndpointConfig = {
  endpointUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: '',
  selectedModel: 'qwen-vl-max',
  manualModel: 'qwen-vl-max',
  useManual: false,
  fetchedModels: ['qwen-vl-max', 'qwen-vl-plus', 'deepseek-chat', 'gpt-4o', 'claude-3-5-sonnet'],
  testStatus: 'idle'
};

export const DEFAULT_IMAGE_ENDPOINT_CONFIG: CustomEndpointConfig = {
  endpointUrl: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  selectedModel: 'black-forest-labs/FLUX.1-schnell',
  manualModel: 'black-forest-labs/FLUX.1-schnell',
  useManual: false,
  fetchedModels: ['black-forest-labs/FLUX.1-schnell', 'stabilityai/stable-diffusion-3-5-large', 'dall-e-3'],
  testStatus: 'idle'
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

/**
 * Normalizes a persisted (or otherwise untrusted) endpoint config so the UI can
 * render it without defensive checks at every access site. Legacy or corrupted
 * localStorage payloads previously crashed the whole React tree.
 */
export function sanitizeEndpointConfig(
  raw: unknown,
  defaults: CustomEndpointConfig
): CustomEndpointConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<CustomEndpointConfig>;
  const fetchedModels = asStringList(source.fetchedModels);
  const selectedModel = asString(source.selectedModel);
  const manualModel = asString(source.manualModel);

  return {
    endpointUrl: asString(source.endpointUrl, defaults.endpointUrl),
    // API keys are never persisted; they only live in memory for the session.
    apiKey: '',
    selectedModel: selectedModel || defaults.selectedModel,
    manualModel: manualModel || defaults.manualModel,
    useManual: typeof source.useManual === 'boolean' ? source.useManual : defaults.useManual,
    fetchedModels: fetchedModels.length > 0 ? fetchedModels : defaults.fetchedModels,
    lastTestedAt: asString(source.lastTestedAt) || undefined,
    latencyMs: typeof source.latencyMs === 'number' && Number.isFinite(source.latencyMs) ? source.latencyMs : undefined,
    // A restored session is never trusted as verified; the server must re-confirm.
    testStatus: 'idle',
    testMessage: undefined
  };
}

export function readStoredEndpointConfig(
  storageKey: string,
  defaults: CustomEndpointConfig
): CustomEndpointConfig {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaults;
    return sanitizeEndpointConfig(JSON.parse(saved), defaults);
  } catch {
    return defaults;
  }
}
