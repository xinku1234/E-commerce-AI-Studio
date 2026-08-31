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

test('detail generation labels the explicit demo mode instead of claiming AI output', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await page.getByRole('button', { name: 'AI 一键生成完整详情页' }).click();
  await expect(page.getByText(/演示模式/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '服务与售后说明' })).toBeVisible();
  await expect(page.getByText('3年官方联保')).toHaveCount(0);
});

test('a failing bound endpoint is reported as an endpoint failure, not as a missing provider', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('SELECTED_PROMPT_MODEL', 'custom-prompt-model');
    localStorage.setItem('CUSTOM_PROMPT_CONFIG', JSON.stringify({
      endpointUrl: 'http://127.0.0.1:4599/v1',
      testStatus: 'success',
      selectedModel: 'claude-opus-5',
      manualModel: 'claude-opus-5',
      useManual: false,
      fetchedModels: ['claude-opus-5']
    }));
  });
  await page.reload();

  await page.route('**/api/ai-analyze-product', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        code: 'CUSTOM_ENDPOINT_FAILED',
        provider: 'custom-openai-compatible',
        endpoint: 'http://127.0.0.1:4599/v1/chat/completions',
        modelUsed: 'claude-opus-5',
        error: '自定义模型端点调用失败（HTTP 401）：invalid api key（端点 http://127.0.0.1:4599/v1/chat/completions，模型 claude-opus-5）',
        hint: '请在「模型与接口配置」中核对接口地址、模型名称与 API Key，然后重新执行连接测试。'
      })
    });
  });

  await page.locator('#active-product-btn').click();
  await page.getByRole('button', { name: /上传自定义商品/ }).click();
  await page.getByTestId('custom-product-images').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
  await page.getByRole('button', { name: /AI 一键提炼卖点/ }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('claude-opus-5');
  await expect(alert).toContainText('HTTP 401');
  // The old message blamed a provider the user never bound.
  await expect(alert).not.toContainText('Gemini');
  await expect(page.getByText('待商家核对')).toHaveCount(0);
});

test('a failing image endpoint leaves the hero suite empty instead of scoring a local canvas', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/generate-product-image', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        code: 'IMAGE_GENERATION_FAILED',
        provider: 'custom-openai-compatible',
        error: '自定义生图端点调用失败（HTTP 401）：invalid api key',
        hint: '请在「模型与接口配置」的生图端点中核对接口地址、模型名称与 API Key。'
      })
    });
  });

  await page.getByRole('button', { name: /一键生成全套/ }).click();
  await expect(page.getByRole('alert')).toContainText('生图失败', { timeout: 60_000 });
  // A rejected call must never be presented as a ready, scored master image.
  const matrix = page.getByTestId('hero-suite-matrix');
  await expect(matrix.getByText('生成失败')).toHaveCount(5);
  await expect(matrix.getByText(/^\d+分$/)).toHaveCount(0);
  await expect(matrix.getByText('已生成')).toHaveCount(0);
  await expect(matrix.getByText('本地合成')).toHaveCount(0);
});

test('hero suite marks demo-mode canvases as local composition, not model output', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /一键生成全套/ }).click();

  // Wait for the run to finish before counting, otherwise the assertion races
  // the slot-by-slot updates.
  await expect(page.getByRole('status')).toContainText('未调用生图模型', { timeout: 120_000 });
  const matrix = page.getByTestId('hero-suite-matrix');
  await expect(matrix.getByText('本地合成')).toHaveCount(5);
  // The old matrix showed a green check plus a score for these canvases.
  await expect(matrix.getByText(/^\d+分$/)).toHaveCount(0);
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

test('batch matrix labels a local composition task instead of claiming model output', async ({ page }) => {
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
  // Demo mode returns no model image, so every card must read as local composition.
  await expect(page.getByText('本地合成').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('生成失败')).toHaveCount(0);
  await expect(page.getByText('模型已生成')).toHaveCount(0);
});

