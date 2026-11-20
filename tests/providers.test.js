'use strict';
// Phase F : fournisseurs d'IA étendus (locaux sans clé Ollama / LM Studio, gratuits cloud),
// repli response_format, nettoyage <think> dans parseJson et actualisation en direct listModels.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const {
  PROVIDERS,
  AIError,
  complete,
  parseJson,
  listModels,
  effectiveBaseUrl,
  providerNeedsKey,
} = require(path.join(ROOT, 'src/ai/providers.js'));

const origFetch = global.fetch;

test.afterEach(() => {
  global.fetch = origFetch;
});

test('PROVIDERS : contient les 13 préréglages attendus sans casser Google', () => {
  assert.deepStrictEqual(Object.keys(PROVIDERS), [
    'anthropic', 'google', 'openai', 'groq', 'cerebras', 'sambanova',
    'mistral', 'github', 'deepseek', 'openrouter', 'ollama', 'lmstudio', 'custom',
  ]);
  assert.deepStrictEqual(PROVIDERS.google.models, ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  assert.deepStrictEqual(PROVIDERS.google.backups, ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']);

  assert.strictEqual(providerNeedsKey('ollama'), false);
  assert.strictEqual(providerNeedsKey('lmstudio'), false);
  assert.strictEqual(providerNeedsKey('custom'), false);
  assert.strictEqual(providerNeedsKey('cerebras'), true);
  assert.strictEqual(PROVIDERS.ollama.local, true);
  assert.strictEqual(PROVIDERS.lmstudio.local, true);
  assert.strictEqual(PROVIDERS.ollama.editableBaseUrl, true);
  assert.strictEqual(PROVIDERS.lmstudio.editableBaseUrl, true);

  assert.strictEqual(effectiveBaseUrl({ provider: 'ollama', baseUrl: '' }), 'http://127.0.0.1:11434/v1');
  assert.strictEqual(effectiveBaseUrl({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1' }), 'http://localhost:11434/v1');
  assert.strictEqual(effectiveBaseUrl({ provider: 'lmstudio', baseUrl: '' }), 'http://127.0.0.1:1234/v1');
  assert.strictEqual(effectiveBaseUrl({ provider: 'custom', baseUrl: 'http://192.168.1.5:8000/v1' }), 'http://192.168.1.5:8000/v1');
});

test('fournisseurs locaux (Ollama / LM Studio) : fonctionnent sans clé et gardent le modèle choisi en mode léger', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const r1 = await complete({ provider: 'ollama', model: 'qwen2.5:14b', baseUrl: '' }, '', { system: 's', user: 'u', light: true });
  assert.strictEqual(r1, '{"ok":true}');
  assert.strictEqual(calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.strictEqual(calls[0].headers.Authorization, undefined);
  assert.strictEqual(calls[0].body.model, 'qwen2.5:14b', 'local model unchanged even when light=true');

  const r2 = await complete({ provider: 'lmstudio', model: 'my-gguf', baseUrl: 'http://127.0.0.1:5555/v1/' }, '', { system: 's', user: 'u', light: true });
  assert.strictEqual(r2, '{"ok":true}');
  assert.strictEqual(calls[1].url, 'http://127.0.0.1:5555/v1/chat/completions');
  assert.strictEqual(calls[1].headers.Authorization, undefined);
  assert.strictEqual(calls[1].body.model, 'my-gguf');
});

test('fournisseurs cloud compatibles OpenAI : envoient Bearer (+ X-Title OpenRouter) et exigent une clé', async () => {
  for (const id of ['cerebras', 'sambanova', 'mistral', 'github', 'deepseek', 'openrouter']) {
    await assert.rejects(complete({ provider: id, model: 'm1' }, '', { system: 's', user: 'u' }), /Aucune clé/);
  }

  const seen = [];
  global.fetch = async (url, init) => {
    seen.push({ url, headers: init.headers });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await complete({ provider: 'cerebras', model: 'llama-3.3-70b' }, 'csk-123', { system: 's', user: 'u' });
  await complete({ provider: 'sambanova', model: 'DeepSeek-V3-0324' }, 'sn-123', { system: 's', user: 'u' });
  await complete({ provider: 'mistral', model: 'mistral-small-latest' }, 'ms-123', { system: 's', user: 'u' });
  await complete({ provider: 'github', model: 'gpt-4.1' }, 'ghp-123', { system: 's', user: 'u' });
  await complete({ provider: 'deepseek', model: 'deepseek-chat' }, 'sk-123', { system: 's', user: 'u' });
  await complete({ provider: 'openrouter', model: 'google/gemma-3-27b-it:free' }, 'or-123', { system: 's', user: 'u' });

  assert.strictEqual(seen[0].url, 'https://api.cerebras.ai/v1/chat/completions');
  assert.strictEqual(seen[0].headers.Authorization, 'Bearer csk-123');
  assert.strictEqual(seen[1].url, 'https://api.sambanova.ai/v1/chat/completions');
  assert.strictEqual(seen[2].url, 'https://api.mistral.ai/v1/chat/completions');
  assert.strictEqual(seen[3].url, 'https://models.inference.ai.azure.com/chat/completions');
  assert.strictEqual(seen[4].url, 'https://api.deepseek.com/v1/chat/completions');
  assert.strictEqual(seen[5].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.strictEqual(seen[5].headers['X-Title'], 'LifeLegend');
});

test('callOpenAICompatible : réessaie sans response_format si le serveur rejette json_object', async () => {
  const bodies = [];
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.response_format) {
      return new Response(JSON.stringify({ error: { message: 'json_object is not supported by this model' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"retried":true}' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const out = await complete({ provider: 'lmstudio', model: 'local-model' }, '', { system: 's', user: 'u' });
  assert.strictEqual(out, '{"retried":true}');
  assert.strictEqual(bodies.length, 2);
  assert.deepStrictEqual(bodies[0].response_format, { type: 'json_object' });
  assert.strictEqual(bodies[1].response_format, undefined);
});

test('parseJson : retire les blocs <think>…</think> et les clôtures markdown', () => {
  const raw = '<think>\nConsider {fake: 1} before replying.\n</think>\n```json\n{"headline":"Matchday","goals":2}\n```';
  assert.deepStrictEqual(parseJson(raw), { headline: 'Matchday', goals: 2 });
  assert.throws(() => parseJson('<think>{only:1}</think> no json outside'), AIError);
});

test('listModels : interroge Google, Anthropic, OpenAI/GitHub et Ollama (avec repli /api/tags)', async () => {
  await assert.rejects(listModels({ provider: 'unknown' }, ''), /Fournisseur inconnu/);
  await assert.rejects(listModels({ provider: 'openai' }, ''), /Aucune clé/);
  await assert.rejects(listModels({ provider: 'custom', baseUrl: '' }, ''), /Base URL/);

  global.fetch = async (url, init) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      assert.strictEqual(init.headers['x-goog-api-key'], 'gkey');
      return new Response(JSON.stringify({
        models: [
          { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent', 'countTokens'] },
        ],
      }), { status: 200 });
    }
    if (url === 'https://api.anthropic.com/v1/models') {
      assert.strictEqual(init.headers['x-api-key'], 'akey');
      assert.strictEqual(init.headers['anthropic-version'], '2023-06-01');
      return new Response(JSON.stringify({ data: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-haiku-5-5' }] }), { status: 200 });
    }
    if (url === 'https://models.inference.ai.azure.com/models') {
      assert.strictEqual(init.headers.Authorization, 'Bearer ghkey');
      return new Response(JSON.stringify([{ name: 'gpt-4.1' }, { name: 'Llama-3.3-70B-Instruct' }]), { status: 200 });
    }
    if (url === 'http://127.0.0.1:11434/v1/models') {
      return new Response('not found', { status: 404 });
    }
    if (url === 'http://127.0.0.1:11434/api/tags') {
      return new Response(JSON.stringify({ models: [{ name: 'qwen2.5:14b' }, { name: 'llama3.3' }] }), { status: 200 });
    }
    if (url === 'http://127.0.0.1:1234/v1/models') {
      return new Response(JSON.stringify({ data: [{ id: 'bartowski/Llama-3.3-70B-GGUF' }] }), { status: 200 });
    }
    throw new Error(`unexpected URL: ${url}`);
  };

  assert.deepStrictEqual(await listModels({ provider: 'google' }, 'gkey'), {
    models: ['gemini-2.5-flash-lite', 'gemini-3.6-flash'],
    source: 'live',
  });
  assert.deepStrictEqual(await listModels({ provider: 'anthropic' }, 'akey'), {
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
    source: 'live',
  });
  assert.deepStrictEqual(await listModels({ provider: 'github' }, 'ghkey'), {
    models: ['Llama-3.3-70B-Instruct', 'gpt-4.1'],
    source: 'live',
  });
  assert.deepStrictEqual(await listModels({ provider: 'ollama', baseUrl: '' }, ''), {
    models: ['llama3.3', 'qwen2.5:14b'],
    source: 'live',
  });
  assert.deepStrictEqual(await listModels({ provider: 'lmstudio', baseUrl: '' }, ''), {
    models: ['bartowski/Llama-3.3-70B-GGUF'],
    source: 'live',
  });
});
