const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { SALA, PUSH, DIA, pessoaId, tokDe } = require('./_mundo.cjs');

// ---------- o evento que o Firebase de mentira devolve ----------
/** "Ana, Bia e Caio" → ["Ana", "Bia", "Caio"] @param {string} t */
const nomes = (t) => t.split(/\s*,\s*|\s+e\s+/).filter(Boolean);
const gente = (ns) => ns.map((n) => ({ id: pessoaId(n), name: n }));

Given(/^o evento com (.+)$/, function (t) {
  this.sala = { name: 'churras', updatedAt: this.agora - 1000, people: gente(nomes(t)), expenses: [] };
});

/** "Ana 7,00, Bia 3,00" → { ana: 700, bia: 300 } (partes em centavos, como o app guarda) @param {string} t */
const partes = (t) =>
  Object.fromEntries([...t.matchAll(/(\w+) (\d+),(\d{2})/g)].map(([, n, r, c]) => [pessoaId(n), +r * 100 + +c]));

/** uma linha da tabela de lançamentos vira o que o Firebase guarda @param {Record<string, string>} l */
function lancamento(mundo, l) {
  const [por, soNome] = (l.por || '').split(/\s*\(só o nome\)/);
  const e = {
    id: l.id,
    amount: +l.valor,
    payer: pessoaId(l.pagou),
    among: nomes(l.para).map(pessoaId),
    at: mundo.instante(l.quando),
  };
  if (l.tipo === 'pagamento' || l.tipo === 'perdão') e.kind = 'payment';
  if (l.tipo === 'perdão') e.forgiven = true;
  if (por) {
    e.by = por;
    if (soNome === undefined) e.byId = pessoaId(por);
  }
  if (l.partes) e.shares = partes(l.partes);
  return e;
}
Given('que os lançamentos do evento são:', function (tabela) {
  for (const l of tabela.hashes()) this.sala.expenses.push(lancamento(this, l));
});
Given('que o lançamento {string} foi apagado', function (id) {
  (this.sala.deleted ||= []).push(id);
});
Given('que o evento foi mexido pela última vez em {word}', function (dia) {
  this.sala.updatedAt = this.instante(dia);
});
Given('que o Firebase devolve quem divide cada gasto como objeto de índices', function () {
  for (const e of this.sala.expenses) e.among = { ...e.among };
});
Given('que hoje é {word}', function (dia) {
  this.agora = this.instante(dia);
  this.agoraFixo = true;
});
Given('que o serviço de push responde que a inscrição morreu', function () {
  this.statusPush = 410;
});

// ---------- o app pede o aviso ----------
When('o app avisa do lançamento {string}', async function (id) {
  await this.pede('/avisa', { corpo: { sala: SALA, id } });
});
When('o app avisa de novo do lançamento {string}', async function (id) {
  await this.pede('/avisa', { corpo: { sala: SALA, id } });
});

// ---------- o que chegou no serviço de push ----------
const urls = (mundo) => mundo.enviados.map((e) => e.url).sort();
Then('a API diz que {int} pessoa(s) foi/foram avisada(s)', function (n) {
  assert.equal(this.resposta.corpo.avisados, n);
});
Then('o aviso vai só para o aparelho {int}', function (n) {
  assert.deepEqual(urls(this), [`${PUSH}${n}`]);
});
Then('o aviso vai para os aparelhos {int} e {int}', function (a, b) {
  assert.deepEqual(urls(this), [`${PUSH}${a}`, `${PUSH}${b}`].sort());
});
Then('nenhum aviso foi mandado', function () {
  assert.equal(this.enviados.length, 0);
});
Then('nenhum aviso novo foi mandado', function () {
  assert.equal(this.enviados.length, 1);
});
Then(/^(?:foi|foram) mandados? (\d+) avisos?(?: no total)?$/, function (n) {
  assert.equal(this.enviados.length, +n);
});
Then('o aviso foi mandado como o serviço de push exige', function () {
  const e = this.enviados[0];
  assert.equal(e.headers['Content-Length'], '0'); // o push vai vazio: o sw.js relê o evento
  assert.ok(+e.headers.TTL > 0);
  assert.match(e.headers.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${this.env.VAPID_PUBLIC}$`));
  assert.equal(e.body, undefined);
});
Then('a marca de aviso do lançamento {string} some em 1 dia', function (id) {
  assert.equal(this.env.KV.m.get(`avisado:${SALA}:${id}`).ttl, 86400);
});
Then('nada foi gravado no KV até agora', function () {
  assert.equal(this.env.KV.gravacoes, 0);
});

// ---------- a assinatura VAPID ----------
When('a API assina um aviso para {string} no instante {int}', async function (endpoint, agora) {
  const { jwt } = await import('../../src/vapid.js');
  this.jwt = await jwt(endpoint, this.env, agora);
  this.jwtAgora = agora;
});
const dec = async (x) => {
  const { deB64url } = await import('../../src/vapid.js');
  return JSON.parse(new TextDecoder().decode(deB64url(x)));
};
Then('o token é ES256 e diz quem manda, pra quem e até quando', async function () {
  const [c, p] = this.jwt.split('.');
  assert.deepEqual(await dec(c), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(await dec(p), {
    aud: 'https://fcm.googleapis.com',
    exp: this.jwtAgora + 12 * 3600,
    sub: 'https://tolisa.com.br',
  });
});
Then('a assinatura confere com a chave pública', async function () {
  const { deB64url } = await import('../../src/vapid.js');
  const [c, p, s] = this.jwt.split('.');
  const pub = await crypto.subtle.importKey('raw', deB64url(this.env.VAPID_PUBLIC), { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'verify',
  ]);
  assert.equal(deB64url(s).length, 64);
  assert.ok(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, deB64url(s), new TextEncoder().encode(`${c}.${p}`)),
  );
});

module.exports = { nomes, DIA };