test('batch export ZIP contains generated PNG and metadata', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await page.locator('#btn-create-batch-matrix').click();
  await expect(page.getByText('本地合成').first()).toBeVisible({ timeout: 30_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /打包下载全部物料/ }).click();
  const zipPath = await expectNonEmptyDownload(await downloadPromise, 'zip');
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  expect(entries.some(entry => entry.name.endsWith('.png'))).toBeTruthy();
  const metadata = entries.find(entry => entry.name.endsWith('.txt'));
  expect(metadata).toBeTruthy();
  const metadataText = await zip.files[metadata!.name].async('string');
  expect(metadataText).toContain('本地画布合成');
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

test('duplicate module ids from the model cannot break the detail page list', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!/websocket|vite.*connect|closed without opened/i.test(error.message)) pageErrors.push(error.message);
  });
  const keyWarnings: string[] = [];
  page.on('console', (message) => {
    if (/same key/i.test(message.text())) keyWarnings.push(message.text());
  });

  const duplicate = (title: string, type: string) => ({
    id: 'same-id',
    type,
    title,
    enabled: true,
    tag: '标签',
    headline: title,
    subheadline: '副标题',
    bullets: ['要点一', '要点二'],
    specs: [],
    content: '内容'
  });

  await page.route('**/api/generate-detail-page-modules', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        generationMode: 'ai',
        modules: [
          duplicate('重复模块甲', 'hero'),
          duplicate('重复模块乙', 'features'),
          duplicate('重复模块丙', 'specs')
        ]
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await page.getByRole('button', { name: 'AI 一键生成完整详情页' }).click();
  await expect(page.getByText('模块编排 (3)')).toBeVisible();

  // Reordering a keyed list is where duplicate keys corrupt the DOM.
  const moveDown = page.locator('button:has(svg.lucide-move-down)');
  await moveDown.first().click();
  await moveDown.nth(1).click();
  await moveDown.first().click();

  await expect(page.getByText('界面渲染出错')).toHaveCount(0);
  await expect(page.getByText('该工作区加载失败')).toHaveCount(0);
  expect(keyWarnings).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('a DOM desync caused by outside mutation recovers instead of showing an error card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('智能主图工坊')).toBeVisible();

  // Emulate a translation-style extension detaching a React-managed node, then
  // force a re-render of the same subtree.
  await page.evaluate(() => {
    const heading = document.querySelector('main h2, main h1, main span');
    heading?.parentElement?.removeChild(heading);
  });
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await expect(page.getByText('智能详情页长图工坊')).toBeVisible();
  await page.getByRole('button', { name: /智能主图工坊|主图工坊/ }).first().click();

  await expect(page.getByText('智能主图工坊')).toBeVisible();
  await expect(page.getByText('界面渲染出错')).toHaveCount(0);
});

test('one broken workspace keeps the navigation and other workspaces usable', async ({ page }) => {
  await page.goto('/');
  // Make the lazy chunk request fail so the detail workspace cannot mount.
  await page.route('**/DetailPageStudio*', (route) => route.abort());
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();

  await expect(page.getByText('详情页工作台加载失败')).toBeVisible();
  // Navigation still works, and the hero workspace still renders.
  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await expect(page.getByText('批量多平台矩阵生成引擎')).toBeVisible();
});

test('DOM mutations from outside React cannot break rendering', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (!/websocket|vite.*connect|closed without opened/i.test(error.message)) pageErrors.push(error.message);
  });

  await page.goto('/');
  await expect(page.getByText('智能主图工坊')).toBeVisible();

  // The resilience layer repairs a stale insertion reference instead of throwing.
  const insertResult = await page.evaluate(() => {
    const parent = document.createElement('div');
    const stranger = document.createElement('span');
    document.body.append(parent, stranger);
    let outcome: string;
    try {
      parent.insertBefore(document.createElement('i'), stranger);
      outcome = 'repaired:' + parent.children.length;
    } catch (error) {
      outcome = 'threw';
    }
    parent.remove();
    stranger.remove();
    return outcome;
  });
  expect(insertResult).toBe('repaired:1');

  const removeResult = await page.evaluate(() => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    let outcome: string;
    try {
      a.removeChild(b);
      outcome = 'repaired';
    } catch (error) {
      outcome = 'threw';
    }
    a.remove();
    if (b.parentNode) b.remove();
    return outcome;
  });
  expect(removeResult).toBe('repaired');

  // Emulate a page translator: wrap text nodes and reparent a keyed list item,
  // then force React to re-render the same lists.
  await page.getByRole('button', { name: /详情页长图工坊/ }).click();
  await expect(page.getByText('智能详情页长图工坊')).toBeVisible();
  await page.evaluate(() => {
    const icon = document.querySelectorAll('button svg.lucide-move-down')[1];
    const card = icon?.closest('div.rounded-xl');
    if (card) document.querySelector('main')?.appendChild(card);

    const root = document.getElementById('root');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if ((node.nodeValue || '').trim().length > 1) texts.push(node);
    }
    for (const node of texts.slice(0, 60)) {
      const wrapper = document.createElement('font');
      wrapper.textContent = node.nodeValue;
      node.parentNode?.replaceChild(wrapper, node);
    }
  });

  const moveDown = page.locator('button:has(svg.lucide-move-down)');
  for (let i = 0; i < 4; i += 1) {
    await moveDown.first().click({ force: true }).catch(() => {});
  }

  await expect(page.getByText('界面渲染出错')).toHaveCount(0);
  await expect(page.getByText('加载失败')).toHaveCount(0);

  // Navigation and every other workspace still work.
  await page.getByRole('button', { name: /批量矩阵生成/ }).click();
  await expect(page.getByText('批量多平台矩阵生成引擎')).toBeVisible();
  await page.getByRole('button', { name: /一键多渠道分发/ }).click();
  await expect(page.getByText('多电商渠道发布流程预览')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
