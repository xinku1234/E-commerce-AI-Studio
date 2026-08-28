import { ImageQualityReport } from '../types';

export interface EcommerceOutputValidation {
  score: number;
  status: 'passed' | 'warning';
  issues: string[];
  width: number;
  height: number;
  whiteBackgroundRatio?: number;
}

export async function validateEcommerceOutput(
  imageSource: string,
  options: { aspectRatio?: string; requireWhiteBackground?: boolean } = {}
): Promise<EcommerceOutputValidation> {
  const report = await analyzeImageQuality(imageSource);
  const issues: string[] = [];
  const { width, height } = report.resolution;
  let score = Math.round(report.resolution.score * 0.45 + report.sharpness.score * 0.35 + report.brightness.score * 0.20);

  const expectedRatios: Record<string, number> = { '1:1': 1, '3:4': 0.75, '4:3': 4 / 3, '9:16': 9 / 16, '16:9': 16 / 9 };
  const expected = options.aspectRatio ? expectedRatios[options.aspectRatio] : undefined;
  if (expected && Math.abs(width / height - expected) > 0.035) {
    score -= 20;
    issues.push(`输出画幅为 ${width}:${height}，与目标 ${options.aspectRatio} 不一致`);
  }
  if (Math.min(width, height) < 700) {
    issues.push('输出短边低于 700px，不建议直接作为主图发布');
  }
  if (report.sharpness.status === 'fail') issues.push('输出清晰度不足，建议重新生成');

  let whiteBackgroundRatio: number | undefined;
  if (options.requireWhiteBackground) {
    whiteBackgroundRatio = await measureWhiteBackgroundRatio(imageSource);
    // Pure-white catalog images naturally score as overexposed in a generic photo check.
    score = Math.round(report.resolution.score * 0.5 + report.sharpness.score * 0.3 + whiteBackgroundRatio * 100 * 0.2);
    if (whiteBackgroundRatio < 0.82) {
      score -= 25;
      issues.push(`白底覆盖率约 ${Math.round(whiteBackgroundRatio * 100)}%，未达到建议值 82%`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, status: score >= 65 && issues.length === 0 ? 'passed' : 'warning', issues, width, height, whiteBackgroundRatio };
}

function measureWhiteBackgroundRatio(imageSource: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sample = 240;
      canvas.width = sample;
      canvas.height = sample;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Canvas 2D context not available'));
      ctx.drawImage(img, 0, 0, sample, sample);
      const data = ctx.getImageData(0, 0, sample, sample).data;
      let white = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] >= 245 && data[i + 1] >= 245 && data[i + 2] >= 245 && data[i + 3] >= 250) white++;
      }
      resolve(white / (data.length / 4));
    };
    img.onerror = () => reject(new Error('无法加载生成结果'));
    img.src = imageSource;
  });
}

/**
 * Analyzes an image for sharpness, brightness/exposure, and resolution.
 * Returns a comprehensive ImageQualityReport with a calculated Quality Score.
 */
