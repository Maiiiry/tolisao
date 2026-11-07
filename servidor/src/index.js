// a API do tô lisa: aviso no celular quando alguém marca que te pagou (#89) ou anota um gasto com você.
// Worker da Cloudflare, só API web padrão, nenhuma dependência em produção.
//
//   GET  /chave                                → a chave pública VAPID (base64url), pro pushManager.subscribe
//   POST /inscreve   {sala, pessoa, sub, tok}  → guarda a inscrição de push desse aparelho
//   POST /desinscreve {sala, pessoa, endpoint, tok}
//   POST /avisa      {sala, id}                → relê a sala no Firebase e avisa quem recebeu (ou quem foi perdoado),
//                                                ou, no gasto novo, quem divide e quem pagou
//   POST /digital/…                             → entrar com a digital (passkey, #168): ver digital.js
//   GET|POST /visitas                          → a página do dono com o resumo das visitas, atrás de chave: ver visitas.js
//   cron todo dia, 19h de Brasília             → a diva cobra sozinha: lembra quem tem a receber em evento parado,
//                                                e no mêsversário da dívida (15 dias, depois todo mês) avisa quem recebe
//
// O corpo nunca é confiável além dos ids: o /avisa lê o pagamento do próprio banco.
// O banco (KV) é contado: o plano grátis dá 1000 gravações por dia, então só se grava o necessário.
//   sub:<sala>:<pessoa>:<hash do endpoint>  a inscrição (JSON); o endpoint vai também no metadata, pro list bastar
//   tok:<sala>:<pessoa>                     sha-256 do tok: quem inscreveu primeiro manda (igual ao tok do pix)
//   avisado:<sala>:<id>                     esse pagamento (ou gasto) já avisou (some sozinho em 1 dia)
//   lembrou:<sala>:<pessoa>                 o lembrete do evento parado já foi (some sozinho em 7 dias)
//   niver:<sala>:<pessoa>:<devedor>:<dia>    o mêsversário dessa dívida já foi avisado (some sozinho em 8 dias)

import { empurra } from './vapid.js';
import * as digital from './digital.js';
import { visitas } from './visitas.js';

const SALA = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]{1,32}$/;
const TOK = /^[a-z0-9]{16,64}$/;
const MAX_CORPO = 4096;
const MAX_CORPO_DIGITAL = 16384; // a lista de eventos (até 100) e o que a passkey assinou
const MAX_POR_PESSOA = 5;
const JANELA_MS = 10 * 60 * 1000;
const PARADO_MS = 7 * 86400 * 1000; // o PARADO_DIAS do app.js: evento sem mudança há uma semana
const DIA = 86400 * 1000;
const BR = 3 * 3600 * 1000; // Brasília, sem horário de verão desde 2019: o dia da dívida é o de lá
const NIVER_DIAS = 15; // o primeiro aniversário da dívida; depois dele, todo mês no mesmo dia
const NIVER_PRAZO = 7; // dias: o cron não lê toda sala todo dia, então o aniversário ainda avisa até uma semana depois
// plano grátis: 50 fetch por execução (o KV tem teto à parte). cada sala gasta 1 leitura do banco e 1 por push
const FETCH_POR_VEZ = 45;

/** @typedef {{ get(k: string): Promise<string|null>, put(k: string, v: string, o?: { expirationTtl?: number, metadata?: any }): Promise<void>, delete(k: string): Promise<void>, list(o: { prefix: string, cursor?: string }): Promise<{ keys: { name: string, metadata?: any }[], list_complete: boolean, cursor?: string }> }} KV */
/** @typedef {{ KV: KV, FIREBASE_DB: string, VAPID_PUBLIC: string, VAPID_PRIVATE: string, VAPID_SUB?: string, DIGITAL_ORIGENS?: string, VISITAS_SA?: string, VISITAS_CHAVE?: string }} Env */

/** @param {string | null} origem */
export function origemOk(origem) {
  return (
    origem === 'https://tolisa.com.br' || (!!origem && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origem))
  );
}

