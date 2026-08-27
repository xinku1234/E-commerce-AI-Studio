/**
 * High-performance smart background removal / matting utility.
 * Samples corner and boundary pixels, performs flood-fill / color distance keying
 * with smooth alpha feathering to cleanly extract products from plain or studio backgrounds.
 */

export interface MattingOptions {
  tolerance?: number; // 0 to 100, default ~28
  featherRadius?: number; // 0 to 5, default 2
  sampleCornerOnly?: boolean;
}

export function smartRemoveBackground(
  imageSource: string,
  options: MattingOptions = {}
): Promise<string> {
  const { tolerance = 30, featherRadius = 2 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageSource);
          return;
        }

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 1. Sample background colors from 4 corners and borders
        const samplePoints = [
          [2, 2],
          [width - 3, 2],
          [2, height - 3],
          [width - 3, height - 3],
          [Math.floor(width / 2), 2],
          [Math.floor(width / 2), height - 3],
          [2, Math.floor(height / 2)],
          [width - 3, Math.floor(height / 2)],
        ];

        const bgColors: [number, number, number][] = [];
        for (const [x, y] of samplePoints) {
          const idx = (y * width + x) * 4;
          bgColors.push([data[idx], data[idx + 1], data[idx + 2]]);
        }

        // Calculate color distance helper (Euclidean in RGB)
        const getColorDist = (r: number, g: number, b: number, target: [number, number, number]) => {
          const dr = r - target[0];
          const dg = g - target[1];
          const db = b - target[2];
          return Math.sqrt(dr * dr + dg * dg + db * db);
        };

        const tolDist = (tolerance / 100) * 255;
        const fadeDist = tolDist + 22;

        // 2. Perform alpha mask generation
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Find minimum distance to any background color
          let minDist = 9999;
          for (const bg of bgColors) {
            const dist = getColorDist(r, g, b, bg);
            if (dist < minDist) minDist = dist;
          }

          if (minDist <= tolDist) {
            // Completely transparent
            data[i + 3] = 0;
          } else if (minDist < fadeDist) {
            // Smooth edge feathering
            const alphaFactor = (minDist - tolDist) / (fadeDist - tolDist);
            data[i + 3] = Math.floor(data[i + 3] * Math.min(1, Math.max(0, alphaFactor)));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Smart background removal fallback:', err);
        resolve(imageSource);
      }
    };

    img.onerror = () => {
      resolve(imageSource);
    };

    img.src = imageSource;
  });
}

/**
 * Optimizes / compresses an image data URL or URL before sending over network to AI models
 * Keeps max dimension <= maxDim (default 960px) and outputs high-quality compressed JPEG/PNG to avoid 413 errors.
 */
export function optimizeImageForUpload(
  imageSource: string | undefined,
  maxDim: number = 960
): Promise<string> {
  if (!imageSource || typeof imageSource !== 'string' || imageSource.trim().length < 10) {
    return Promise.resolve('');
  }

  // If already a remote URL (http/https), pass through
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return Promise.resolve(imageSource);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        let targetW = w;
        let targetH = h;

        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSource);
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        // Use JPEG 0.85 for small payload or PNG if transparency needed
        const isTransparent = imageSource.startsWith('data:image/png');
        const compressed = canvas.toDataURL(isTransparent ? 'image/png' : 'image/jpeg', 0.85);
        resolve(compressed);
      } catch (err) {
        console.warn('Image optimization fallback:', err);
        resolve(imageSource);
      }
    };
    img.onerror = () => resolve(imageSource);
    img.src = imageSource;
  });
}