export async function analyzeImageQuality(imageSource: string): Promise<ImageQualityReport> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const megapixels = Number(((width * height) / 1000000).toFixed(2));
        const minDim = Math.min(width, height);

        // Aspect ratio string
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        const aspectW = Math.round(width / divisor);
        const aspectH = Math.round(height / divisor);
        const aspectRatioText = `${width} × ${height} (${aspectW}:${aspectH})`;

        // 1. Resolution Score
        let resScore = 80;
        let resStatus: 'pass' | 'warn' | 'fail' = 'pass';
        let resDesc = '标准高清分辨率，符合主流电商规范';

        if (minDim >= 1400) {
          resScore = 98;
          resDesc = '超高清商业级分辨率 (≥1400px)，细节放大极清晰';
        } else if (minDim >= 1000) {
          resScore = 90;
          resDesc = '高清分辨率 (≥1000px)，完全满足主流电商主图要求';
        } else if (minDim >= 700) {
          resScore = 75;
          resDesc = '标准电商分辨率 (700-1000px)，基本满足生图需求';
        } else if (minDim >= 450) {
          resScore = 58;
          resStatus = 'warn';
          resDesc = '分辨率偏低 (<700px)，AI融合时可能需要轻度插值';
        } else {
          resScore = 38;
          resStatus = 'fail';
          resDesc = '低分辨率图源 (<450px)，容易导致产品边缘发虚失真';
        }

        // 2. Pixel Sampling on Offscreen Canvas for Sharpness & Brightness
        const sampleMax = 400;
        let sampleW = width;
        let sampleH = height;
        if (width > sampleMax || height > sampleMax) {
          if (width >= height) {
            sampleW = sampleMax;
            sampleH = Math.max(1, Math.round((height / width) * sampleMax));
          } else {
            sampleH = sampleMax;
            sampleW = Math.max(1, Math.round((width / height) * sampleMax));
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imgData.data;
        const totalPixels = sampleW * sampleH;

        // Grayscale & luminance calculation
        const lum = new Float32Array(totalPixels);
        let sumLum = 0;
        let sumLumSq = 0;
        let darkPixelCount = 0;
        let brightPixelCount = 0;

        for (let i = 0; i < totalPixels; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          // Rec. 709 luminance
          const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lum[i] = y;
          sumLum += y;
          sumLumSq += y * y;

          if (y < 35) darkPixelCount++;
          if (y > 235) brightPixelCount++;
        }

        const meanLuminance = Number((sumLum / totalPixels).toFixed(1));
        const luminanceVariance = Math.max(0, sumLumSq / totalPixels - meanLuminance * meanLuminance);
        const contrastRatio = Number(Math.sqrt(luminanceVariance).toFixed(1));

        // 3. Brightness / Exposure Score
        let brightScore = 85;
        let brightStatus: 'pass' | 'warn' | 'fail' = 'pass';
        let brightDesc = '曝光与采光均衡，主体明暗过渡自然';

        if (meanLuminance < 60 || (darkPixelCount / totalPixels > 0.45)) {
          brightScore = Math.max(35, Math.round(35 + (meanLuminance / 60) * 25));
          brightStatus = meanLuminance < 45 ? 'fail' : 'warn';
          brightDesc = '画面整体偏暗/欠曝，可能掩盖产品材质细节';
        } else if (meanLuminance > 220 || (brightPixelCount / totalPixels > 0.50)) {
          brightScore = Math.max(45, Math.round(85 - ((meanLuminance - 200) / 55) * 40));
          brightStatus = meanLuminance > 235 ? 'fail' : 'warn';
          brightDesc = '画面存在较大面积过曝/高光溢出';
        } else if (meanLuminance >= 90 && meanLuminance <= 180 && contrastRatio >= 38) {
          brightScore = 95;
          brightDesc = '商业棚拍级光影，对比度与动态范围极佳';
        } else if (meanLuminance >= 75 && meanLuminance <= 195) {
          brightScore = 86;
          brightDesc = '光线明亮充足，色彩层次适中';
        } else {
          brightScore = 70;
          brightStatus = 'warn';
          brightDesc = '光影对比度稍平淡，建议适度增强对比';
        }

        // 4. Sharpness (Laplacian Kernel Edge Variance)
        let sumLap = 0;
        let sumLapSq = 0;
        let lapCount = 0;

        for (let y = 1; y < sampleH - 1; y++) {
          for (let x = 1; x < sampleW - 1; x++) {
            const idx = y * sampleW + x;
            const center = lum[idx];
            const up = lum[(y - 1) * sampleW + x];
            const down = lum[(y + 1) * sampleW + x];
            const left = lum[y * sampleW + (x - 1)];
            const right = lum[y * sampleW + (x + 1)];

            // Standard discrete Laplacian operator
            const lapVal = Math.abs(4 * center - up - down - left - right);
            sumLap += lapVal;
            sumLapSq += lapVal * lapVal;
            lapCount++;
          }
        }

        const meanLap = lapCount > 0 ? sumLap / lapCount : 0;
        const lapVariance = lapCount > 0 ? Math.max(0, (sumLapSq / lapCount) - (meanLap * meanLap)) : 0;
        const normalizedVariance = Number(lapVariance.toFixed(1));

        let sharpScore = 75;
        let sharpStatus: 'pass' | 'warn' | 'fail' = 'pass';
        let sharpDesc = '主体轮廓清晰，无明显对焦模糊';

        if (normalizedVariance >= 120) {
          sharpScore = 98;
          sharpDesc = '超高清微距质感，边缘与纹理锐利分明';
        } else if (normalizedVariance >= 65) {
          sharpScore = 90;
          sharpDesc = '对焦锐利，商品主体及文字细节清晰';
        } else if (normalizedVariance >= 35) {
          sharpScore = 78;
          sharpDesc = '清晰度良好，符合主流电商实拍标准';
        } else if (normalizedVariance >= 18) {
          sharpScore = 58;
          sharpStatus = 'warn';
          sharpDesc = '略有虚焦或轻微模糊，AI生成时将自动增强边缘';
        } else {
          sharpScore = 38;
          sharpStatus = 'fail';
          sharpDesc = '检测到严重模糊或失焦，强烈建议重新对焦拍摄';
        }

        // 5. Total Quality Score (Weighted: 40% Sharpness + 30% Resolution + 30% Brightness)
        const overallScore = Math.round(
          sharpScore * 0.40 +
          resScore * 0.30 +
          brightScore * 0.30
        );

        let grade: 'S' | 'A' | 'B' | 'C' = 'B';
        let gradeText = '良好 · 适合生图';

        if (overallScore >= 90) {
          grade = 'S';
          gradeText = '商业级卓越 · 最佳生图效果';
        } else if (overallScore >= 75) {
          grade = 'A';
          gradeText = '清晰优质 · 推荐直接使用';
        } else if (overallScore >= 60) {
          grade = 'B';
          gradeText = '标准可用 · 建议轻度微调';
        } else {
          grade = 'C';
          gradeText = '画质偏低 · 建议优化或重拍';
        }

        // 6. Actionable recommendations
        const recommendations: string[] = [];

        if (sharpStatus === 'pass' && resStatus === 'pass' && brightStatus === 'pass') {
          recommendations.push('✨ 实拍图质量达标，AI可完美识别产品材质反射与细节');
          recommendations.push('💎 分辨率与对比度契合高点击率主图标准');
        } else {
          if (resStatus !== 'pass') {
            recommendations.push(`📐 分辨率提醒：当前尺寸为 ${aspectRatioText}，推荐使用 1200×1200 以上原图`);
          }
          if (sharpStatus !== 'pass') {
            recommendations.push('🔍 清晰度提醒：边缘对比略低，建议固定手机或使用微距拍摄以避免手抖');
          }
          if (brightStatus !== 'pass') {
            if (meanLuminance < 70) {
              recommendations.push('💡 光影提醒：实拍偏暗，建议在柔光箱或明亮自然光下补光');
            } else {
              recommendations.push('☀️ 曝光提醒：局部有高光反光死白，建议调整反光板角度');
            }
          }
        }

        const report: ImageQualityReport = {
          overallScore,
          grade,
          gradeText,
          isReadyForAI: overallScore >= 55,
          sharpness: {
            score: sharpScore,
            variance: normalizedVariance,
            status: sharpStatus,
            description: sharpDesc
          },
          brightness: {
            score: brightScore,
            meanLuminance,
            contrastRatio,
            status: brightStatus,
            description: brightDesc
          },
          resolution: {
            score: resScore,
            width,
            height,
            megapixels,
            aspectRatioText,
            status: resStatus,
            description: resDesc
          },
          recommendations,
          analyzedAt: new Date().toLocaleTimeString()
        };

        resolve(report);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('无法加载待检测的图片数据'));
    };

    img.src = imageSource;
  });
}

