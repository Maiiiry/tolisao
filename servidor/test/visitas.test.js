// o painel do dono (POST /admin), com o Google e o Firebase de mentira. roda com `node --test`.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/index.js';
import { resumo, esqueceToken } from '../src/visitas.js';

const CHAVE = 'uma-chave-comprida-de-verdade-123';
const BASE = 'https://tolisa-api.exemplo.workers.dev';
const ORIGEM = 'https://tolisa.com.br';
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

/** KV com as listas da digital */
const kvCom = (m) => ({
  async list({ prefix }) {
    return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  },
  async get(k) {
    return m.get(k) ?? null;
  },
});

beforeEach(async () => {
  esqueceToken();
  env = { FIREBASE_DB: 'https://banco.exemplo.com', VISITAS_SA: await sa, VISITAS_CHAVE: CHAVE, KV: kvCom(new Map()) };
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

const posta = (chave, e = env) =>
  api.fetch(
    new Request(`${BASE}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGEM },
      body: JSON.stringify({ chave }),
    }),
    e,
  );

test('com a chave certa devolve o resumo, o token da conta de serviço e os códigos da digital', async () => {
  env.KV = kvCom(
    new Map([
      ['digital:p1', JSON.stringify({ eventos: [{ code: 'aspirador-k7f3q9', me: 'eu' }, { code: 'x'.repeat(200) }] })],
      ['digital:p2', 'lixo'],
      ['outra:coisa', '{}'],
    ]),
  );
  const r = await posta(CHAVE);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGEM);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  const d = await r.json();
  assert.equal(d.resumo.total, 6);
  assert.equal(d.banco, 'https://banco.exemplo.com');
  assert.equal(d.token, 'tok-google');
  assert.deepEqual(d.codigos, ['aspirador-k7f3q9']);
  const token = pedidos.find((p) => p.url.startsWith('https://oauth2.googleapis.com/token'));
  assert.equal(new URLSearchParams(token.init.body).get('assertion').split('.').length, 3);
  assert.ok(pedidos.some((p) => p.url === 'https://banco.exemplo.com/visitas.json?access_token=tok-google'));
});

test('chave errada não lê o banco nem devolve token', async () => {
  const r = await posta('quase-a-chave-mas-nao');
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { erro: 'chave errada' });
  assert.equal(pedidos.length, 0);
});

test('sem os secrets certos, o painel fica desligado e diz o que falta', async () => {
  for (const [falta, diz] of [
    [{ VISITAS_CHAVE: '' }, /falta o VISITAS_CHAVE/],
    [{ VISITAS_CHAVE: 'curta' }, /tem 5 letras/],
    [{ VISITAS_SA: '' }, /falta o VISITAS_SA/],
    [{ VISITAS_SA: 'não é json' }, /não é um JSON/],
    [{ VISITAS_SA: '{"type":"service_account"}' }, /não tem client_email/],
  ]) {
    const r = await posta(CHAVE, { ...env, ...falta });
    assert.equal(r.status, 503);
    assert.match((await r.json()).erro, diz);
  }
});

test('o token do Google é reaproveitado entre as entradas no painel', async () => {
  await posta(CHAVE);
  await posta(CHAVE);
  assert.equal(pedidos.filter((p) => p.url.startsWith('https://oauth2')).length, 1);
});

test('o endereço velho da página manda pro painel no site', async () => {
  const r = await api.fetch(new Request(`${BASE}/visitas`), env);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('Location'), 'https://tolisa.com.br/admin/');
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
