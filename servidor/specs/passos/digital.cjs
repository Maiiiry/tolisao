// uma passkey de mentira feita com o WebCrypto, que assina como o celular assinaria
const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { ORIGEM } = require('./_mundo.cjs');

const digitalApi = () => import('../../src/digital.js');
const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** r||s (o que o WebCrypto devolve) → DER (o que o autenticador manda) */
function cruPraDer(cru) {
  const inteiro = (v) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    v = v.subarray(i);
    if (v[0] & 0x80) v = Uint8Array.from([0, ...v]);
    return [0x02, v.length, ...v];
  };
  const corpo = [...inteiro(cru.subarray(0, 32)), ...inteiro(cru.subarray(32))];
  return Uint8Array.from([0x30, corpo.length, ...corpo]);
}

/** um celular com digital: cria a passkey e assina, com o que der pra estragar de propósito */
async function celular() {
  const { b64 } = await digitalApi();
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const id = b64(crypto.getRandomValues(new Uint8Array(16)));
  let contador = 0;
  const autenticador = async ({ rpId = 'tolisa.com.br', presente = true, conta = contador } = {}) => {
    const a = new Uint8Array(37);
    a.set(await sha(rpId));
    a[32] = (presente ? 0x01 : 0) | 0x04;
    new DataView(a.buffer).setUint32(33, conta);
    return a;
  };
  const dados = (tipo, d, origem = ORIGEM) =>
    new TextEncoder().encode(JSON.stringify({ type: tipo, challenge: d, origin: origem, crossOrigin: false }));
  return {
    id,
    set contador(n) {
      contador = n;
    },
    /** o que o app manda no "guardar com a digital" da primeira vez */
    async cria(d, o = {}) {
      return {
        id,
        chave: b64(await crypto.subtle.exportKey('spki', par.publicKey)),
        alg: -7,
        dados: b64(dados('webauthn.create', d, o.origem)),
        autenticador: b64(await autenticador(o)),
      };
    },
    /** o que o app manda no "entrar com a digital" */
    async assina(d, o = {}) {
      const cd = dados('webauthn.get', d, o.origem),
        a = await autenticador(o);
      const msg = new Uint8Array([...a, ...new Uint8Array(await crypto.subtle.digest('SHA-256', cd))]);
      const cru = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, msg));
      return { id, dados: b64(cd), autenticador: b64(a), assinatura: b64(cruPraDer(cru)) };
    },
  };
}

/** a tabela de eventos como a API guarda: "eu" vazio é ninguém @param {import('@cucumber/cucumber').DataTable} t */
const eventos = (t) => t.hashes().map((l) => ({ code: l['código'], me: l.eu || null }));
const desafio = async (mundo) => (await mundo.pede('/digital/desafio', { corpo: {} })).corpo.desafio;
const pedeDigital = (mundo, caminho, corpo, origem = ORIGEM) => mundo.pede(caminho, { corpo, origem });

Given('que meu celular tem uma digital', async function () {
  this.celular = await celular();
});
Given('que a digital guardou os eventos:', async function (tabela) {
  const r = await pedeDigital(this, '/digital/guarda', {
    ...(await this.celular.cria(await desafio(this))),
    eventos: eventos(tabela),
  });
  assert.equal(r.status, 201);
});
Given('que eu entrei com a digital', async function () {
  assert.equal((await pedeDigital(this, '/digital/entra', await this.celular.assina(await desafio(this)))).status, 200);
});

// ---------- entrar ----------
When('eu entro com a digital', async function () {
  this.gravacoesAntes = this.env.KV.gravacoes;
  this.corpoEntrada = await this.celular.assina(await desafio(this));
  await pedeDigital(this, '/digital/entra', this.corpoEntrada);
});
When('eu repito o mesmo pedido de entrada', async function () {
  await pedeDigital(this, '/digital/entra', this.corpoEntrada); // o desafio já foi gasto no primeiro
});
When('eu entro com a digital assinando com a chave de outro celular', async function () {
  const outro = await celular();
  await pedeDigital(this, '/digital/entra', { ...(await outro.assina(await desafio(this))), id: this.celular.id });
});
When('eu entro com a digital depois de mexer no contador já assinado', async function () {
  const { b64, deB64 } = await digitalApi();
  const p = await this.celular.assina(await desafio(this));
  const a = deB64(p.autenticador);
  a[36] = 9;
  await pedeDigital(this, '/digital/entra', { ...p, autenticador: b64(a) });
});
When('eu entro com a digital num desafio que a API nunca deu', async function () {
  const { b64 } = await digitalApi();
  await pedeDigital(this, '/digital/entra', await this.celular.assina(b64(new Uint8Array(32))));
});
When('eu entro com a digital num desafio de {int} minutos atrás', async function (min) {
  const d = await desafio(this);
  this.env.KV.poe(`desafio:${d}`, String(Date.now() - min * 60 * 1000));
  await pedeDigital(this, '/digital/entra', await this.celular.assina(d));
});
When('eu entro com a digital vindo de {string}', async function (origem) {
  await pedeDigital(this, '/digital/entra', await this.celular.assina(await desafio(this), { origem }));
});
When('eu entro com a digital de uma passkey do site {string}', async function (rpId) {
  await pedeDigital(this, '/digital/entra', await this.celular.assina(await desafio(this), { rpId }));
});
When('eu entro com a digital sem ninguém ter tocado no leitor', async function () {
  await pedeDigital(this, '/digital/entra', await this.celular.assina(await desafio(this), { presente: false }));
});
When('eu entro com a digital com o contador em {int}', async function (n) {
  await pedeDigital(this, '/digital/entra', await this.celular.assina(await desafio(this), { conta: n }));
});

