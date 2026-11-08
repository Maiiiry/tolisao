const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { SALA, DIA, pessoaId, tokDe, diaUtc } = require('./_mundo.cjs');

// ---------- o evento parado ----------
Given(
  'um evento parado em que a Ana pagou R$ {int} dividido com a Bia e ninguém mexe há {int} dias',
  function (valor, dias) {
    const at = this.agora - dias * DIA;
    this.sala = {
      name: 'churras',
      updatedAt: at,
      people: [
        { id: 'ana', name: 'Ana' },
        { id: 'bia', name: 'Bia' },
      ],
      expenses: [{ id: 'g1', amount: valor, payer: 'ana', among: ['ana', 'bia'], at }],
    };
  },
);
Given('{int} eventos em que a Ana está inscrita em {int} aparelhos', async function (eventos, aparelhos) {
  for (let i = 0; i < eventos; i++)
    for (let k = 0; k < aparelhos; k++)
      await this.inscreve('ana', k * 100 + i, tokDe('ana'), i.toString(16).padStart(64, '0'));
});

// ---------- o cron ----------
/** roda o cron como a Cloudflare roda (o trabalho vem pelo waitUntil); com "hoje é …" escolhido, chama direto com o relógio dele */
async function cron(mundo) {
  mundo.gravacoesAntes = mundo.env.KV.gravacoes;
  if (mundo.agoraFixo) {
    const { lembra } = await import('../../src/index.js');
    return (mundo.lembrados = await lembra(mundo.env, mundo.agora));
  }
  return (mundo.lembrados = await new Promise((ok) => mundo.api.scheduled({}, mundo.env, { waitUntil: ok })));
}
Given('que o cron das 19h rodou', async function () {
  await cron(this);
});
When('o cron das 19h roda', async function () {
  await cron(this);
});
Then('{int} pessoa(s) é/são lembrada(s)', function (n) {
  assert.equal(this.lembrados, n);
});
Then('alguém é lembrado', function () {
  assert.ok(this.lembrados > 0);
});
Then('o cron não gravou nada', function () {
  assert.equal(this.env.KV.gravacoes, this.gravacoesAntes);
});
Then('a API fez no máximo {int} chamadas externas', function (max) {
  assert.ok(this.lidas + this.enviados.length <= max, `${this.lidas} leituras + ${this.enviados.length} pushes`);
});
Then('a marca de lembrete da Ana dura {int} dias', function (dias) {
  assert.equal(this.env.KV.m.get(`lembrou:${SALA}:ana`).ttl, dias * 86400);
});
Then(/^(?:a|o) (\w+) não ganha marca de lembrete$/, function (nome) {
  assert.equal(this.env.KV.m.has(`lembrou:${SALA}:${pessoaId(nome)}`), false);
});
Then('a marca de mêsversário da Bia pra Ana dura {int} dias', function (dias) {
  const marca = [...this.env.KV.m.keys()].find((k) => k.startsWith(`niver:${SALA}:ana:bia:`));
  assert.ok(marca, 'não achei a marca niver:… da Bia pra Ana');
  assert.equal(this.env.KV.m.get(marca).ttl, dias * 86400);
});

// ---------- o saldo ----------
/** "-5,34" → -534 */
const centavos = (t) => Math.round(parseFloat(t.replace(',', '.')) * 100);
Then('os saldos são:', async function (tabela) {
  const { saldo } = await import('../../src/index.js');
  for (const { pessoa, saldo: esperado } of tabela.hashes())
    assert.equal(saldo(this.sala, pessoaId(pessoa)), centavos(esperado), pessoa);
});

// ---------- o mêsversário ----------
Then(
  'a dívida de {string} vista em {string} tem o último aniversário {string}',
  async function (comecou, hoje, esperado) {
    const { ultimoNiver } = await import('../../src/index.js');
    const n = ultimoNiver(this.instante(comecou), this.instante(hoje));
    if (esperado === 'nenhum') return assert.equal(n, null);
    const [, dia, resto] = esperado.match(/^(\S+) \((.+)\)$/);
    const meses = /15 dias/.test(resto) ? 0 : parseInt(resto);
    assert.deepEqual(n, { dia: diaUtc(dia), meses });
  },
);
Then(
  /^em (\S+) a Ana tem o mêsversário da dívida da Bia, o de (\d+) mês(?:es)?, de (\S+)$/,
  async function (hoje, meses, dia) {
    const { mesversarios } = await import('../../src/index.js');
    assert.deepEqual(mesversarios(this.sala, 'ana', this.instante(hoje)), [
      { devedor: 'bia', dia: diaUtc(dia), meses: +meses },
    ]);
  },
);
Then(/^em (\S+) (?:a|o) (\w+) não tem mêsversário$/, async function (hoje, nome) {
  const { mesversarios } = await import('../../src/index.js');
  assert.deepEqual(mesversarios(this.sala, pessoaId(nome), this.instante(hoje)), []);
});
When('a Bia paga o resto: R$ {int} pra Ana em {word}', function (valor, dia) {
  this.sala.expenses.push({
    id: 'pg2',
    kind: 'payment',
    amount: valor,
    payer: 'bia',
    among: ['ana'],
    at: this.instante(dia),
  });
});
