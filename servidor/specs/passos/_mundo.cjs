// o mundo de cada cenário: a API com o KV, o Firebase, o serviço de push e o Google de mentira.
// Cada cenário nasce com tudo zerado (o Before) e devolve o fetch de verdade no fim (o After).
const { setWorldConstructor, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(15_000);

const SALA = 'a'.repeat(64);
const ORIGEM = 'https://tolisa.com.br';
const PUSH = 'https://push.exemplo.com/envio/';
const DIA = 86400 * 1000;

const pessoaId = (nome) => nome.toLowerCase();
/** o tok de cada pessoa: 16 a 64 letras e números, o que o app sorteia */
const tokDe = (id) => `tokde${id}`.padEnd(16, '0');
const OUTRO_TOK = 'outrotok12345678';
const sub = (n = 1) => ({ endpoint: `${PUSH}${n}`, keys: { p256dh: 'BOa_-1', auth: 'xyz' } });

/** KV em memória com o jeitão do da Cloudflare, contando as gravações (o plano grátis dá 1000 por dia) */
function kvFalso() {
  const m = new Map();
  return {
    m,
    gravacoes: 0,
    async get(k) {
      return m.has(k) ? m.get(k).v : null;
    },
    async put(k, v, o = {}) {
      this.gravacoes++;
      m.set(k, { v, metadata: o.metadata, ttl: o.expirationTtl });
    },
    async delete(k) {
      m.delete(k);
    },
    async list({ prefix }) {
      const keys = [...m].filter(([k]) => k.startsWith(prefix)).map(([name, { metadata }]) => ({ name, metadata }));
      return { keys, list_complete: true };
    },
    /** põe sem contar como gravação do app (é o cenário montando o estado) */
    poe(k, v) {
      m.set(k, { v });
    },
  };
}

/** a chave VAPID de verdade (P-256), uma vez só */
let vapid;
async function chavesVapid() {
  vapid ||= (async () => {
    const { b64url } = await import('../../src/vapid.js');
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', par.privateKey);
    return {
      VAPID_PRIVATE: JSON.stringify({ kty, crv, x, y, d }),
      VAPID_PUBLIC: b64url(await crypto.subtle.exportKey('raw', par.publicKey)),
    };
  })();
  return vapid;
}

/** uma conta de serviço com chave RSA de verdade, pra assinatura passar pelo WebCrypto */
let contaDeServico;
const contaDeServicoJson = () =>
  (contaDeServico ||= (async () => {
    const par = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', par.privateKey)).toString('base64');
    const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
    return JSON.stringify({ client_email: 'dono@projeto.iam.gserviceaccount.com', private_key: pem });
  })());

class Mundo {
  constructor() {
    this.sala = { name: 'churras', people: [], expenses: [] }; // o evento que o Firebase de mentira devolve
    this.enviados = []; // os pushes que chegaram no serviço de push
    this.pedidos = []; // tudo que a API pediu pra fora (Google, Firebase)
    this.lidas = 0; // quantas vezes a API leu uma sala no Firebase
    this.statusPush = 201;
    this.banco = {}; // visitas/<dia> do Firebase de mentira
    this.agora = Date.now();
    this.agoraFixo = false; // "hoje é 2026-04-01": o relógio que o cenário escolheu
    this.resposta = null;
  }

  async liga() {
    this.api = (await import('../../src/index.js')).default;
    this.env = {
      KV: kvFalso(),
      FIREBASE_DB: 'https://banco.exemplo.com',
      DIGITAL_ORIGENS: `${ORIGEM}, http://localhost:8000`,
      ...(await chavesVapid()),
    };
    (await import('../../src/visitas.js')).esqueceToken();
    this.fetchOriginal = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      this.pedidos.push({ url: u, init });
      if (u.startsWith(`${this.env.FIREBASE_DB}/rooms/`)) {
        this.lidas++;
        return Response.json(this.sala);
      }
      if (u.startsWith(PUSH)) {
        this.enviados.push({ url: u, headers: init.headers, body: init.body });
        return new Response(null, { status: this.statusPush });
      }
      if (u.startsWith('https://oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({ access_token: 'tok-google', expires_in: 3600 }));
      if (u.startsWith(`${this.env.FIREBASE_DB}/visitas.json?`)) return new Response(JSON.stringify(this.banco));
      throw new Error(`fetch inesperado: ${u}`);
    };
  }

  desliga() {
    if (this.fetchOriginal) globalThis.fetch = this.fetchOriginal;
  }

  /** um pedido à API; guarda a resposta em this.resposta */
  async pede(caminho, { metodo = 'POST', corpo, origem = ORIGEM } = {}) {
    const r = await this.api.fetch(
      new Request(`https://api.exemplo.com${caminho}`, {
        method: metodo,
        headers: { ...(origem ? { Origin: origem } : {}), 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      }),
      this.env,
    );
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    return (this.resposta = { status: r.status, headers: r.headers, corpo: json, texto });
  }

  /** o aparelho `n` de `pessoa` se inscreve no aviso */
  inscreve(pessoa, n, tok = tokDe(pessoa), sala = SALA) {
    return this.pede('/inscreve', { corpo: { sala, pessoa, sub: sub(n), tok } });
  }

  /** o instante de "há 8 dias", "há 1 segundo" ou de uma data (meio-dia em Brasília) @param {string} q */
  instante(q) {
    const m = q.match(/^há (\d+) (segundos?|minutos?|dias?)$/);
    if (m) return this.agora - +m[1] * { s: 1000, m: 60_000, d: DIA }[m[2][0]];
    return brasilia(q);
  }
}

/** "2026-03-01" é meio-dia em Brasília; "2026-03-01 22:00" é a hora dita @param {string} d */
function brasilia(d) {
  const [dia, hora = '12:00'] = d.split(' ');
  return Date.parse(`${dia}T${hora}:00-03:00`);
}
/** a meia-noite UTC do dia (aaaa-mm-dd), que é como a API conta o dia de Brasília */
const diaUtc = (d) => Date.parse(`${d}T00:00:00Z`);

setWorldConstructor(Mundo);
Before(async function () {
  await this.liga();
});
After(function () {
  this.desliga();
});

module.exports = { SALA, ORIGEM, PUSH, DIA, OUTRO_TOK, pessoaId, tokDe, sub, brasilia, diaUtc, contaDeServicoJson };
