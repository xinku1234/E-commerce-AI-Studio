export interface ModelFailureLike {
  ok: boolean;
  status: number;
  data: any;
  error?: string;
}

export interface ModelFailure {
  kind: 'model-required' | 'endpoint-failed' | 'request-failed' | 'demo-mode';
  message: string;
}

/**
 * Turns an API response into an actionable message. The key rule: a failure is
 * always attributed to the provider the user actually bound, so a broken custom
 * endpoint never surfaces as a message about some other provider.
 */
export function describeModelFailure(res: ModelFailureLike, fallbackMessage: string): ModelFailure {
  const data = res.data || {};

  if (data.code === 'MODEL_REQUIRED') {
    return {
      kind: 'model-required',
      message: data.error || '未绑定可用模型，请先在「模型与接口配置」中完成绑定与连接测试。'
    };
  }

  if (
    data.code === 'CUSTOM_ENDPOINT_FAILED'
    || data.code === 'MODEL_CALL_FAILED'
    || data.code === 'IMAGE_GENERATION_FAILED'
    || data.code === 'MODEL_GENERATION_FAILED'
  ) {
    const parts = [data.error || '已绑定的模型调用失败。'];
    if (data.hint) parts.push(data.hint);
    return { kind: 'endpoint-failed', message: parts.join(' ') };
  }

  if (data.generationMode === 'fallback' && data.warning) {
    return { kind: 'demo-mode', message: data.warning };
  }

  if (res.status === 408) {
    return { kind: 'request-failed', message: '模型请求超时，请检查端点响应速度或稍后重试。' };
  }

  return {
    kind: 'request-failed',
    message: data.error || res.error || fallbackMessage
  };
}