/** @param {string | null} origem */
function cors(origem) {
  if (!origemOk(origem)) return {};
  return {
    'Access-Control-Allow-Origin': /** @type {string} */ (origem),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** @param {number} status @param {any} corpo @param {string | null} origem */
function json(status, corpo, origem) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origem) },
  });
}

/** @param {string} s */
async function sha256(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {Request} req */
async function corpo(req, max = MAX_CORPO) {
  const t = await req.text();
  if (t.length > max) return null;
  try {
    const o = JSON.parse(t);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/** a PushSubscription como o navegador manda: só o que serve, e só https */
function limpaSub(s) {
  if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || s.endpoint.length > 800) return null;
  let u;
  try {
    u = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const k = s.keys;
  const b64 = /^[A-Za-z0-9_-]{1,200}={0,2}$/;
  if (!k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || !b64.test(k.p256dh) || !b64.test(k.auth))
    return null;
  return { endpoint: s.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } };
}

/** @param {KV} kv @param {string} prefixo */
async function lista(kv, prefixo) {
  const todas = [];
  let cursor;
  do {
    const r = await kv.list({ prefix: prefixo, cursor });
    todas.push(...r.keys);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return todas;
}

/** confere o tok de (sala, pessoa); `grava` guarda o primeiro. Devolve false se o tok não bate. */
async function confereTok(env, sala, pessoa, tok, grava) {
  const chave = `tok:${sala}:${pessoa}`;
  const h = await sha256(tok);
  const guardado = await env.KV.get(chave);
  if (guardado) return guardado === h;
  if (!grava) return false;
  await env.KV.put(chave, h);
  return true;
}

/** @param {any} b @param {Env} env @param {string | null} o */
async function inscreve(b, env, o) {
  const sub = limpaSub(b.sub);
  if (!SALA.test(b.sala) || !ID.test(b.pessoa) || !TOK.test(b.tok) || !sub)
    return json(400, { erro: 'pedido torto' }, o);
  if (!(await confereTok(env, b.sala, b.pessoa, b.tok, true))) return json(403, { erro: 'tok não bate' }, o);
  const prefixo = `sub:${b.sala}:${b.pessoa}:`;
  const chave = prefixo + (await sha256(sub.endpoint)).slice(0, 32);
  const valor = JSON.stringify(sub);
  if ((await env.KV.get(chave)) === valor) return json(200, { ok: true }, o); // já tá: não gasta gravação
  const outras = (await lista(env.KV, prefixo)).filter((k) => k.name !== chave);
  // passou do teto: sai a mais velha
  outras.sort((a, b) => (a.metadata?.em || 0) - (b.metadata?.em || 0));
  for (const k of outras.slice(0, Math.max(0, outras.length - MAX_POR_PESSOA + 1))) await env.KV.delete(k.name);
  await env.KV.put(chave, valor, { metadata: { endpoint: sub.endpoint, em: Date.now() } });
  return json(201, { ok: true }, o);
}

/** @param {any} b @param {Env} env @param {string | null} o */
async function desinscreve(b, env, o) {
  if (
    !SALA.test(b.sala) ||
    !ID.test(b.pessoa) ||
    !TOK.test(b.tok) ||
    typeof b.endpoint !== 'string' ||
    b.endpoint.length > 800
  )
    return json(400, { erro: 'pedido torto' }, o);
  if (!(await confereTok(env, b.sala, b.pessoa, b.tok, false))) return json(403, { erro: 'tok não bate' }, o);
  await env.KV.delete(`sub:${b.sala}:${b.pessoa}:${(await sha256(b.endpoint)).slice(0, 32)}`);
  return json(200, { ok: true }, o);
}

/** a lista do Firebase vem como array ou como objeto de índices */
const valores = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []).filter(Boolean);

/** @param {any} b @param {Env} env @param {string | null} o */
async function avisa(b, env, o) {
  if (!SALA.test(b.sala) || !ID.test(b.id)) return json(400, { erro: 'pedido torto' }, o);
  const r = await fetch(`${env.FIREBASE_DB}/rooms/${b.sala}.json`, { cache: 'no-store' });
  if (!r.ok) return json(502, { erro: 'banco fora' }, o);
  const sala = await r.json().catch(() => null);
  const e = valores(sala?.expenses).find((x) => x.id === b.id);
  const agora = Date.now();
  const pago = e?.kind === 'payment',
    gasto = !!e && e.kind === undefined && !valores(sala?.deleted).includes(e.id);
  if (!(pago || gasto) || typeof e.at !== 'number' || agora - e.at > JANELA_MS || e.at - agora > 60000)
    return json(404, { erro: 'não achado' }, o);
  // o perdão avisa quem devia; o pagamento avisa quem recebe; o gasto novo avisa quem divide e quem pagou
  const alvos = pago ? [e.forgiven === true ? e.payer : valores(e.among)[0]] : [...valores(e.among), e.payer];
  if (pago && (typeof alvos[0] !== 'string' || !ID.test(alvos[0]))) return json(404, { erro: 'não achado' }, o);
  // quem marcou ou anotou não precisa ser avisado do que ele mesmo fez
  const nome = (id) => valores(sala.people).find((p) => p.id === id)?.name;
  const avisar = new Set(
    alvos.filter((id) => typeof id === 'string' && ID.test(id) && id !== e.byId && !(e.by && nome(id) === e.by)),
  );
  if (!avisar.size) return json(200, { avisados: 0 }, o);
  // uma listagem só pra sala (o plano grátis conta as listagens), e o teto de fetch por execução
  const subs = (await lista(env.KV, `sub:${b.sala}:`))
    .filter((k) => avisar.has(k.name.split(':')[2]))
    .slice(0, FETCH_POR_VEZ);
  if (!subs.length) return json(200, { avisados: 0 }, o);
  const marca = `avisado:${b.sala}:${b.id}`;
  if (await env.KV.get(marca)) return json(200, { avisados: 0, repetido: true }, o);
  await env.KV.put(marca, '1', { expirationTtl: 86400 });
  let avisados = 0;
  for (const k of subs) if (await manda(k, env)) avisados++;
  return json(200, { avisados }, o);
}

/** empurra pra uma inscrição; a que morreu (404/410) sai do banco. Devolve se chegou
 * @param {{ name: string, metadata?: any }} k @param {Env} env */
async function manda(k, env) {
  const endpoint = k.metadata?.endpoint || JSON.parse((await env.KV.get(k.name)) || '{}').endpoint;
  if (!endpoint) return false;
  const st = await empurra(endpoint, env).catch(() => 0);
  if (st === 404 || st === 410) await env.KV.delete(k.name);
  return st >= 200 && st < 300;
}

/** o saldo de cada um em centavos, na ordem da gente: a mesma conta do balances() do app.js (positivo = tem a
 * receber). Mexeu na conta do app.js, mexa aqui e no sw.js também @param {any} sala @returns {Map<string, number>} */
function saldos(sala) {
  const b = new Map(
    valores(sala?.people)
      .filter((p) => typeof p.id === 'string')
      .map((p) => [p.id, 0]),
  );
  const fora = new Set(valores(sala?.deleted));
  for (const e of valores(sala?.expenses)) {
    const among = valores(e.among),
      ids = among.filter((id) => b.has(id)),
      c = Math.round(+e.amount * 100);
    if (fora.has(e.id) || !Number.isFinite(c) || !ids.length || !b.has(e.payer)) continue;
    b.set(e.payer, b.get(e.payer) + c);
    // as partes valem se fecham o valor; senão divide igual, o centavo que sobra vai pros primeiros
    const partes =
      e.shares && typeof e.shares === 'object' ? among.map((id) => Math.max(0, Math.round(+e.shares[id] || 0))) : null;
    const certas = partes && partes.reduce((a, x) => a + x, 0) === c;
    const base = Math.floor(c / ids.length);
    ids.forEach((id, i) =>
      b.set(id, b.get(id) - (certas ? partes[among.indexOf(id)] : base + (i < c - base * ids.length ? 1 : 0))),
    );
  }
  return b;
}

/** o saldo de `pessoa` em centavos (positivo = tem a receber) @param {any} sala @param {string} pessoa */
export const saldo = (sala, pessoa) => saldos(sala).get(pessoa) || 0;

/** quem paga quanto pra quem, a mesma conta do settlements() do app.js: o maior devedor paga o maior credor
 * @param {any} sala @returns {{ de: string, pra: string, c: number }[]} */
export function acerto(sala) {
  const d = [],
    cr = [];
  for (const [id, v] of saldos(sala)) if (v < 0) d.push({ id, c: -v });
  else if (v > 0) cr.push({ id, c: v });
  d.sort((x, y) => y.c - x.c);
  cr.sort((x, y) => y.c - x.c);
  const st = [];
  let i = 0,
    j = 0;
  while (i < d.length && j < cr.length) {
    const v = Math.min(d[i].c, cr[j].c);
    st.push({ de: d[i].id, pra: cr[j].id, c: v });
    d[i].c -= v;
    cr[j].c -= v;
    if (!d[i].c) i++;
    if (!cr[j].c) j++;
  }
  return st;
}

/** o dia de Brasília de um instante, como a meia-noite UTC desse dia @param {number} t */
const diaBR = (t) => {
  const d = new Date(t - BR);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** o último aniversário, até `agora`, da dívida que começou em `at`: os 15 dias, depois cada mês no mesmo dia (o
 * 31 num mês de 30 vira o último dia dele). `meses` 0 é o dos 15 dias; null se ainda não fez nenhum
 * @param {number} at @param {number} agora @returns {{ dia: number, meses: number } | null} */
export function ultimoNiver(at, agora) {
  const a = new Date(diaBR(at)),
    hoje = diaBR(agora),
    h = new Date(hoje);
  const marco = (m) => {
    const fim = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + m + 1, 0)).getUTCDate();
    return Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + m, Math.min(a.getUTCDate(), fim));
  };
  let meses = (h.getUTCFullYear() - a.getUTCFullYear()) * 12 + h.getUTCMonth() - a.getUTCMonth();
  while (meses >= 1 && marco(meses) > hoje) meses--;
  if (meses >= 1) return { dia: marco(meses), meses };
  const quinze = a.getTime() + NIVER_DIAS * DIA;
  return quinze <= hoje ? { dia: quinze, meses: 0 } : null;
}

