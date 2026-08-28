import { validateRequestUrl } from '../security';

export interface ResolvedImagePart {
  mimeType: string;
  data: string;
}

export async function resolveImagePart(imageInput: string | undefined): Promise<ResolvedImagePart | null> {
  if (!imageInput || typeof imageInput !== 'string' || imageInput.trim().length < 10) return null;
  const value = imageInput.trim();

  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex > 0) {
      const header = value.substring(5, commaIndex);
      const mimeType = header.split(';')[0] || 'image/jpeg';
      const data = value.substring(commaIndex + 1);
      if (!mimeType.startsWith('image/') || !header.includes(';base64') || data.length > 16 * 1024 * 1024) return null;
      return {
        mimeType,
        data
      };
    }
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const safeUrl = validateRequestUrl(value, '图片地址');
      const response = await fetch(safeUrl, {
        headers: { 'User-Agent': 'e-commerce-ai-studio' },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.toLowerCase().startsWith('image/')) {
        console.warn('Remote image URL returned a non-image content type:', contentType);
        return null;
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 12 * 1024 * 1024) {
        console.warn('Remote image exceeds the 12 MB input limit');
        return null;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 12 * 1024 * 1024) return null;
      return {
        mimeType: contentType.split(';')[0] || 'image/jpeg',
        data: Buffer.from(buffer).toString('base64')
      };
    } catch (error) {
      console.warn('Failed to resolve remote image input:', error);
      return null;
    }
  }

  if (value.length > 50 && value.length <= 16 * 1024 * 1024 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return { mimeType: 'image/jpeg', data: value };
  }
  return null;
}

export async function resolveImageParts(
  images: (string | undefined)[] | undefined,
  singleImage?: string
): Promise<ResolvedImagePart[]> {
  const candidates = Array.isArray(images)
    ? images.filter((image): image is string => typeof image === 'string' && image.trim().length > 10)
    : [];
  if (candidates.length === 0 && singleImage?.trim()) candidates.push(singleImage.trim());

  const results: ResolvedImagePart[] = [];
  for (const candidate of candidates.slice(0, 6)) {
    const resolved = await resolveImagePart(candidate);
    if (resolved) results.push(resolved);
  }
  return results;
}
