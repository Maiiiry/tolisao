const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

class Banco {
  constructor(op = {}) { this.arvore = { rooms: {}, pix: {}, fotos: {}, visitas: {} }; this.listagens = 0; this.atrasoPix = op.atrasoPix || 0; this.congelado = !!op.congelado; }
  sala(dados) { const id = sha256(dados.name); this.arvore.rooms[id] = dados; return id; }
  pix(sala, pessoa, key) { (this.arvore.pix[sala] ||= {})[pessoa] = { key, tok: 'tokdeoutroaparelho' }; }
  // a gravação da sala só volta quando o passo soltar: espera por estado, e não um atraso fixo que
  // ora sobra (segundos à toa no CI), ora falta (a corrida que o cenário testa nem acontece)
  segura() { this.presas = 0; this.presa = new Promise(ok => { this.solta = () => { this.presa = null; ok(); return this.presas; }; }); }
  // a rede lenta segura o pix (GET ou PUT) até o passo soltar: espera por estado, e não um atraso fixo
  prendePix(m) { let solta; const p = new Promise(ok => { solta = ok; }); this.pixPreso = { m, p, solta }; }
  soltaPix() { const s = this.pixPreso?.solta; this.pixPreso = null; s?.(); }
  pega(partes) { let n = this.arvore; for (const p of partes) { if (n == null || typeof n !== 'object') return null; n = n[p]; } return n ?? null; }

  // o banco inteiro numa função: (método, caminho, cabeçalhos, corpo) → { status, corpo, cabecalhos }.
  // Quem fala HTTP é quem chama: a rota do playwright (liga) e o npm run dev (_serve.cjs)
  async responde(m, caminho, cab, texto) {
    const partes = caminho.replace(/\.json$/, '').split('/').filter(Boolean);
    const json = (status, v) => ({ status, corpo: v });
    const nega = () => json(401, { error: 'Permission denied' });
    if (partes[0] === 'pix') {
      if (this.atrasoPix) await new Promise(ok => setTimeout(ok, this.atrasoPix));
      if (this.pixPreso?.m === m) await this.pixPreso.p;
      const [, sala, pessoa, filho] = partes; if (!sala || !pessoa) return nega();
      // a rede engasgou: o banco não responde a chave (como um 5xx do Firebase no bar)
      if (this.pixFora && m === 'GET') { this.pixFalhas = (this.pixFalhas || 0) + 1; return json(503, { error: 'fora do ar' }); }
      const cur = this.pega(['pix', sala, pessoa]);
      if (m === 'GET') return filho === 'key' ? json(200, cur ? cur.key : null) : nega();
      if (m !== 'PUT' || filho) return nega();
      const novo = JSON.parse(texto || 'null');
      if (cur && cur.key !== '' && cur.tok !== novo?.tok) return nega();
      // o .validate do pix/$room/$person: sala é hash, pessoa é id, só {key, tok}, key até 80 e tok texto
      const pixOk = /^[0-9a-f]{64}$/.test(sala) && /^[a-z0-9]{1,32}$/.test(pessoa) && novo && typeof novo === 'object'
        && Object.keys(novo).every(k => k === 'key' || k === 'tok') && typeof novo.key === 'string' && novo.key.length <= 80
        && typeof novo.tok === 'string';
      if (!pixOk) return nega();
      if (!this.congelado) (this.arvore.pix[sala] ||= {})[pessoa] = novo;
      return json(200, novo);
    }
    // visitas/<dia> só se soma: PUT de +1, ninguém lê nem apaga
    if (partes[0] === 'visitas') {
      const [, dia] = partes, sv = JSON.parse(texto || 'null')?.['.sv']?.increment;
      if (m !== 'PUT' || partes.length !== 2 || !/^20[0-9]{2}-[01][0-9]-[0-3][0-9]$/.test(dia) || sv !== 1) return nega();
      this.arvore.visitas[dia] = (this.arvore.visitas[dia] || 0) + 1;
      return { status: 204 };
    }
    // a rede engasgou no bar: o pedido do evento fica pendurado, sem resposta e sem erro
    if (this.mudo && partes[0] === 'rooms') { this.segurados = (this.segurados || 0) + 1; return new Promise(() => {}); }
    // fotos/<sala>: a foto da conta, um JPEG em texto (o .validate do fotos/$room: sala é hash, jpeg base64 até 400 mil)
    if (partes[0] === 'fotos' && partes.length === 2) {
      if (m === 'GET') return json(200, this.arvore.fotos[partes[1]] ?? null);
      const v = JSON.parse(texto || 'null');
      if (m !== 'PUT' || !/^[0-9a-f]{64}$/.test(partes[1]) || typeof v !== 'string' || v.length > 400000
        || !/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(v)) return nega();
      this.arvore.fotos[partes[1]] = v; return json(200, v);
    }
    if (partes[0] !== 'rooms' || partes.length < 2) { if (m === 'GET') this.listagens++; return nega(); }
    // o ETag como o Firebase: só vem se pedir, e o PUT com if-match velho leva 412 com a sala atual
    const tag = () => { const v = this.pega(partes); return v == null ? 'null_etag' : sha256(JSON.stringify(v)); };
    const comTag = (status, v) => ({ status, corpo: v,
      cabecalhos: { etag: tag(), 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' } });
    if (m === 'GET') return cab['x-firebase-etag'] === 'true' ? comTag(200, this.pega(partes)) : json(200, this.pega(partes));
    // banco lerdo pra gravar (rede ruim no bar): a gravação fica presa até alguém soltar (segura/solta)
    if (m === 'PUT' && this.presa) { this.presas++; await this.presa; }
    if (m === 'PUT' && partes.length === 2) { const v = JSON.parse(texto || 'null');
      if (this.noMeio?.(partes[1], v)) this.noMeio = null;
      const se = cab['if-match'];
      if (se && se !== tag()) return comTag(412, this.pega(partes));
      if (!this.congelado) this.arvore.rooms[partes[1]] = v; return json(200, v); }
    return json(400, { error: 'o app só grava a sala inteira' });
  }

  async liga(ctx) {
    await ctx.route('https://fake-db.firebaseio.com/**', async r => {
      const rq = r.request(), res = await this.responde(rq.method(), new URL(rq.url()).pathname, rq.headers(), rq.postData());
      if (res.corpo === undefined) return r.fulfill({ status: res.status, headers: res.cabecalhos });
      return r.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.corpo), headers: res.cabecalhos });
    });
  }
}

module.exports = { Banco, sha256 };
