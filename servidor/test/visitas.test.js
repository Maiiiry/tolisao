// a página das visitas, com o Google e o Firebase de mentira. roda com `node --test`.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/index.js';
import { resumo, esqueceToken } from '../src/visitas.js';

const CHAVE = 'uma-chave-comprida-de-verdade-123';
const BASE = 'https://tolisa-api.exemplo.workers.dev';
let env, fetchOriginal, pedidos, banco;

/** uma conta de serviço com chave RSA de verdade, pra assinatura passar pelo WebCrypto */
async function contaDeServico() {
  const par = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', par.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({ client_email: 'dono@projeto.iam.gserviceaccount.com', private_key: pem });
}
const sa = contaDeServico();

beforeEach(async () => {
  esqueceToken();
  env = { FIREBASE_DB: 'https://banco.exemplo.com', VISITAS_SA: await sa, VISITAS_CHAVE: CHAVE };
  pedidos = [];
  banco = { '2026-11-06': 4, '2026-11-07': 2 };
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    pedidos.push({ url: String(url), init });
    if (String(url).startsWith('https://oauth2.googleapis.com/token'))
      return new Response(JSON.stringify({ access_token: 'tok-google', expires_in: 3600 }));
    if (String(url).startsWith('https://banco.exemplo.com/visitas.json')) return new Response(JSON.stringify(banco));
    return new Response('?', { status: 404 });
  };
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const posta = (chave, origem = BASE) =>
  api.fetch(
    new Request(`${BASE}/visitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origem },
      body: new URLSearchParams({ chave }),
    }),
    env,
  );

test('sem chave a página só pede a chave, e nada de número', async () => {
  const r = await api.fetch(new Request(`${BASE}/visitas`), env);
  assert.equal(r.status, 200);
  const h = await r.text();
  assert.match(h, /type="password"/);
  assert.doesNotMatch(h, /dia a dia/);
  assert.equal(pedidos.length, 0);
});

test('com a chave certa lê o banco pela conta de serviço e mostra o resumo', async () => {
  const r = await posta(CHAVE);
  assert.equal(r.status, 200);
  const h = await r.text();
  assert.match(h, /dia a dia/);
  assert.match(h, /desde o começo<\/span><span class="d"><\/span><span>6</);
  const token = pedidos.find((p) => p.url.startsWith('https://oauth2.googleapis.com/token'));
  const jwt = new URLSearchParams(token.init.body).get('assertion');
  assert.equal(jwt.split('.').length, 3);
  assert.ok(pedidos.some((p) => p.url === 'https://banco.exemplo.com/visitas.json?access_token=tok-google'));
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});

test('chave errada não lê o banco', async () => {
  const r = await posta('quase-a-chave-mas-nao');
  assert.equal(r.status, 403);
  assert.match(await r.text(), /chave errada/);
  assert.equal(pedidos.length, 0);
});

test('sem a chave ou a conta de serviço no Worker, a página fica desligada', async () => {
  for (const [falta, diz] of [
    [{ VISITAS_CHAVE: '' }, /falta o VISITAS_CHAVE/],
    [{ VISITAS_CHAVE: 'curta' }, /tem 5 letras/],
    [{ VISITAS_SA: '' }, /falta o VISITAS_SA/],
    [{ VISITAS_SA: 'não é json' }, /não é um JSON/],
    [{ VISITAS_SA: '{"type":"service_account"}' }, /não tem client_email/],
  ]) {
    const r = await api.fetch(new Request(`${BASE}/visitas`), { ...env, ...falta });
    assert.equal(r.status, 503);
    assert.match(await r.text(), diz);
  }
});

test('o token do Google é reaproveitado entre as visitas à página', async () => {
  await posta(CHAVE);
  await posta(CHAVE);
  assert.equal(pedidos.filter((p) => p.url.startsWith('https://oauth2')).length, 1);
});

test('o resumo conta semana, mês e melhor dia, e ignora o que não é visita', () => {
  const agora = Date.parse('2026-11-07T15:00:00Z'); // meio-dia em São Paulo
  const r = resumo(
    {
      '2026-11-07': 3,
      '2026-11-01': 5,
      '2026-10-30': 2, // semana anterior
      '2026-09-01': 10,
      lixo: 99,
      '2026-11-02': -4,
      '2026-11-03': 'x',
    },
    agora,
  );
  assert.equal(r.hoje, 3);
  assert.equal(r.semana, 8);
  assert.equal(r.semanaAntes, 2);
  assert.equal(r.mes, 10);
  assert.equal(r.total, 20);
  assert.deepEqual(r.melhor, { dia: '2026-09-01', n: 10 });
  assert.equal(r.desde, '2026-09-01');
  assert.deepEqual(r.meses, { '2026-09': 10, '2026-10': 2, '2026-11': 8 });
  assert.equal(r.ultimos[0].dia, '2026-11-07');
});

test('o dia vira à meia-noite de São Paulo, não de Greenwich', () => {
  const r = resumo({ '2026-11-06': 1, '2026-11-07': 9 }, Date.parse('2026-11-07T02:00:00Z')); // 23h do dia 6 em SP
  assert.equal(r.hoje, 1);
});

test('com a chave certa a página traz a busca, com o script liberado só pelo nonce e os códigos da digital', async () => {
  const kv = new Map([
    ['digital:p1', JSON.stringify({ eventos: [{ code: 'aspirador-k7f3q9', me: 'eu' }, { code: 'x'.repeat(200) }] })],
    ['digital:p2', 'lixo'],
    ['outra:coisa', '{}'],
  ]);
  env.KV = {
    async list({ prefix }) {
      return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    },
    async get(k) {
      return kv.get(k) ?? null;
    },
  };
  const r = await posta(CHAVE);
  const h = await r.text();
  const csp = r.headers.get('Content-Security-Policy');
  const nonce = csp.match(/'nonce-([\w-]+)'/)[1];
  assert.match(h, new RegExp(`<script nonce="${nonce}">`));
  assert.match(csp, /connect-src https:\/\/banco\.exemplo\.com;/);
  assert.match(h, /id="busca"/);
  const dados = JSON.parse(h.match(/<script type="application\/json" id="buscaDados">(.*?)<\/script>/)[1]);
  assert.deepEqual(dados, { banco: 'https://banco.exemplo.com', token: 'tok-google', codigos: ['aspirador-k7f3q9'] });
});

test('sem a chave a página não leva token nem script', async () => {
  const r = await api.fetch(new Request(`${BASE}/visitas`), env);
  assert.doesNotMatch(r.headers.get('Content-Security-Policy'), /script-src/);
  assert.doesNotMatch(await r.text(), /buscaDados|tok-google/);
});
