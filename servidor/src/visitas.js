// a página das visitas: o resumo do visitas/<dia> do banco, que o app soma (+1 por aparelho por dia) e ninguém lê.
// O nó não tem .read, então quem lê é a conta de serviço do Firebase (VISITAS_SA: uma conta só de leitura, papel "Firebase Realtime Database Viewer", e não a de admin que publica as regras).
//
//   GET  /visitas            → a página com o campo da chave (nada de número)
//   POST /visitas  chave=…   → a mesma página com o resumo
//
// A chave é o secret VISITAS_CHAVE do Worker (vem do secret de mesmo nome no GitHub, pelo servidor.yml). Ela vai no
// corpo do POST e não na URL, pra não ficar no histórico nem em log. Sem a chave ou sem a conta de serviço, 503.

import { b64url, deB64url } from './vapid.js';

const texto = new TextEncoder();
const CHAVE_MIN = 20; // chave curta se adivinha testando: menos que isso a página nem abre
const DIAS_NA_LISTA = 45;
const DIA = 86400 * 1000;
const BR = 3 * 3600 * 1000; // o dia das visitas é o de São Paulo, igual ao hojeBR do app.js

/** o token da conta de serviço dura uma hora: guarda enquanto o Worker vive @type {{ token: string, vence: number } | null} */
let guardado = null;

/** o access_token do Google pra conta de serviço (JWT RS256 assinado com a chave dela)
 * @param {{ client_email: string, private_key: string }} sa */
