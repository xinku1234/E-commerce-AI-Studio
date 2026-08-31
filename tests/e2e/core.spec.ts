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
    if (message.type() === 'error' && !/websocket|vite.*connect|closed without opened/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (!/websocket|vite.*connect|closed without opened/i.test(error.message)) consoleErrors.push(error.message);
  });

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

test('health reports explicit model requirement mode', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.modelRequired).toBe(false);
  expect(body.modelReady).toBe(false);
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
  await expect(page.getByText('已完成').first()).toBeVisible({ timeout: 30_000 });

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

test('locks the workspace until a model is bound', async ({ page }) => {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        mode: 'model-required',
        ai: { gemini: { configured: false }, proceduralFallback: { configured: true } },
        modelRequired: true,
        modelReady: false,
        publishMode: 'simulation'
      })
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '请先绑定可用模型' })).toBeVisible();
  await expect(page.getByRole('button', { name: '请先完成模型绑定' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /详情页长图工坊/ })).toBeDisabled();
});

test('malformed persisted model config still renders the config modal', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!/websocket|vite.*connect|closed without opened/i.test(error.message)) pageErrors.push(error.message);
  });

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('SELECTED_PROMPT_MODEL', 'custom-prompt-model');
    localStorage.setItem('SELECTED_IMAGE_MODEL', 'custom-image-engine');
    // Shapes written by older builds or corrupted by hand.
    localStorage.setItem('CUSTOM_PROMPT_CONFIG', JSON.stringify({ endpointUrl: 'http://127.0.0.1:9/v1' }));
    localStorage.setItem('CUSTOM_IMAGE_CONFIG', JSON.stringify({ fetchedModels: 'oops', selectedModel: null }));
  });
  await page.reload();

  await page.getByRole('button', { name: /模型与接口配置/ }).first().click();
  await expect(page.getByRole('button', { name: /^测试连接$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /从拉取列表中选择/ }).first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('selling point extraction reuses the bound prompt model', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('SELECTED_PROMPT_MODEL', 'custom-prompt-model');
    localStorage.setItem('CUSTOM_PROMPT_CONFIG', JSON.stringify({
      endpointUrl: 'http://127.0.0.1:4599/v1',
      selectedModel: 'bound-vision-model',
      manualModel: 'bound-vision-model',
      useManual: false,
      fetchedModels: ['bound-vision-model']
    }));
  });
  await page.reload();

  const requests: any[] = [];
  await page.route('**/api/ai-analyze-product', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        generationMode: 'ai',
        modelUsed: 'bound-vision-model',
        data: { productIdentified: '识别出的样例商品', coreSellingPoints: ['真实卖点一', '真实卖点二'] }
      })
    });
  });

  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /上传自定义商品/ }).click();
  await expect(page.getByTestId('selling-point-model')).toHaveText('bound-vision-model');

  await page.getByTestId('custom-product-images').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByRole('button', { name: /AI 一键提炼卖点/ }).click();

  await expect(page.getByText('真实卖点一')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].analysisModel).toBe('bound-vision-model');
  expect(requests[0].customEndpointUrl).toBe('http://127.0.0.1:4599/v1');
});

test('selling point extraction refuses to fake results when the model gate rejects', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/ai-analyze-product', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: '未绑定可用模型，请先配置模型。', code: 'MODEL_REQUIRED' })
    });
  });

  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /上传自定义商品/ }).click();
  await page.getByTestId('custom-product-images').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByRole('button', { name: /AI 一键提炼卖点/ }).click();

  await expect(page.getByRole('alert')).toContainText('未绑定可用模型');
  // The old behaviour silently填充 placeholder points; that must not happen now.
  await expect(page.getByText('待商家核对')).toHaveCount(0);
});
