const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { SALA, PUSH, OUTRO_TOK, pessoaId, tokDe, sub } = require('./_mundo.cjs');

Given('a API no ar', function () {}); // o Before já subiu ela: o passo só deixa a feature dizer isso

// ---------- CORS e rotas ----------
When('eu peço a chave vindo de {string}', async function (origem) {
  await this.pede('/chave', { metodo: 'GET', origem });
});
When('eu peço a chave sem origem', async function () {
  await this.pede('/chave', { metodo: 'GET', origem: null });
});
When('eu pergunto de {string} o que a API aceita', async function (origem) {
  await this.pede('/chave', { metodo: 'OPTIONS', origem });
});
When(/^eu faço um GET em \/inscreve$/, async function () {
  await this.pede('/inscreve', { metodo: 'GET' });
});
When(/^eu mando um POST vazio em \/nada$/, async function () {
  await this.pede('/nada', { corpo: {} });
});
Then('a API responde {int}', function (status) {
  assert.equal(this.resposta.status, status, this.resposta.texto);
});
Then('a resposta libera a origem {string}', function (origem) {
  assert.equal(this.resposta.headers.get('Access-Control-Allow-Origin'), origem);
});
Then('a resposta não libera nenhuma origem', function () {
  assert.equal(this.resposta.headers.get('Access-Control-Allow-Origin'), null);
});
Then('a resposta permite POST', function () {
  assert.match(this.resposta.headers.get('Access-Control-Allow-Methods'), /POST/);
});
Then('a resposta traz a chave pública do aviso', function () {
  assert.deepEqual(this.resposta.corpo, { chave: this.env.VAPID_PUBLIC });
});

// ---------- pedidos tortos ----------
const VALIDO = { sala: SALA, pessoa: 'ana', tok: tokDe('ana'), push: `${PUSH}1` };
When(
  'eu me inscrevo com sala {string}, pessoa {string}, tok {string}, push {string} e chaves {string}',
  async function (sala, pessoa, tok, push, chaves) {
    const s = { endpoint: push === 'válido' ? VALIDO.push : push, keys: chaves === 'completas' ? sub().keys : undefined };
    await this.pede('/inscreve', {
      corpo: {
        sala: sala === 'válida' ? VALIDO.sala : sala,
        pessoa: pessoa === 'válida' ? VALIDO.pessoa : pessoa,
        tok: tok === 'válido' ? VALIDO.tok : tok,
        sub: s,
      },
    });
  },
);
When(/^eu mando em \/inscreve o texto "(.*)"$/, async function (texto) {
  await this.pede('/inscreve', { corpo: texto });
});
When(/^eu mando em \/inscreve um pedido de (\d+) letras$/, async function (n) {
  await this.pede('/inscreve', { corpo: { sala: SALA, lixo: 'x'.repeat(+n) } });
});
When('eu peço o aviso do lançamento {string}', async function (id) {
  await this.pede('/avisa', { corpo: { sala: SALA, id } });
});
Then('nada foi guardado no KV', function () {
  assert.equal(this.env.KV.m.size, 0);
});

// ---------- inscrever e sair ----------
When(/^(?:a|o) (\w+) se inscreve com o aparelho (\d+)$/, async function (nome, n) {
  await this.inscreve(pessoaId(nome), +n);
});
Given(/^que (?:a|o) (\w+) (?:já )?se inscreveu com o aparelho (\d+)$/, async function (nome, n) {
  await this.inscreve(pessoaId(nome), +n);
});
When(/^(?:a|o) (\w+) se inscreve com o aparelho (\d+) usando outro tok$/, async function (nome, n) {
  await this.inscreve(pessoaId(nome), +n, OUTRO_TOK);
});
When(/^(?:a|o) (\w+) se inscreve de novo com o aparelho (\d+)$/, async function (nome, n) {
  this.gravacoesAntes = this.env.KV.gravacoes;
  await this.inscreve(pessoaId(nome), +n);
});
When(/^(?:a|o) (\w+) se inscreve com os aparelhos de (\d+) a (\d+)$/, async function (nome, de, ate) {
  for (let n = +de; n <= +ate; n++) await this.inscreve(pessoaId(nome), n);
});
When(/^(?:a|o) (\w+) pede pra sair do aparelho (\d+) com (outro tok|o tok dela|o tok dele)$/, async function (nome, n, qual) {
  const id = pessoaId(nome);
  await this.pede('/desinscreve', {
    corpo: { sala: SALA, pessoa: id, endpoint: `${PUSH}${n}`, tok: qual === 'outro tok' ? OUTRO_TOK : tokDe(id) },
  });
});

const aparelhos = async (mundo, nome) =>
  (await mundo.env.KV.list({ prefix: `sub:${SALA}:${pessoaId(nome)}:` })).keys.map((k) => k.metadata?.endpoint);
Then(/^(?:a|o) (\w+) tem (\d+) aparelhos? inscritos?$/, async function (nome, n) {
  assert.equal((await aparelhos(this, nome)).length, +n);
});
Then(/^o aparelho (\d+) está entre eles$/, async function (n) {
  assert.ok((await aparelhos(this, 'ana')).includes(`${PUSH}${n}`));
});
Then(/^o aparelho (\d+) não está mais$/, async function (n) {
  assert.ok(!(await aparelhos(this, 'ana')).includes(`${PUSH}${n}`));
});
Then(/^o tok d[ao] (\w+) não fica guardado como foi enviado$/, function (nome) {
  const tok = tokDe(pessoaId(nome));
  assert.ok(![...this.env.KV.m.values()].some((x) => x.v.includes(tok)));
});
Then('nada foi gravado desde então', function () {
  assert.equal(this.env.KV.gravacoes, this.gravacoesAntes);
});