/**
 * Auto-enhances the image by adjusting luminance, boosting contrast and applying an unsharp mask filter.
 */
export async function enhanceImageQuality(
  imageSource: string,
  options: {
    brightenPercent?: number; // e.g. 10 for +10%
    contrastBoost?: number;   // e.g. 1.15 for +15%
    sharpenLevel?: number;    // 0 to 1
  } = {}
): Promise<string> {
  const { brightenPercent = 8, contrastBoost = 1.12, sharpenLevel = 0.5 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context not available'));

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const len = data.length;

      // 1. Brightness & Contrast curve
      const factor = (259 * (contrastBoost * 255 + 255)) / (255 * (259 - contrastBoost * 255));
      const brightOffset = (brightenPercent / 100) * 255;

      for (let i = 0; i < len; i += 4) {
        // Red
        let r = data[i] + brightOffset;
        r = factor * (r - 128) + 128;
        data[i] = Math.min(255, Math.max(0, r));

        // Green
        let g = data[i + 1] + brightOffset;
        g = factor * (g - 128) + 128;
        data[i + 1] = Math.min(255, Math.max(0, g));

        // Blue
        let b = data[i + 2] + brightOffset;
        b = factor * (b - 128) + 128;
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imgData, 0, 0);

      // 2. Optional light sharpening convolution
      if (sharpenLevel > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, 0);
          const srcData = tempCtx.getImageData(0, 0, w, h).data;
          const dstData = ctx.createImageData(w, h);
          const dst = dstData.data;

          const weight = sharpenLevel * 0.5;
          const centerWeight = 1 + 4 * weight;

          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const idx = (y * w + x) * 4;
              for (let c = 0; c < 3; c++) {
                const center = srcData[idx + c];
                const up = srcData[((y - 1) * w + x) * 4 + c];
                const down = srcData[((y + 1) * w + x) * 4 + c];
                const left = srcData[(y * w + (x - 1)) * 4 + c];
                const right = srcData[(y * w + (x + 1)) * 4 + c];

                const val = center * centerWeight - (up + down + left + right) * weight;
                dst[idx + c] = Math.min(255, Math.max(0, val));
              }
              dst[idx + 3] = srcData[idx + 3]; // Alpha
            }
          }
          ctx.putImageData(dstData, 0, 0);
        }
      }

      const enhancedDataUrl = canvas.toDataURL('image/png', 0.95);
      resolve(enhancedDataUrl);
    };

    img.onerror = () => reject(new Error('无法处理待增强图片'));
    img.src = imageSource;
  });
}