/** as dívidas com `pessoa` que fizeram aniversário na última semana. A dívida conta do último gasto em que o
 * devedor entrou (antes dele a conta dele não tinha fechado), igual ao aniversario() do app.js
 * @param {any} sala @param {string} pessoa @param {number} agora
 * @returns {{ devedor: string, dia: number, meses: number }[]} */
export function mesversarios(sala, pessoa, agora) {
  const fora = new Set(valores(sala?.deleted)),
    gastos = valores(sala?.expenses).filter((e) => e.kind !== 'payment' && !fora.has(e.id) && typeof e.at === 'number');
  return acerto(sala)
    .filter((t) => t.pra === pessoa)
    .flatMap((t) => {
      const at = Math.max(0, ...gastos.filter((e) => valores(e.among).includes(t.de)).map((e) => e.at)),
        n = at ? ultimoNiver(at, agora) : null;
      return n && diaBR(agora) - n.dia < NIVER_PRAZO * DIA ? [{ devedor: t.de, dia: n.dia, meses: n.meses }] : [];
    });
}

/** a diva cobra sozinha: quem tem a receber ganha um push no mêsversário de cada dívida (15 dias, depois todo
 * mês), e, sem aniversário, num evento parado, no máximo um por semana.
 * o texto quem escreve é o sw.js, que relê o evento. Devolve quantos pushes chegaram
 * @param {Env} env @param {number} [agora] */
