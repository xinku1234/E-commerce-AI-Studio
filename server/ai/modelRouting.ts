import type { Response } from 'express';
import { getAiCapabilities } from './gemini';
import { isEndpointVerified } from './verifiedEndpoints';
import { CUSTOM_ENDPOINT_HINT, CustomEndpointError, resolveCustomModelName } from './openAiCompatible';

export const DEMO_MODE_WARNING = '当前为显式演示模式 (REQUIRE_MODEL=false)，结果由本地规则生成，不代表模型识别结论。';

export type ModelRoute =
  | { kind: 'custom'; endpointUrl: string; apiKey?: string; model: string }
  | { kind: 'gemini'; model: string }
  | { kind: 'demo' }
  | { kind: 'unavailable' };

/**
 * Chooses the provider for one request. A verified custom endpoint always wins,
 * because that is what the user bound in the UI; Gemini is only used when the
 * request carries no usable custom endpoint.
 */
export function resolveModelRoute(options: {
  customEndpointUrl?: unknown;
  customApiKey?: unknown;
  requestedModel?: unknown;
  customFallbackModel: string;
  geminiModel: string;
}): ModelRoute {
  const endpointUrl = typeof options.customEndpointUrl === 'string' ? options.customEndpointUrl.trim() : '';
  if (endpointUrl && isEndpointVerified(endpointUrl)) {
    return {
      kind: 'custom',
      endpointUrl,
      apiKey: typeof options.customApiKey === 'string' ? options.customApiKey : undefined,
      model: resolveCustomModelName(options.requestedModel, options.customFallbackModel)
    };
  }

  const capabilities = getAiCapabilities();
  if (capabilities.providers.gemini.configured) return { kind: 'gemini', model: options.geminiModel };
  if (!capabilities.modelRequired) return { kind: 'demo' };
  return { kind: 'unavailable' };
}

export function mapGeminiTextModel(requested: unknown): string {
  const model = typeof requested === 'string' ? requested.trim() : '';
  if (model === 'gemini-3.1-pro-preview' || model === 'gemini-2.5-pro') return 'gemini-3.1-pro-preview';
  if (model === 'gemini-2.5-flash') return 'gemini-2.5-flash';
  return 'gemini-3.7-flash';
}

export function modelUnavailablePayload() {
  return {
    success: false,
    error: '未绑定可用模型，请先配置 GEMINI_API_KEY 或测试通过自定义模型端点。',
    code: 'MODEL_REQUIRED' as const
  };
}

/**
 * A bound model that fails must report its own failure. Attributing it to a
 * provider the user never selected is what made these errors unactionable.
 */
export function respondModelCallFailure(res: Response, error: unknown, extra?: Record<string, unknown>) {
  const isCustom = error instanceof CustomEndpointError;
  const message = error instanceof Error ? error.message : String(error || '模型调用失败');
  return res.status(502).json({
    success: false,
    error: message,
    hint: CUSTOM_ENDPOINT_HINT,
    code: isCustom ? 'CUSTOM_ENDPOINT_FAILED' : 'MODEL_CALL_FAILED',
    provider: isCustom ? 'custom-openai-compatible' : 'gemini',
    endpoint: isCustom ? (error as CustomEndpointError).endpoint : undefined,
    modelUsed: isCustom ? (error as CustomEndpointError).model : undefined,
    status: isCustom ? (error as CustomEndpointError).status : undefined,
    requestId: res.locals.requestId,
    ...(extra || {})
  });
}

/** The client keys a reorderable list by module id, so ids must be unique. */
export function normalizeDetailModules(parsed: any): any[] | null {
  const modules = Array.isArray(parsed) ? parsed : parsed?.modules;
  if (!Array.isArray(modules) || modules.length === 0) return null;
  const seenIds = new Set<string>();
  return modules.map((module: any, index: number) => {
    const rawId = typeof module?.id === 'string' ? module.id.trim() : '';
    const id = rawId && !seenIds.has(rawId) ? rawId : `mod_${index}_${Math.random().toString(36).slice(2, 8)}`;
    seenIds.add(id);
    return { ...module, id };
  });
}