// ---------- guardar ----------
When('eu peço um desafio', async function () {
  await desafio(this);
});
When('eu guardo a digital vindo de {string}', async function (origem) {
  this.desafio = await desafio(this);
  await pedeDigital(this, '/digital/guarda', { ...(await this.celular.cria(this.desafio, { origem })), eventos: [] });
});
When('eu guardo a digital de uma passkey do site {string}', async function (rpId) {
  await pedeDigital(this, '/digital/guarda', { ...(await this.celular.cria(await desafio(this), { rpId })), eventos: [] });
});
When('eu guardo a digital pelo {string} com a passkey de {string}', async function (origem, rpId) {
  await pedeDigital(
    this,
    '/digital/guarda',
    { ...(await this.celular.cria(await desafio(this), { origem, rpId })), eventos: [] },
    origem,
  );
});
When('eu guardo de novo, já com a digital cadastrada, os eventos:', async function (tabela) {
  await pedeDigital(this, '/digital/guarda', {
    ...(await this.celular.assina(await desafio(this))),
    eventos: eventos(tabela),
  });
});
When('eu cadastro a mesma passkey outra vez', async function () {
  await pedeDigital(this, '/digital/guarda', { ...(await this.celular.cria(await desafio(this))), eventos: [] });
});

/** cada defeito vira um jeito de estragar o pedido bom */
const DEFEITOS = {
  'um código de evento em maiúscula': (b) => ({ ...b, eventos: [{ code: 'Maiúscula', me: 'ana' }] }),
  'um "eu" com caractere estranho': (b) => ({ ...b, eventos: [{ code: 'ok', me: 'Ana!' }] }),
  'eventos que não são uma lista': (b) => ({ ...b, eventos: 'x' }),
  'mais de 100 eventos': (b) => ({ ...b, eventos: Array.from({ length: 101 }, (_, i) => ({ code: `e${i}`, me: null })) }),
  'um algoritmo que não é ES256': (b) => ({ ...b, alg: -257 }),
  'um id com ../': (b) => ({ ...b, id: '../x' }),
  'dados que não são base64': (b) => ({ ...b, dados: 'não é base64' }),
};
When('eu guardo a digital com {}', async function (defeito) {
  const estraga = DEFEITOS[defeito];
  assert.ok(estraga, `defeito desconhecido: ${defeito}`);
  const bom = { ...(await this.celular.cria(await desafio(this))), eventos: [{ code: 'churras-k7f3q9', me: 'ana' }] };
  await pedeDigital(this, '/digital/guarda', estraga(bom));
});

// ---------- o que a API devolve ----------
Then('a API recusa com {int} {string}', function (status, erro) {
  assert.deepEqual({ status: this.resposta.status, corpo: this.resposta.corpo }, { status, corpo: { erro } });
});
Then('a API responde {int} com {int} eventos', function (status, n) {
  assert.deepEqual({ status: this.resposta.status, corpo: this.resposta.corpo }, { status, corpo: { eventos: n } });
});
Then('voltam os eventos:', function (tabela) {
  assert.deepEqual(this.resposta.corpo.eventos, eventos(tabela));
});
Then('o desafio dura {int} segundos no KV', function (s) {
  assert.ok([...this.env.KV.m].some(([k, v]) => k.startsWith('desafio:') && v.ttl === s));
});
Then('o desafio foi gasto', async function () {
  assert.equal(await this.env.KV.get(`desafio:${this.desafio}`), null);
});
Then('só o desafio foi gravado no KV', function () {
  // o "eu entro" de agora gravou 1 coisa: o desafio novo (passkey sincronizada não anda o contador)
  assert.equal(this.env.KV.gravacoes - this.gravacoesAntes, 1);
});
Then('nenhuma digital foi cadastrada', function () {
  assert.equal([...this.env.KV.m.keys()].filter((k) => k.startsWith('digital:')).length, 0);
});
Then('uma assinatura em DER vira r||s, e uma torta é recusada', async function () {
  const { derPraCru } = await digitalApi();
  const r = new Uint8Array(32).fill(0x80),
    s = new Uint8Array(32).fill(1);
  s[0] = 0;
  const cru = new Uint8Array([...r, ...s]);
  assert.deepEqual(derPraCru(cruPraDer(cru)), cru);
  assert.equal(derPraCru(new Uint8Array([0x30, 2, 0, 0])), null);
});
Then('eventos repetidos na lista contam uma vez só', async function () {
  const { limpaEventos } = await digitalApi();
  assert.equal(
    limpaEventos([
      { code: 'a', me: 'b' },
      { code: 'a', me: 'c' },
    ]).length,
    1,
  );
});
