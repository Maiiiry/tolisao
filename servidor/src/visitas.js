// o painel do dono (tolisa.com.br/admin): o resumo do visitas/<dia>, que o app soma (+1 por aparelho por dia) e ninguém
// lê, e o que a busca de eventos precisa. O nó não tem .read, então quem lê é uma conta de serviço SÓ DE LEITURA
// (VISITAS_SA, papel "Firebase Realtime Database Viewer"; nunca a de admin que publica as regras).
//
//   POST /admin {chave}  → { resumo, banco, token, codigos }; 403 com a chave errada; 503 dizendo o que falta
//   GET  /visitas        → o endereço velho: manda pro tolisa.com.br/admin/
//
// A busca roda no navegador do dono: o token é de uma hora, da conta só de leitura, e o admin.js baixa o rooms.json
// direto do Firebase (no Worker, estouraria o tempo de CPU do plano grátis). O código do evento não fica no banco (a
// sala é o sha-256 dele): o link só volta quando o código é o nome (os eventos do começo) ou está numa lista guardada
// com a digital (KV digital:<id>; os códigos vão em `codigos`).
//
// A chave é o secret VISITAS_CHAVE do Worker (vem do secret de mesmo nome no GitHub, pelo servidor.yml). Ela vai no
// corpo do POST, nunca na URL, pra não ficar no histórico nem em log.
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

/** os códigos das listas guardadas com a digital (o KV digital:<id> é { eventos: [{ code, me }] }). Poucas passkeys
 * (é protótipo): lê até 40, pra não gastar o KV
 * @param {{ list(o: { prefix: string, cursor?: string }): Promise<{ keys: { name: string }[], list_complete: boolean, cursor?: string }>, get(k: string): Promise<string|null> } | undefined} kv */
export async function codigosDaDigital(kv) {
  if (!kv) return [];
  /** @type {Set<string>} */ const codigos = new Set();
  let cursor,
    lidas = 0;
  do {
    const r = await kv.list({ prefix: 'digital:', cursor });
    for (const k of r.keys) {
      if (lidas++ >= 40) break;
      try {
        const v = JSON.parse((await kv.get(k.name)) || 'null');
        for (const e of (v && Array.isArray(v.eventos) && v.eventos) || [])
          if (e && typeof e.code === 'string' && e.code && e.code.length <= 100) codigos.add(e.code);
      } catch {}
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor && lidas < 40);
  return [...codigos];
}

/** o que falta pro painel ligar, sem mostrar nada do valor: o dono confere o secret e roda o "Sobe a API" de novo
 * @param {{ VISITAS_SA?: string, VISITAS_CHAVE?: string }} env */
function faltando(env) {
  const chave = env.VISITAS_CHAVE || '';
  let sa = null;
  try {
    sa = JSON.parse(env.VISITAS_SA || 'null');
  } catch {}
  const falta = [
    !chave
      ? 'falta o VISITAS_CHAVE'
      : chave.length < CHAVE_MIN
        ? `o VISITAS_CHAVE tem ${chave.length} letras, e precisa de ${CHAVE_MIN} ou mais`
        : '',
    !env.VISITAS_SA
      ? 'falta o VISITAS_SA'
      : !sa
        ? 'o VISITAS_SA não é um JSON: cole o arquivo .json da chave inteiro, de { a }'
        : !sa.client_email || !sa.private_key
          ? 'o VISITAS_SA não tem client_email e private_key: é o .json da chave da conta de serviço'
          : '',
  ].filter(Boolean);
  return { falta, chave, sa };
}

/** POST /admin {chave}
 * @param {any} b @param {{ FIREBASE_DB: string, VISITAS_SA?: string, VISITAS_CHAVE?: string, KV?: any }} env
 * @param {(status: number, corpo: any) => Response} resp */
export async function admin(b, env, resp) {
  const { falta, chave, sa } = faltando(env);
  if (falta.length) return resp(503, { erro: `o painel ainda não foi ligado: ${falta.join('; ')}.` });
  const tentou = typeof b.chave === 'string' && b.chave.length <= 512 ? b.chave : '';
  if (!(await igual(tentou, chave))) {
    await new Promise((ok) => setTimeout(ok, 800)); // errou: devagar, pra testar chave no braço não render
    return resp(403, { erro: 'chave errada' });
  }
  try {
    const token = await tokenGoogle(sa);
    const r = await fetch(`${env.FIREBASE_DB}/visitas.json?access_token=${encodeURIComponent(token)}`);
    if (!r.ok) throw new Error(`banco: HTTP ${r.status}`);
    return resp(200, {
      resumo: resumo(await r.json()),
      banco: env.FIREBASE_DB,
      token,
      codigos: await codigosDaDigital(env.KV),
    });
  } catch (err) {
    console.error(err);
    return resp(502, { erro: 'não consegui ler o banco agora. tenta de novo daqui a pouco.' });
  }
}
