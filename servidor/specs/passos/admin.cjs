const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { ORIGEM, contaDeServicoJson } = require('./_mundo.cjs');

const CHAVE = 'uma-chave-comprida-de-verdade-123';

Given('que o painel do dono está ligado', async function () {
  this.env.VISITAS_SA = await contaDeServicoJson();
  this.env.VISITAS_CHAVE = CHAVE;
});
Given('que o banco tem visitas:', function (tabela) {
  this.banco = Object.fromEntries(
    tabela.hashes().map(({ dia, visitas }) => [dia, /^-?\d+$/.test(visitas) ? +visitas : visitas]),
  );
});

// ---------- o que o KV guardou da digital (de onde vêm os códigos que a busca recupera) ----------
Given('que um aparelho guardou na digital o evento {string}', function (code) {
  this.env.KV.poe('digital:p1', JSON.stringify({ eventos: [{ code, me: 'eu' }] }));
});
Given('que outro aparelho guardou na digital uma lista estragada', function () {
  this.env.KV.poe('digital:p2', 'lixo');
});
Given('que um aparelho guardou na digital um código de {int} letras', function (n) {
  this.env.KV.poe('digital:p3', JSON.stringify({ eventos: [{ code: 'x'.repeat(n) }] }));
});
Given('que o KV tem uma chave que não é da digital', function () {
  this.env.KV.poe('outra:coisa', '{}');
});

// ---------- os secrets ----------
const ESTADOS = {
  vazio: '',
  'com 5 letras': 'curta',
  'que não é JSON': 'não é json',
  'sem client_email': '{"type":"service_account"}',
};
Given('que o secret {word} está {}', function (secret, estado) {
  assert.ok(estado in ESTADOS, `estado desconhecido: ${estado}`);
  this.env[secret] = ESTADOS[estado];
});

// ---------- entrar no painel ----------
const entra = (mundo, chave) => mundo.pede('/admin', { corpo: { chave } });
When('eu entro no painel com a chave certa', async function () {
  await entra(this, CHAVE);
});
When('eu entro no painel com a chave {string}', async function (chave) {
  await entra(this, chave);
});
When(/^eu abro o endereço velho \/visitas$/, async function () {
  const r = await this.api.fetch(new Request('https://tolisa-api.exemplo.workers.dev/visitas'), this.env);
  this.resposta = { status: r.status, headers: r.headers };
});

Then('o painel devolve o resumo dos últimos 15 dias do banco {string}', function (banco) {
  const d = this.resposta.corpo;
  assert.equal(d.resumo.ultimos.length, 15);
  assert.equal(d.banco, banco);
});
Then('o painel entrega o token {string} da conta de serviço', function (token) {
  assert.equal(this.resposta.corpo.token, token);
});
Then('os códigos recuperáveis são {string}', function (codigos) {
  assert.deepEqual(this.resposta.corpo.codigos, codigos.split(', '));
});
Then('a resposta libera {string} e não fica em cache', function (origem) {
  assert.equal(this.resposta.headers.get('Access-Control-Allow-Origin'), origem);
  assert.equal(this.resposta.headers.get('Cache-Control'), 'no-store');
});
Then('a conta de serviço assinou o pedido do token', function () {
  const pedido = this.pedidos.find((p) => p.url.startsWith('https://oauth2.googleapis.com/token'));
  assert.equal(new URLSearchParams(pedido.init.body).get('assertion').split('.').length, 3); // JWT RS256
});
Then('o painel leu o banco só dos últimos 15 dias, com o token', function () {
  const lida = new URL(this.pedidos.find((p) => p.url.includes('/visitas.json')).url);
  assert.equal(lida.searchParams.get('orderBy'), '"$key"');
  assert.match(lida.searchParams.get('startAt'), /^"\d{4}-\d{2}-\d{2}"$/);
  assert.match(lida.searchParams.get('endAt'), /^"\d{4}-\d{2}-\d{2}"$/);
  assert.equal(lida.searchParams.get('access_token'), 'tok-google');
});
Then('a API não pediu nada pra fora', function () {
  assert.equal(this.pedidos.length, 0);
});
Then('o aviso do painel diz {string}', function (diz) {
  assert.ok(this.resposta.corpo.erro.includes(diz), this.resposta.corpo.erro);
});
Then('a API pediu o token ao Google {int} vez', function (n) {
  assert.equal(this.pedidos.filter((p) => p.url.startsWith('https://oauth2')).length, n);
});
Then('ela manda pra {string}', function (url) {
  assert.equal(this.resposta.headers.get('Location'), url);
});

// ---------- o resumo (a conta, sem passar pela API) ----------
When('o resumo é feito em {string}', async function (iso) {
  const { resumo } = await import('../../src/visitas.js');
  this.resumo = resumo(this.banco, Date.parse(iso));
});
Then('o resumo diz:', function (tabela) {
  const chaves = { hoje: 'hoje', ontem: 'ontem', semana: 'semana', 'semana antes': 'semanaAntes', quinzena: 'quinzena' };
  for (const { campo, valor } of tabela.hashes()) assert.equal(this.resumo[chaves[campo]], +valor, campo);
});
Then('o melhor dia foi {string} com {int} visitas', function (dia, n) {
  assert.deepEqual(this.resumo.melhor, { dia, n });
});
Then(
  'a lista vai de {string} com {int} visitas até {string} com {int} visitas, em {int} dias',
  function (d1, n1, d2, n2, total) {
    const u = this.resumo.ultimos;
    assert.equal(u.length, total);
    assert.deepEqual(u[0], { dia: d1, n: n1 });
    assert.deepEqual(u[total - 1], { dia: d2, n: n2 });
  },
);