export async function lembra(env, agora = Date.now()) {
  /** @type {Map<string, Map<string, { name: string, metadata?: any }[]>>} sala → pessoa → inscrições */
  const salas = new Map();
  for (const k of await lista(env.KV, 'sub:')) {
    const [, sala, pessoa] = k.name.split(':');
    if (!SALA.test(sala) || !ID.test(pessoa)) continue;
    const gente = salas.get(sala) || salas.set(sala, new Map()).get(sala);
    gente.set(pessoa, [...(gente.get(pessoa) || []), k]);
  }
  // embaralha: não cabe todo mundo num dia, e assim cada dia vê outras salas
  const ordem = [...salas];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  let resta = FETCH_POR_VEZ,
    lembrados = 0;
  for (const [id, gente] of ordem) {
    if (resta < 2) break; // a leitura e ao menos um push
    resta--;
    try {
      const r = await fetch(`${env.FIREBASE_DB}/rooms/${id}.json`, { cache: 'no-store' });
      const sala = r.ok ? await r.json() : null;
      if (!sala) continue;
      const em = +sala.updatedAt || 0,
        parado = !!em && agora - em >= PARADO_MS;
      for (const [pessoa, subs] of gente) {
        if (subs.length > resta) continue;
        // o mêsversário vale um push por dívida e aniversário; dois no mesmo dia vão num push só
        const marcas = [];
        for (const n of mesversarios(sala, pessoa, agora)) {
          const marca = `niver:${id}:${pessoa}:${n.devedor}:${n.dia}`;
          if (!(await env.KV.get(marca))) marcas.push(marca);
        }
        if (marcas.length)
          for (const marca of marcas) await env.KV.put(marca, '1', { expirationTtl: (NIVER_PRAZO + 1) * 86400 });
        else {
          if (!parado || saldo(sala, pessoa) <= 0) continue;
          const marca = `lembrou:${id}:${pessoa}`;
          if (await env.KV.get(marca)) continue;
          await env.KV.put(marca, '1', { expirationTtl: PARADO_MS / 1000 });
        }
        resta -= subs.length;
        for (const k of subs) if (await manda(k, env)) lembrados++;
      }
    } catch (err) {
      console.error(err);
    }
  }
  return lembrados;
}

