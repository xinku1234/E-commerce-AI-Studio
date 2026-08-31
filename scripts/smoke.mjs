import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const port = 3217;
const child = spawn(process.execPath, ['dist/server.cjs'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), REQUIRE_MODEL: 'false' },
  stdio: 'ignore'
});

const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let health;
  for (let i = 0; i < 30; i++) {
    try {
      health = await fetch(`${base}/api/health`);
      if (health.ok) break;
    } catch {}
    await sleep(200);
  }
  if (!health?.ok) throw new Error('health check failed');
  const healthJson = await health.json();
  if (healthJson.status !== 'ok' || healthJson.publishMode !== 'simulation') throw new Error('unexpected health response');
  if (!healthJson.ai?.gemini || !healthJson.ai?.proceduralFallback?.configured) throw new Error('AI capabilities missing');
  if (healthJson.modelRequired !== false || healthJson.modelReady !== false) throw new Error('fallback test mode not explicit');

  const generated = await fetch(`${base}/api/generate-product-image`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'clean product photo', aspectRatio: '1:1' })
  });
  const generatedJson = await generated.json();
  if (!generated.ok || generatedJson.provider !== 'procedural' || generatedJson.isRealAiImage !== false) {
    throw new Error('image provider fallback contract failed');
  }

  const publish = await fetch(`${base}/api/publish-channels`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetChannels: ['taobao'], publishOptions: { mode: 'publish' } })
  });
  const publishJson = await publish.json();
  if (!publish.ok || !publishJson.simulated || publishJson.channelsResult?.[0]?.status !== 'simulated') throw new Error('publish simulation failed');

  const blocked = await fetch(`${base}/api/test-custom-endpoint`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpointUrl: 'ftp://127.0.0.1:21' })
  });
  if (blocked.status !== 400) throw new Error('invalid endpoint was not rejected');

  const strictPort = 3218;
  const strictChild = spawn(process.execPath, ['dist/server.cjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(strictPort),
      REQUIRE_MODEL: 'true',
      GEMINI_API_KEY: '',
      ALLOW_PRIVATE_ENDPOINTS: 'true'
    },
    stdio: 'ignore'
  });
  try {
    let strictHealth;
    for (let i = 0; i < 30; i++) {
      try {
        strictHealth = await fetch(`http://127.0.0.1:${strictPort}/api/health`);
        if (strictHealth.ok) break;
      } catch {}
      await sleep(200);
    }
    if (!strictHealth?.ok) throw new Error('strict health check failed');
    const strictHealthJson = await strictHealth.json();
    if (strictHealthJson.modelRequired !== true || strictHealthJson.modelReady !== false) throw new Error('strict model state missing');
    const strictGenerate = await fetch(`http://127.0.0.1:${strictPort}/api/generate-product-image`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'test' })
    });
    const strictGenerateJson = await strictGenerate.json();
    if (strictGenerate.status !== 503 || strictGenerateJson.code !== 'MODEL_REQUIRED') throw new Error('strict model gate failed');

    // An unverified custom endpoint must not unlock generation.
    const spoofed = await fetch(`http://127.0.0.1:${strictPort}/api/generate-product-image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', customEndpointUrl: 'https://not-tested.example.com/v1' })
    });
    const spoofedJson = await spoofed.json();
    if (spoofed.status !== 503 || spoofedJson.code !== 'MODEL_REQUIRED') throw new Error('untested endpoint bypassed the model gate');

    // Analysis, prompt, suite and detail routes must be gated too.
    for (const route of [
      '/api/ai-analyze-product',
      '/api/generate-multimodal-platform-prompt',
      '/api/generate-hero-suite-5',
      '/api/generate-detail-page-modules'
    ]) {
      const gated = await fetch(`http://127.0.0.1:${strictPort}${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productName: 'test' })
      });
      const gatedJson = await gated.json();
      if (gated.status !== 503 || gatedJson.code !== 'MODEL_REQUIRED') throw new Error(`route not gated: ${route}`);
    }

    // A failed connection test must not mark the endpoint as usable.
    const testRes = await fetch(`http://127.0.0.1:${strictPort}/api/test-custom-endpoint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpointUrl: 'https://127.0.0.1:59999/v1' })
    });
    if (testRes.status === 200) throw new Error(`unreachable endpoint reported as connected`);

    // A bound custom endpoint that fails must be reported as its own failure,
    // never as a message about a provider the user never selected.
    const fakePort = 34117;
    const fake = createServer((req, res) => {
      if (req.url?.endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'claude-opus-5' }] }));
        return;
      }
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
    });
    await new Promise((resolve) => fake.listen(fakePort, '127.0.0.1', resolve));
    try {
      const endpointUrl = `http://127.0.0.1:${fakePort}/v1`;
      const verify = await fetch(`http://127.0.0.1:${strictPort}/api/test-custom-endpoint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpointUrl })
      });
      const verifyJson = await verify.json();
      if (!verify.ok || verifyJson.verified !== true) throw new Error('reachable endpoint was not verified');

      const analyze = await fetch(`http://127.0.0.1:${strictPort}/api/ai-analyze-product`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productName: '测试水杯', analysisModel: 'claude-opus-5', customEndpointUrl: endpointUrl })
      });
      const analyzeJson = await analyze.json();
      if (analyze.status !== 502 || analyzeJson.code !== 'CUSTOM_ENDPOINT_FAILED') {
        throw new Error(`custom endpoint failure was not surfaced: ${analyze.status} ${JSON.stringify(analyzeJson).slice(0, 200)}`);
      }
      if (!analyzeJson.error?.includes('claude-opus-5') || !analyzeJson.error?.includes('401')) {
        throw new Error('custom endpoint failure lacks model or status detail');
      }
      if (/Gemini/i.test(analyzeJson.error)) throw new Error('custom endpoint failure misattributed to Gemini');
      if (analyzeJson.generationMode === 'ai') throw new Error('failed call reported as AI output');

      for (const route of ['/api/generate-multimodal-platform-prompt', '/api/generate-detail-page-modules']) {
        const failed = await fetch(`http://127.0.0.1:${strictPort}${route}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productName: '测试水杯', promptModel: 'claude-opus-5', customEndpointUrl: endpointUrl })
        });
        const failedJson = await failed.json();
        if (failed.status !== 502 || failedJson.code !== 'CUSTOM_ENDPOINT_FAILED') {
          throw new Error(`route did not surface endpoint failure: ${route} -> ${failed.status}`);
        }
        if (/Gemini/i.test(failedJson.error || '')) throw new Error(`route misattributed failure: ${route}`);
      }
    } finally {
      await new Promise((resolve) => fake.close(resolve));
    }
  } finally {
    strictChild.kill();
  }
  console.log('smoke tests passed');
} finally {
  child.kill();
}
