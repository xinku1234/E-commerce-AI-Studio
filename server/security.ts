function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function validateRequestUrl(input: unknown, label = 'URL'): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error(`${label}不能为空`);

  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error(`${label}格式无效`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label}仅支持 HTTP 或 HTTPS`);
  if (parsed.username || parsed.password) throw new Error(`${label}不允许包含账号密码`);
  if (
    isPrivateHostname(parsed.hostname) &&
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRIVATE_ENDPOINTS !== 'true'
  ) {
    throw new Error(`${label}指向本机或内网地址，生产环境默认禁止访问`);
  }

  return parsed.toString().replace(/\/$/, '');
}
