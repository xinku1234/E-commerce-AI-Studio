import { spawn } from 'node:child_process';

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
    env: { ...process.env, NODE_ENV: 'production', PORT: String(strictPort), REQUIRE_MODEL: 'true', GEMINI_API_KEY: '' },
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
  } finally {
    strictChild.kill();
  }
  console.log('smoke tests passed');
} finally {
  child.kill();
}
