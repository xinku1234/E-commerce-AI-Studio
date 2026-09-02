import { safeFetch, validateRequestUrl } from '../security';

export type OpenAiPathSuffix = 'chat/completions' | 'images/generations';

export const CUSTOM_ENDPOINT_HINT = '请在「模型与接口配置」中核对接口地址、模型名称与 API Key，然后重新执行连接测试。';

/**
 * Gateways expose their own version prefix (/v1, /api/v3, /openai/v1 ...), so the
 * default /v1 is only added when the URL carries no version segment of its own.
 */
export function joinOpenAiPath(rawUrl: string, suffix: OpenAiPathSuffix): string {
  const trimmed = rawUrl.replace(/\/+$/, '');
  if (trimmed.endsWith(`/${suffix}`)) return trimmed;
  if (suffix === 'chat/completions' && trimmed.endsWith('/chat')) return `${trimmed}/completions`;
  const hasVersionSegment = /\/v\d+[a-z0-9._-]*(?:\/|$)/i.test(trimmed);
  return hasVersionSegment ? `${trimmed}/${suffix}` : `${trimmed}/v1/${suffix}`;
}

export class CustomEndpointError extends Error {
  readonly endpoint: string;
  readonly model: string;
  readonly status?: number;
  readonly detail?: string;

  constructor(options: { endpoint: string; model: string; reason: string; status?: number; detail?: string }) {
    const statusPart = options.status ? `（HTTP ${options.status}）` : '';
    super(`自定义模型端点调用失败${statusPart}：${options.reason}（端点 ${options.endpoint}，模型 ${options.model}）`);
    this.name = 'CustomEndpointError';
    this.endpoint = options.endpoint;
    this.model = options.model;
    this.status = options.status;
    this.detail = options.detail;
  }
}

export function resolveCustomModelName(requested: unknown, fallback: string): string {
  const name = typeof requested === 'string' ? requested.trim() : '';
  if (!name) return fallback;
  if (name === 'custom-prompt-model' || name === 'custom-image-engine') return fallback;
  if (name.startsWith('gemini-')) return fallback;
  return name;
}

export function collectImageDataUrls(images: unknown, imageBase64: unknown, max: number): string[] {
  const collected: string[] = [];
  if (Array.isArray(images)) {
    for (const image of images) {
      if (collected.length >= max) break;
      if (typeof image === 'string' && image.trim() && image.length < 500000) collected.push(image);
    }
  }
  if (collected.length === 0 && typeof imageBase64 === 'string' && imageBase64.trim() && imageBase64.length < 500000) {
    collected.push(imageBase64);
  }
  return collected.slice(0, max);
}

/** Models wrap JSON in prose or fences often enough that plain JSON.parse is not enough. */
export function extractJsonObject(raw: string): any {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('响应内容不是有效的 JSON');
  }
}

export interface CustomChatJsonRequest {
  endpointUrl: unknown;
  apiKey?: unknown;
  model: string;
  systemPrompt?: string;
  userText: string;
  imageUrls?: string[];
  temperature?: number;
  timeoutMs?: number;
  label?: string;
}

function isJsonModeRejection(status: number, detail: string): boolean {
  if (status !== 400 && status !== 404 && status !== 422 && status !== 500) return false;
  return /response_format|json_object|json mode|unsupported|invalid.*parameter/i.test(detail);
}

async function readBodySnippet(response: any): Promise<string> {
  try {
    const text = await response.text();
    return (text || '').replace(/\s+/g, ' ').slice(0, 400);
  } catch {
    return '';
  }
}

/**
 * Calls an OpenAI-compatible /chat/completions endpoint and returns parsed JSON.
 * Any failure is raised as CustomEndpointError so callers can report the real
 * cause instead of silently degrading to another provider.
 */
export async function requestCustomChatJson(request: CustomChatJsonRequest): Promise<any> {
  const cleanUrl = validateRequestUrl(request.endpointUrl, request.label || '自定义接口地址');
  const chatUrl = joinOpenAiPath(cleanUrl, 'chat/completions');
  const apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : '';
  const timeoutMs = request.timeoutMs ?? 30000;

  const userContent: any[] = [{ type: 'text', text: request.userText }];
  for (const url of request.imageUrls || []) {
    userContent.push({ type: 'image_url', image_url: { url } });
  }

  const messages: any[] = [];
  if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const fail = (reason: string, status?: number, detail?: string) => new CustomEndpointError({
    endpoint: chatUrl,
    model: request.model,
    reason,
    status,
    detail
  });

  for (const useJsonMode of [true, false]) {
    let response: any;
    try {
      response = await safeFetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model: request.model,
          messages,
          temperature: request.temperature ?? 0.6,
          ...(useJsonMode ? { response_format: { type: 'json_object' } } : {})
        }),
        signal: AbortSignal.timeout(timeoutMs)
      }, { label: request.label || '自定义接口地址' });
    } catch (error: any) {
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw fail(isTimeout ? `请求在 ${timeoutMs}ms 内未返回` : `网络请求失败：${error?.message || '未知网络错误'}`);
    }

    if (!response.ok) {
      const detail = await readBodySnippet(response);
      if (useJsonMode && isJsonModeRejection(response.status, detail)) continue;
      throw fail(detail || '接口返回错误响应', response.status, detail);
    }

    const rawText = await readFullBody(response);
    let payload: any;
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw fail(`接口响应不是 JSON：${rawText.replace(/\s+/g, ' ').slice(0, 200)}`, response.status);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const apiMessage = payload?.error?.message;
      if (apiMessage && useJsonMode && isJsonModeRejection(200, String(apiMessage))) continue;
      throw fail(apiMessage ? String(apiMessage) : '接口响应中没有可用的模型输出', response.status);
    }

    try {
      return extractJsonObject(content);
    } catch {
      throw fail(`模型输出无法解析为 JSON：${content.replace(/\s+/g, ' ').slice(0, 200)}`, response.status);
    }
  }

  throw fail('接口不接受当前请求格式');
}

async function readFullBody(response: any): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
