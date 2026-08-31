import type { ResolvedImagePart } from './imageInput';
import { getGeminiClient } from './gemini';
import { buildEcommerceImagePrompt } from './prompts';
import { validateRequestUrl } from '../security';
import { isEndpointVerified } from './verifiedEndpoints';
import { joinOpenAiPath } from './openAiCompatible';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  stylePreset?: string;
  imageModel: string;
  customEndpointUrl?: string;
  customApiKey?: string;
  referenceImages: ResolvedImagePart[];
}

export interface ImageGenerationResult {
  provider: 'custom-openai-compatible' | 'gemini' | 'procedural';
  modelUsed: string;
  imageUrl: string | null;
  isRealAiImage: boolean;
  useProceduralStudio: boolean;
  fallbackReason?: string;
  providerErrors?: Array<{ provider: string; message: string }>;
}

export async function generateProductImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const providerErrors: Array<{ provider: string; message: string }> = [];
  const customEndpoint = request.customEndpointUrl?.trim();
  // A verified custom endpoint is the binding the user chose; falling through to
  // another provider would report failures against a provider they never picked.
  const useCustomOnly = Boolean(customEndpoint && isEndpointVerified(customEndpoint));

  if (customEndpoint) {
    try {
      const customResult = await generateWithOpenAiCompatible(request);
      if (customResult.imageUrl) return { ...customResult, providerErrors };
      providerErrors.push({ provider: 'custom-openai-compatible', message: '接口响应中没有可用图片' });
    } catch (error: any) {
      providerErrors.push({ provider: 'custom-openai-compatible', message: error?.message || '自定义图片接口调用失败' });
    }
  }

  if (!useCustomOnly) {
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const geminiResult = await generateWithGemini(request);
        if (geminiResult.imageUrl) return { ...geminiResult, providerErrors };
        providerErrors.push({ provider: 'gemini', message: 'Gemini 响应中没有可用图片' });
      } catch (error: any) {
        providerErrors.push({ provider: 'gemini', message: error?.message || 'Gemini 图片生成失败' });
      }
    } else {
      providerErrors.push({ provider: 'gemini', message: 'GEMINI_API_KEY 未配置' });
    }
  }

  const boundFailure = providerErrors.find((entry) => entry.provider === 'custom-openai-compatible');
  return {
    provider: 'procedural',
    modelUsed: 'procedural-studio',
    imageUrl: null,
    isRealAiImage: false,
    useProceduralStudio: true,
    fallbackReason: (boundFailure || providerErrors.at(-1))?.message || '没有可用的 AI 图片 Provider',
    providerErrors
  };
}

async function generateWithOpenAiCompatible(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const baseUrl = validateRequestUrl(request.customEndpointUrl, '自定义接口地址');
  const endpoint = baseUrl.endsWith('/generate') ? baseUrl : joinOpenAiPath(baseUrl, 'images/generations');

  const model = request.imageModel === 'custom-image-engine' || request.imageModel.startsWith('gemini-')
    ? 'black-forest-labs/FLUX.1-schnell'
    : request.imageModel;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.customApiKey?.trim() ? { Authorization: `Bearer ${request.customApiKey.trim()}` } : {})
    },
    body: JSON.stringify({
      model,
      prompt: buildEcommerceImagePrompt({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        platform: request.stylePreset,
        aspectRatio: request.aspectRatio,
        // The standard /images/generations contract has no portable reference-image field.
        hasReferenceImages: false
      }),
      n: 1,
      size: ratioToSize(request.aspectRatio),
      response_format: 'b64_json'
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`自定义生图端点 ${endpoint}（模型 ${model}）返回 HTTP ${response.status}${detail ? `：${detail.replace(/\s+/g, ' ').slice(0, 220)}` : ''}`);
  }

  const data: any = await response.json();
  const item = data?.data?.[0] || data?.images?.[0] || data?.output?.[0];
  const imageUrl = extractImageUrl(item);
  return {
    provider: 'custom-openai-compatible',
    modelUsed: model,
    imageUrl,
    isRealAiImage: Boolean(imageUrl),
    useProceduralStudio: !imageUrl
  };
}

async function generateWithGemini(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const ai = getGeminiClient();
  if (!ai) throw new Error('GEMINI_API_KEY 未配置');

  const ratio = normalizeAspectRatio(request.aspectRatio);
  const parts: any[] = request.referenceImages.map((image) => ({
    inlineData: { mimeType: image.mimeType, data: image.data }
  }));
  parts.push({
    text: buildEcommerceImagePrompt({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      productName: 'the exact supplied product',
      platform: request.stylePreset,
      aspectRatio: ratio,
      hasReferenceImages: request.referenceImages.length > 0
    })
  });

  const contentModels = [...new Set([
    request.imageModel.startsWith('gemini-') ? request.imageModel : null,
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image'
  ].filter((model): model is string => Boolean(model)))];

  const errors: string[] = [];
  for (const model of contentModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { imageConfig: { aspectRatio: ratio as any } }
      });
      const imageUrl = extractGeminiContentImage(response);
      if (imageUrl) {
        return { provider: 'gemini', modelUsed: model, imageUrl, isRealAiImage: true, useProceduralStudio: false };
      }
      errors.push(`${model}: 未返回图片`);
    } catch (error: any) {
      errors.push(`${model}: ${error?.message || '调用失败'}`);
    }
  }

  try {
    const model = 'imagen-3.0-generate-002';
    const response = await ai.models.generateImages({
      model,
      prompt: buildEcommerceImagePrompt({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        platform: request.stylePreset,
        aspectRatio: ratio,
        hasReferenceImages: false
      }),
      config: { numberOfImages: 1, aspectRatio: ratio as any, outputMimeType: 'image/png' }
    });
    const bytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (bytes) {
      return {
        provider: 'gemini',
        modelUsed: model,
        imageUrl: `data:image/png;base64,${bytes}`,
        isRealAiImage: true,
        useProceduralStudio: false
      };
    }
    errors.push(`${model}: 未返回图片`);
  } catch (error: any) {
    errors.push(`imagen-3.0-generate-002: ${error?.message || '调用失败'}`);
  }

  throw new Error(errors.join(' | '));
}

function extractGeminiContentImage(response: any): string | null {
  for (const part of response?.candidates?.[0]?.content?.parts || []) {
    if (part?.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

function extractImageUrl(item: any): string | null {
  if (typeof item === 'string') {
    return item.startsWith('http') || item.startsWith('data:image/') ? item : `data:image/png;base64,${item}`;
  }
  if (!item || typeof item !== 'object') return null;
  const base64 = item.b64_json || item.base64 || item.image_base64;
  if (typeof base64 === 'string' && base64) return `data:image/png;base64,${base64}`;
  const url = item.url || item.image_url;
  return typeof url === 'string' && url ? url : null;
}

function normalizeAspectRatio(value: string): string {
  return ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(value) ? value : '1:1';
}

function ratioToSize(value: string): string {
  const sizes: Record<string, string> = {
    '1:1': '1024x1024',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '9:16': '576x1024',
    '16:9': '1024x576'
  };
  return sizes[normalizeAspectRatio(value)];
}