export default {
  /** o cron do wrangler.toml @param {any} _ @param {Env} env @param {{ waitUntil(p: Promise<any>): void }} ctx */
  scheduled(_, env, ctx) {
    ctx.waitUntil(lembra(env));
  },
  /** @param {Request} req @param {Env} env */
  async fetch(req, env) {
    // a página das visitas é do próprio Worker (o formulário dela posta com a origem dele), não do site: vem antes do CORS
    if (new URL(req.url).pathname === '/visitas') return visitas(req, env);
    const o = req.headers.get('Origin');
    // navegador de outro site: nem responde. sem Origin (curl, smoke test) passa: CORS não é segurança
    if (o && !origemOk(o)) return new Response(null, { status: 403 });
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
    if (req.method === 'GET' && pathname === '/chave') {
      if (!env.VAPID_PUBLIC) return json(503, { erro: 'sem chave ainda' }, o);
      return json(200, { chave: env.VAPID_PUBLIC }, o);
    }
    const rota = {
      '/inscreve': inscreve,
      '/desinscreve': desinscreve,
      '/avisa': avisa,
      '/digital/desafio': (b, env, o) => digital.desafio(b, env, (s, c) => json(s, c, o)),
      '/digital/guarda': (b, env, o) => digital.guarda(b, env, (s, c) => json(s, c, o)),
      '/digital/entra': (b, env, o) => digital.entra(b, env, (s, c) => json(s, c, o)),
    }[pathname];
    if (!rota) return json(404, { erro: 'não tem' }, o);
    if (req.method !== 'POST') return json(405, { erro: 'só POST' }, o);
    const b = await corpo(req, pathname.startsWith('/digital/') ? MAX_CORPO_DIGITAL : MAX_CORPO);
    if (!b) return json(400, { erro: 'pedido torto' }, o);
    try {
      return await rota(b, env, o);
    } catch (err) {
      console.error(err);
      return json(500, { erro: 'deu ruim' }, o);
    }
  },
};
