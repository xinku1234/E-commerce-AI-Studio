import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::' || host === '::1') return true;
  if (/^(0|10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
  if (/^19[28]\.(?:0|18|19)\./.test(host) || /^(?:22[4-9]|2[3-5]\d)\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (/^(?:fc|fd|fe[89ab]|ff)[0-9a-f:]*$/i.test(host)) return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return Boolean(mapped && isPrivateHostname(mapped[1]));
}

function privateEndpointsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_PRIVATE_ENDPOINTS === 'true';
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
    !privateEndpointsAllowed()
  ) {
    throw new Error(`${label}指向本机或内网地址，生产环境默认禁止访问`);
  }

  return parsed.toString().replace(/\/$/, '');
}

export async function validateOutboundUrl(input: unknown, label = 'URL'): Promise<string> {
  const value = validateRequestUrl(input, label);
  if (privateEndpointsAllowed()) return value;

  const parsed = new URL(value);
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`${label}的域名无法解析`);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isIP(address) || isPrivateHostname(address))) {
    throw new Error(`${label}解析到本机、内网或保留地址，生产环境禁止访问`);
  }
  return value;
}

export async function safeFetch(
  input: unknown,
  init: RequestInit = {},
  options: { label?: string; maxRedirects?: number } = {}
): Promise<Response> {
  let url = await validateOutboundUrl(input, options.label);
  const maxRedirects = options.maxRedirects ?? 2;

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects >= maxRedirects) throw new Error(`${options.label || 'URL'}重定向次数过多`);
    const location = response.headers.get('location');
    if (!location) throw new Error(`${options.label || 'URL'}返回了无效重定向`);
    url = await validateOutboundUrl(new URL(location, url).toString(), options.label);
  }
}
