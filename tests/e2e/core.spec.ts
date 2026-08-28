import { test, expect } from '@playwright/test';
import { readFile, stat } from 'node:fs/promises';
import JSZip from 'jszip';

const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function expectNonEmptyDownload(download: import('@playwright/test').Download, extension: string) {
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`, 'i'));
  const path = await download.path();
  expect(path).toBeTruthy();
  expect((await stat(path!)).size).toBeGreaterThan(100);
  return path!;
}

test('core workspaces are navigable without browser errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByText('智能主图工坊')).toBeVisible();

  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await expect(page.getByText('智能详情页长图工坊')).toBeVisible();

  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await expect(page.getByText('批量多平台矩阵生成引擎')).toBeVisible();

  await page.getByRole('button', { name: /一键多渠道分发/ }).click();
  await expect(page.getByText('多电商渠道发布流程预览')).toBeVisible();
  await page.getByRole('button', { name: /模拟分发至/ }).click();
  await expect(page.getByText('模拟分发完成')).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('fallback image generation reports procedural mode', async ({ request }) => {
  const response = await request.post('/api/generate-product-image', {
    data: { prompt: 'clean product photo', aspectRatio: '1:1' }
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.provider).toBe('procedural');
  expect(body.isRealAiImage).toBe(false);
});

test('fallback product analysis does not invent claims', async ({ request }) => {
  const response = await request.post('/api/ai-analyze-product', {
    data: { productName: '测试水杯', category: '日用品' }
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.generationMode).toBe('fallback');
  const serialized = JSON.stringify(body.data);
  expect(serialized).toContain('待商家');
  expect(serialized).not.toMatch(/航空级|权威认证|提升50%|百亿补贴|质保换新/);
});

test('detail generation exposes safe fallback status', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await page.getByRole('button', { name: 'AI 一键生成完整详情页' }).click();
  await expect(page.getByText(/安全模板/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '服务与售后说明' })).toBeVisible();
  await expect(page.getByText('3年官方联保')).toHaveCount(0);
});

test('mobile users can navigate all workspaces without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: '切换到详情工作区' }).click();
  await expect(page.getByText('智能详情页长图工坊')).toBeVisible();
  await page.getByRole('button', { name: '切换到批量工作区' }).click();
  await expect(page.getByText('批量多平台矩阵生成引擎')).toBeVisible();
  await page.getByRole('button', { name: '切换到发布工作区' }).click();
  await expect(page.getByText('多电商渠道发布流程预览')).toBeVisible();

  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});

test('batch matrix executes a real provider or local composition task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await expect(page.getByText('暂无任务，请点击上方构建新矩阵添加任务。')).toBeVisible();

  const productButtons = page.getByRole('button', { name: /^选择商品 / });
  if (await productButtons.count() > 1) await productButtons.nth(1).click();
  for (const platform of ['京东商城', '抖音电商', '亚马逊 (跨境)']) {
    const button = page.getByRole('button', { name: `选择平台 ${platform}` });
    if (await button.getAttribute('aria-pressed') === 'true') await button.click();
  }

  await page.locator('#btn-create-batch-matrix').click();
  await expect(page.getByText('已完成').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('生成失败')).toHaveCount(0);
});

test('batch export ZIP contains generated PNG and metadata', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await page.locator('#btn-create-batch-matrix').click();
  await expect(page.getByText('已完成')).toBeVisible({ timeout: 30_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /打包下载全部物料/ }).click();
  const zipPath = await expectNonEmptyDownload(await downloadPromise, 'zip');
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  expect(entries.some(entry => entry.name.endsWith('.png'))).toBeTruthy();
  expect(entries.some(entry => entry.name.endsWith('.txt'))).toBeTruthy();
});

test('custom product upload validates, saves, and survives reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /上传自定义商品/ }).click();

  await page.getByRole('button', { name: /保存并应用该商品/ }).click();
  await expect(page.getByText('请填写商品名称。')).toBeVisible();

  await page.getByTestId('custom-product-images').setInputFiles({
    name: 'product.png',
    mimeType: 'image/png',
    buffer: PNG_FIXTURE
  });
  await expect(page.getByText('已上传 1 张实拍图')).toBeVisible();

  await page.getByLabel('商品标题').fill('回归测试商品');
  await page.getByLabel('所属类目').fill('测试类目');
  await page.getByLabel('活动售价').fill('99');
  await page.getByRole('button', { name: /保存并应用该商品/ }).click();

  await expect(page.locator('#active-product-btn')).toContainText('回归测试商品');
  await page.reload();
  await expect(page.locator('#active-product-btn')).toContainText('回归测试商品');
  await expect(page.locator('#active-product-btn img')).toHaveAttribute('src', /^data:image\/png;base64,/);
});

test('custom product starts without fabricated promotion defaults', async ({ page }) => {
  await page.goto('/');
  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /上传自定义商品/ }).click();
  await page.getByLabel('商品标题').fill('无促销默认值商品');
  await page.getByLabel('所属类目').fill('测试类目');
  await page.getByLabel('活动售价').fill('10');
  await page.getByTestId('custom-product-images').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByRole('button', { name: /保存并应用该商品/ }).click();
  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /取消/ }).click();
  await expect(page.getByText('立省300元')).toHaveCount(0);
});

test('detail exports produce non-empty PNG and ZIP assets', async ({ page }) => {
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_FIXTURE }));
  await page.goto('/');
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();

  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /下载完整长图/ }).click();
  await expectNonEmptyDownload(await pngDownloadPromise, 'png');

  const zipDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出切片物料包/ }).click();
  const zipPath = await expectNonEmptyDownload(await zipDownloadPromise, 'zip');
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  expect(entries.some(entry => entry.name.endsWith('detail_page_config.json'))).toBeTruthy();
  const pngEntries = entries.filter(entry => entry.name.endsWith('.png'));
  expect(pngEntries.length).toBeGreaterThan(1);
  expect((await pngEntries[0].async('uint8array')).byteLength).toBeGreaterThan(100);
});