export async function tokenGoogle(sa, agora = Date.now()) {
  if (guardado && guardado.vence > agora + 60_000) return guardado.token;
  const der = deB64url(
    sa.private_key
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
      .replace(/\s+/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  );
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const s = Math.floor(agora / 1000);
  const parte = (/** @type {any} */ o) => b64url(texto.encode(JSON.stringify(o)));
  const corpo = `${parte({ alg: 'RS256', typ: 'JWT' })}.${parte({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    iat: s,
    exp: s + 3600,
  })}`;
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, texto.encode(corpo));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${corpo}.${b64url(assinatura)}`,
    }),
  });
  if (!r.ok) throw new Error(`token do Google: HTTP ${r.status}`);
  const { access_token, expires_in } = await r.json();
  guardado = { token: access_token, vence: agora + (Number(expires_in) || 3600) * 1000 };
  return access_token;
}
/** pros testes: esquece o token guardado */
export const esqueceToken = () => (guardado = null);

/** compara sem vazar pelo tempo quantas letras acertou @param {string} a @param {string} b */
async function igual(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', texto.encode(s))));
  const u = new Uint8Array(x),
    v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

/** o dia (AAAA-MM-DD) de São Paulo, `n` dias antes de `agora` */
const diaBR = (agora, n = 0) => new Date(agora - BR - n * DIA).toISOString().slice(0, 10);

/** o resumo das visitas: só dias no formato certo e números inteiros (o banco é hostil)
 * @param {any} cru o que veio do visitas.json @param {number} agora */
export function resumo(cru, agora = Date.now()) {
  /** @type {Record<string, number>} */
  const dias = {};
  if (cru && typeof cru === 'object')
    for (const [d, n] of Object.entries(cru))
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isInteger(n) && n > 0) dias[d] = n;
  const soma = (/** @type {number} */ de, /** @type {number} */ ate) => {
    let t = 0;
    for (let i = de; i < ate; i++) t += dias[diaBR(agora, i)] || 0;
    return t;
  };
  const ordem = Object.keys(dias).sort();
  /** @type {Record<string, number>} */
  const meses = {};
  for (const d of ordem) meses[d.slice(0, 7)] = (meses[d.slice(0, 7)] || 0) + dias[d];
  const melhor = ordem.reduce((m, d) => (!m || dias[d] > dias[m] ? d : m), '');
  return {
    hoje: dias[diaBR(agora)] || 0,
    ontem: dias[diaBR(agora, 1)] || 0,
    semana: soma(0, 7),
    semanaAntes: soma(7, 14),
    mes: soma(0, 30),
    total: ordem.reduce((t, d) => t + dias[d], 0),
    desde: ordem[0] || null,
    melhor: melhor ? { dia: melhor, n: dias[melhor] } : null,
    meses,
    ultimos: Array.from({ length: DIAS_NA_LISTA }, (_, i) => {
      const d = diaBR(agora, i);
      return { dia: d, n: dias[d] || 0 };
    }),
  };
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmt = (/** @type {string} */ d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const semana = (/** @type {string} */ d) => SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];
/** a variação da semana contra a anterior, em texto */
function variacao(agora, antes) {
  if (!antes) return agora ? 'primeira semana com visita' : 'nada nas duas semanas';
  const p = Math.round(((agora - antes) / antes) * 100);
  return `${p > 0 ? '+' : ''}${p}% contra a semana anterior (${antes})`;
}

const CSS = `
:root{--paper:#f6efdc;--ink:#2b2622;--ink2:#7a6f62;--wood:#5b3a22;--amber:#b86e00;--green:#2f7d4a}
@media (prefers-color-scheme:dark){:root{--paper:#1d1a17;--ink:#efe6d4;--ink2:#a69a88;--wood:#0f0d0b;--amber:#f0a640;--green:#6fcf8f}}
*{box-sizing:border-box}
body{margin:0;background:var(--wood);color:var(--ink);font:16px/1.35 ui-monospace,Menlo,Consolas,monospace;padding:24px 16px}
main{background:var(--paper);max-width:460px;margin:0 auto;padding:22px 18px 30px;box-shadow:0 14px 30px rgba(0,0,0,.35)}
h1{text-align:center;font-size:26px;margin:0 0 2px;letter-spacing:2px;text-transform:uppercase}
.c{text-align:center}.muted{color:var(--ink2)}
.hr{border-top:2px dashed var(--ink2);margin:16px 0}
h2{text-align:center;font-size:15px;letter-spacing:1px;margin:0 0 10px;text-transform:uppercase}
.row{display:flex;gap:6px;align-items:baseline;margin:3px 0}
.row .d{flex:1;border-bottom:2px dotted var(--ink2);transform:translateY(-4px)}
.big{font-size:44px;text-align:center;margin:4px 0 0;color:var(--amber)}
.dia{display:grid;grid-template-columns:7.5ch 3.5ch 1fr 4ch;gap:6px;align-items:center;margin:2px 0;font-size:14px}
.dia .b{height:10px;background:var(--amber);min-width:1px}
.dia.zero .b{background:none}.dia.fds{color:var(--ink2)}
.dia .n{text-align:right}
form{display:flex;flex-direction:column;gap:10px;margin-top:10px}
input,button{font:inherit;padding:10px;border:2px solid var(--ink);background:transparent;color:var(--ink)}
button{background:var(--ink);color:var(--paper);cursor:pointer}
.err{color:#c0392b;text-align:center}`;

/** a página inteira @param {string} miolo */
function pagina(miolo, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>visitas · tô lisa</title><style>${CSS}</style></head><body><main><h1>tô lisa</h1><div class="c muted">visitas</div><div class="hr"></div>${miolo}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}

const FORM = (erro = '') =>
  `${erro ? `<p class="err">${erro}</p>` : ''}<form method="post" action="/visitas"><input type="password" name="chave" placeholder="a chave" autocomplete="current-password" required autofocus><button>ver as visitas</button></form>`;

/** o resumo em html @param {ReturnType<typeof resumo>} r */
export function htmlResumo(r) {
  const linha = (/** @type {string} */ l, /** @type {string|number} */ v) =>
    `<div class="row"><span>${l}</span><span class="d"></span><span>${v}</span></div>`;
  const maior = Math.max(1, ...r.ultimos.map((u) => u.n));
  const dias = r.ultimos
    .map((u) => {
      const s = semana(u.dia);
      const cls = `dia${u.n ? '' : ' zero'}${s === 'sáb' || s === 'dom' ? ' fds' : ''}`;
      return `<div class="${cls}"><span>${fmt(u.dia)}</span><span>${s}</span><span class="b" style="width:${Math.round((u.n / maior) * 100)}%"></span><span class="n">${u.n}</span></div>`;
    })
    .join('');
  const meses = Object.entries(r.meses)
    .reverse()
    .map(([m, n]) => linha(`${m.slice(5, 7)}/${m.slice(0, 4)}`, n))
    .join('');
  return `<h2>*** últimos 7 dias ***</h2><div class="big">${r.semana}</div><div class="c muted">${variacao(r.semana, r.semanaAntes)}</div>
<div class="hr"></div>${linha('hoje', r.hoje)}${linha('ontem', r.ontem)}${linha('últimos 30 dias', r.mes)}${linha('desde o começo', r.total)}${
    r.melhor ? linha(`melhor dia (${fmt(r.melhor.dia)})`, r.melhor.n) : ''
  }${r.desde ? `<div class="c muted" style="margin-top:6px">contando desde ${fmt(r.desde)}/${r.desde.slice(0, 4)}</div>` : ''}
<div class="hr"></div><h2>*** dia a dia ***</h2>${dias}
${meses ? `<div class="hr"></div><h2>*** por mês ***</h2>${meses}` : ''}
<div class="hr"></div><div class="c muted" style="font-size:13px">aparelhos por dia: quem limpa o navegador conta de novo, e quem abre com ?naoconta não conta.</div>`;
}

/** @param {Request} req @param {{ FIREBASE_DB: string, VISITAS_SA?: string, VISITAS_CHAVE?: string }} env */
export async function visitas(req, env) {
  const chave = env.VISITAS_CHAVE || '';
  let sa = null;
  try {
    sa = JSON.parse(env.VISITAS_SA || 'null');
  } catch {}
  if (chave.length < CHAVE_MIN || !sa?.client_email || !sa?.private_key)
    return pagina('<p class="c">a página ainda não foi ligada: falta o VISITAS_CHAVE ou o VISITAS_SA no Worker.</p>', 503);
  if (req.method === 'GET') return pagina(FORM());
  if (req.method !== 'POST') return pagina(FORM(), 405);
  const t = await req.text();
  const tentou = t.length <= 512 ? new URLSearchParams(t).get('chave') || '' : '';
  if (!(await igual(tentou, chave))) {
    await new Promise((ok) => setTimeout(ok, 800)); // errou: devagar, pra testar chave no braço não render
    return pagina(FORM('chave errada'), 403);
  }
  try {
    const token = await tokenGoogle(sa);
    const r = await fetch(`${env.FIREBASE_DB}/visitas.json?access_token=${encodeURIComponent(token)}`);
    if (!r.ok) throw new Error(`banco: HTTP ${r.status}`);
    return pagina(htmlResumo(resumo(await r.json())));
  } catch (err) {
    console.error(err);
    return pagina('<p class="err">não consegui ler o banco agora. tenta de novo daqui a pouco.</p>', 502);
  }
}
