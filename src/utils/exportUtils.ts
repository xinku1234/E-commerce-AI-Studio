import JSZip from 'jszip';
import confetti from 'canvas-confetti';

export async function exportCanvasAsImage(canvas: HTMLCanvasElement, filename: string = 'product_hero.png'): Promise<void> {
  const dataUrl = canvas.toDataURL('image/png', 0.95);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function fireSuccessConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 }
  });
}

export async function packageAndDownloadZip(
  files: { name: string; folder?: string; dataUrl?: string; textContent?: string }[],
  zipFilename: string = 'ecommerce_material_pack.zip'
): Promise<void> {
  const zip = new JSZip();

  for (const item of files) {
    if (item.dataUrl) {
      // Remove base64 header
      const base64Data = item.dataUrl.split(',')[1] || item.dataUrl;
      if (item.folder) {
        zip.folder(item.folder)?.file(item.name, base64Data, { base64: true });
      } else {
        zip.file(item.name, base64Data, { base64: true });
      }
    } else if (item.textContent) {
      if (item.folder) {
        zip.folder(item.folder)?.file(item.name, item.textContent);
      } else {
        zip.file(item.name, item.textContent);
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
  fireSuccessConfetti();
}
