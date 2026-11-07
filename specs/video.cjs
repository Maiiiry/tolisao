const { chromium } = require('./_pw.cjs');
const path = require('path'), fs = require('fs'), os = require('os');
const servir = require('./_serve.cjs');
const ficha = require('./_ficha.cjs');
const { DADOS, poeTema, esquema } = require('./preview.cjs');
const { createHash } = require('crypto');
const sha256 = t => createHash('sha256').update(t).digest('hex');

const H = Date.now();
const TRES = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia'], at: H - 2*86400000 },
    { id: 'i3', desc: 'Janta', amount: 80, payer: 'mengla', among: ['mengla','lia'], at: H - 86400000 },
  ] };

const FILA = { name: 'bailedamada', people: DADOS.people,
  expenses: [...TRES.expenses,
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 40, payer: 'lia', among: ['fernando'], at: H - 3600000 }] };

const DOIS = { name: 'bailedamada', people: DADOS.people,
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 300, payer: 'fernando', among: ['fernando','lia','klinsmann'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Gasolina', amount: 120, payer: 'julia', among: ['julia','lia','klinsmann'], at: H - 2*86400000 },
  ] };

// só a Mengla deve: o pagamento dela zera a conta, e desfeito volta a faltar
const ZERA = { name: 'bailedamada', people: DADOS.people.filter(x => ['fernando', 'lia', 'mengla'].includes(x.id)),
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 90, payer: 'fernando', among: ['fernando','lia','mengla'], at: H - 3*86400000 },
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 30, payer: 'lia', among: ['fernando'], at: H - 3600000 }] };

// só falta a Lia pagar a Júlia: quitando, o evento inteiro fica quite
const QUITA = { name: 'bailedamada', people: DADOS.people.filter(x => ['fernando', 'julia', 'lia', 'mengla'].includes(x.id)),
  expenses: [
    { id: 'i1', desc: 'Airbnb', amount: 200, payer: 'fernando', among: ['fernando','mengla'], at: H - 3*86400000 },
    { id: 'i2', desc: 'Janta', amount: 80, payer: 'julia', among: ['julia','lia'], at: H - 2*86400000 },
    { id: 'pg1', kind: 'payment', desc: 'Pagamento', amount: 100, payer: 'mengla', among: ['fernando'], at: H - 3600000 }] };

const CENAS = {
  vaza: { nome: 'a nota subindo: o zap vaza quando o texto chega nele, o ✎ só depois', quem: 'Klinsmann', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
      for (let y = 0; y <= 160; y += 4) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.waitForTimeout(1000);
      for (let y = 160; y >= 0; y -= 4) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.waitForTimeout(1000); } },
  pix: { nome: 'copiar pix brotando do ✔ e a piscada verde', quem: 'Lia', atrasoPix: 2000,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(4500); } },
  cascata: { nome: 'a nota se preenchendo de cima pra baixo', quem: 'Lia', atrasoPix: 1200, dados: FILA,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5500);
      await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(6000); } },
  piscas: { nome: 'três ✔ devendo pra três: o pisca-pisca de natal da primeira vez', quem: 'Lia', atrasoPix: 2000, dados: TRES,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 8000 }); await p.waitForTimeout(7500); } },
  troca: { nome: 'trocar de pessoa refaz a nota inteira', quem: 'Klinsmann', atrasoPix: 800, dados: DOIS,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(4500);
      await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
      await p.selectOption('#whoSel', { label: 'Lia' });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(5000); } },
  chave: { nome: 'o cadastrar chave pix descendo do título', quem: 'Júlia', atrasoPix: 2500,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#pixBtn', { timeout: 9000 }); await p.waitForTimeout(4000); } },
  ficha: { nome: 'a ficha caindo quando a página acaba', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
      await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
      await p.waitForTimeout(5000); } },
  pega: { nome: 'no primeiro toque a ficha descola e vai presa no dedo, rolando; largada devagar fica onde parou; jogada com força, sai voando', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await ficha.desce(p);
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .1s';
        document.body.appendChild(d);
        addEventListener('pointermove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
        addEventListener('pointerdown', () => d.style.transform = 'scale(.7)', true);
        addEventListener('pointerup', () => d.style.transform = '', true); });
      await ficha.pousa(p); await ficha.agarra(p, 22, -16);
      await ficha.passa(p, { x: 110, y: 560 }, 700); await ficha.passa(p, { x: 150, y: 330 }, 600);
      await ficha.passa(p, { x: 290, y: 300 }, 500); await p.waitForTimeout(300);
      await ficha.passa(p, { x: 320, y: 330 }, 120); await ficha.passa(p, { x: 200, y: 400 }, 90); await p.mouse.up();
      await p.waitForTimeout(2000); await ficha.rolaPraCima(p); await ficha.joga(p); } },
  dobra: { nome: 'o Falta pagar abaixo da dobra: descendo no meio do pisca-pisca, os riscos vêm na hora (use --altura=400)', quem: 'Lia', atrasoPix: 300, dados: FILA,
    acao: async p => { await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'start' }));
      await p.waitForTimeout(2500);
      await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(6500); } },
  mira: { nome: 'a ficha levada pela borda até o ▸ abre os itens; largada no ✔ pergunta se quitou', quem: 'Lia', atrasoPix: 0, dados: FILA,
    acao: async p => { await ficha.desce(p);
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .1s';
        document.body.appendChild(d);
        addEventListener('pointermove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
        addEventListener('pointerdown', () => d.style.transform = 'scale(.7)', true);
        addEventListener('pointerup', () => d.style.transform = '', true); });
      const meio = async sel => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      // leva a ficha pra borda de cima até o alvo descer pra tela, e aí até ele
      const leva = async sel => { await p.mouse.move(200, 40, { steps: 25 });
        for (let i = 0; i < 60 && await p.evaluate(s => document.querySelector(s).getBoundingClientRect().top < 160, sel); i++) await p.waitForTimeout(50);
        await p.mouse.move(200, 380, { steps: 18 }); const o = await meio(sel);
        await p.mouse.move(o.x + 30, o.y + 20, { steps: 22 }); await p.mouse.move(o.x, o.y, { steps: 10 }); await p.waitForTimeout(900); };
      await ficha.pousa(p); await ficha.agarra(p);
      await leva('#itemsHead'); await ficha.solta(p); await p.waitForTimeout(1200);
      await ficha.desce(p, true); await ficha.pousa(p, 8000); await ficha.agarra(p);
      await leva('#mineRows [data-settle]'); await ficha.solta(p); await p.waitForTimeout(1600);
      await p.click('#cancelBtn'); await p.waitForTimeout(800); } },
  toque: { nome: 'o toque preenchendo o ✔ e o copiar pix, que no celular não têm hover', quem: 'Lia', atrasoPix: 900, dados: TRES,
    acao: async p => {
      await p.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } }));
      await p.evaluate(() => { const d = document.createElement('div');
        d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(0,0,0,.5);pointer-events:none;left:-50px;top:-50px;transition:transform .12s';
        document.body.appendChild(d);
        const põe = e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; };
        addEventListener('pointerdown', e => { põe(e); d.style.transform = 'scale(.7)'; }, true);
        addEventListener('pointerup', e => { põe(e); d.style.transform = ''; }, true); });
      await p.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'center' }));
      await p.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
      await p.waitForTimeout(3000);
      const meio = async sel => { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
      let o = await meio('#mineRows [data-pix]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      o = await meio('#mineRows [data-settle]');
      await p.touchscreen.tap(o.x, o.y); await p.waitForTimeout(2200);
      await p.click('#overlay', { position: { x: 5, y: 5 } }); await p.waitForTimeout(1500); } },
  itens: { nome: 'o toquinho na linha dos itens quando ela chega na tela', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
      await p.evaluate(() => document.querySelector('#itemsSec').scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await p.waitForTimeout(5000); } },
  sou: { nome: 'o Sou Fulano dando um sinal de botão depois que a fila acaba', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(3500);
      const cutuca = () => p.evaluate(() => { const b = document.querySelector('#whoBtn');
        b.classList.remove('cutuca'); void b.offsetWidth; b.classList.add('cutuca'); });
      await cutuca(); await p.waitForTimeout(2600); await cutuca(); await p.waitForTimeout(2600); } },
  anota: { nome: 'o ✎ se apresentando pra quem nunca anotou, e no fim o Sou Fulano', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0));
      const cutuca = sel => p.evaluate(sel => { const b = document.querySelector(sel);
        b.classList.remove('cutuca'); void b.offsetWidth; b.classList.add('cutuca'); }, sel);
      await p.waitForTimeout(900); await cutuca('#fab'); await p.waitForTimeout(3600);
      await cutuca('#whoBtn'); await p.waitForTimeout(2200); } },
  etapas: { nome: 'o ✎ pulsa até ser apertado três vezes, e sossega', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => { window.scrollTo(0, 0); const d = document.createElement('div'); d.id = 'rotulo';
        d.style.cssText = 'position:fixed;left:0;right:0;bottom:24px;text-align:center;font:22px monospace;color:#fff;background:rgba(0,0,0,.72);padding:10px;z-index:99';
        document.body.appendChild(d); });
      const etapa = (txt, cls) => p.evaluate(([txt, cls]) => { document.querySelector('#rotulo').textContent = txt;
        const b = document.querySelector('#fab'); b.classList.remove('pulsa'); void b.offsetWidth; if (cls) b.classList.add(cls); }, [txt, cls]);
      await p.waitForTimeout(600);
      await etapa('apertou menos de 3 vezes', 'pulsa'); await p.waitForTimeout(2600);
      await etapa('da 3ª em diante: quieto', ''); await p.waitForTimeout(1600); } },
  ordem: { nome: 'a fila de cima pra baixo e, com a tela parada, o ✎ e o Sou Fulano', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(10500); } },
  rola: { nome: 'descendo a página inteira e voltando: onde ficam o ✎ e o zap', quem: 'Lia', atrasoPix: 600,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.click('#itemsHead'); await p.waitForTimeout(1500);
      for (const y of [420, 900, 'fim', 0]) {
        await p.evaluate(y => scrollTo({ top: y === 'fim' ? document.documentElement.scrollHeight : y, behavior: 'smooth' }), y);
        await p.waitForTimeout(2000); } } },
  abas: { nome: 'trocar entre igual e partes diferentes no anotar', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.click('#fab'); await p.waitForSelector('#sheet:not(.hidden)');
      await p.type('#amount', '12000'); await p.fill('#desc', 'Janta'); await p.waitForTimeout(900);
      for (const modo of ['custom', 'equal', 'custom']) { await p.click(`#splitSeg [data-modo="${modo}"]`); await p.waitForTimeout(1600); } } },
  aviso: { nome: 'a Mengla paga e o aviso verde sobe, para e vai embora subindo', quem: 'Fernando', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
      const pago = { ...DADOS, expenses: [...DADOS.expenses, { id: 'pgnovo', kind: 'payment', desc: 'Pagamento', amount: 87.13,
        payer: 'mengla', among: ['fernando'], at: Date.now(), by: 'Mengla' }] };
      await p.route(/fake-db.*\/rooms\//, r => r.request().method() === 'GET' ? r.fulfill({ json: pago }) : r.fulfill({ json: {} }));
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await p.waitForTimeout(7000); } },
  zera: { nome: 'a Mengla paga, o Falta pagar vira Pagamentos à máquina de escrever, e desfeito volta', quem: 'Fernando',
    atrasoPix: 0, dados: ZERA,
    acao: async p => { await p.waitForTimeout(3500);
      const pago = { ...ZERA, expenses: [...ZERA.expenses, { id: 'pg2', kind: 'payment', desc: 'Pagamento', amount: 30,
        payer: 'mengla', among: ['fernando'], at: Date.now(), by: 'Mengla' }] };
      let agora = pago;
      await p.route(/fake-db.*\/rooms\//, r => r.request().method() === 'GET' ? r.fulfill({ json: agora }) : r.fulfill({ json: {} }));
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await p.waitForTimeout(5000);
      agora = { ...ZERA, deleted: ['pg2'] }; // desfazer grava o id em deleted
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await p.waitForTimeout(4000); } },
  aperta: { nome: 'apertar a linha dos itens com o dedo: abre, fecha e abre de novo', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.waitForTimeout(3800);
      const b = await p.locator('#itemsHead').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      for (const espera of [1600, 1300, 1600]) {
        await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(160); await p.mouse.up();
        await p.waitForTimeout(espera);
      } } },
  // o banco devolve o que o app gravou; a passagem pro quite pendura #app.virou, gancho das variações (--css)
  quita: { nome: 'a Lia quita a última dívida e a nota se arruma em cascata até o tudo quite', quem: 'Lia', atrasoPix: 0, dados: QUITA,
    acao: async p => {
      let sala = null;
      await p.route(/fake-db.*\/rooms\//, r => {
        if (r.request().method() === 'PUT') { sala = JSON.parse(r.request().postData()); return r.fulfill({ json: sala }); }
        if (r.request().method() === 'GET' && sala) return r.fulfill({ json: sala });
        return r.fallback();
      });
      await p.waitForTimeout(2500);
      await p.click('#mineRows [data-settle]'); await p.waitForTimeout(800);
      await p.click('#okBtn'); await p.waitForTimeout(1400);
      await p.click('#quitOk');
      await p.waitForTimeout(4000); } },
  neon: { nome: 'o neon do tudo quite: acende engasgando, e aceso falha sorteando o jeito (apagão, estalo, só o letreiro, só o tubo, engasgo)', quem: 'Lia', atrasoPix: 0, dados: {
      ...QUITA, expenses: [...QUITA.expenses, { id: 'pg2', kind: 'payment', desc: 'Pagamento', amount: 40, payer: 'lia', among: ['julia'], at: H - 60000 }] },
    acao: async p => { await p.waitForTimeout(20000); } },
  // aparelho limpo, sem evento: a estreia de quem chega. o título digita por ~7,5 s com setTimeout, que o --vel
  // não desacelera, então a cena grava em vel 1; variação vai de --js, que roda antes do app
  inicio: { nome: 'a estreia: fichas caindo, a comandinha se anotando e o título se digitando', inicio: true, vel: 1,
    acao: async p => { await p.waitForTimeout(11500); } },
  chegada: { nome: 'quem chega pelo link toca no nome e a conta aparece', quem: '', chegada: true, atrasoPix: 600,
    acao: async p => { await p.waitForTimeout(1800); await p.click('#chegada [data-chegou="lia"]'); await p.waitForTimeout(6500); } },
  // o vídeo do README (npm run readme): chega pelo link, abre os itens, quita e troca o tema no pé da nota
  passeio: { nome: 'a Lia chega pelo link, olha os itens, quita a última dívida e passeia pelos temas', quem: '', chegada: true,
    atrasoPix: 300, dados: QUITA,
    acao: async p => {
      let sala = null;
      await p.route(/fake-db.*\/rooms\//, r => {
        if (r.request().method() === 'PUT') { sala = JSON.parse(r.request().postData()); return r.fulfill({ json: sala }); }
        if (r.request().method() === 'GET' && sala) return r.fulfill({ json: sala });
        return r.fallback();
      });
      await p.waitForTimeout(1500); await p.click('#chegada [data-chegou="lia"]'); await p.waitForTimeout(4500);
      await p.click('#itemsHead'); await p.waitForTimeout(2200); await p.click('#itemsHead'); await p.waitForTimeout(900);
      await p.click('#mineRows [data-settle]'); await p.waitForTimeout(1200);
      await p.click('#okBtn'); await p.waitForTimeout(1400);
      await p.click('#quitOk'); await p.waitForTimeout(4500);
      for (const espera of [1800, 1800, 300, 1500]) { await p.click('#temaBtn'); await p.waitForTimeout(espera); } } },
  // o natal: tocar no título faz o gorro do Ô dar uma pirueta (grave com --tema=natal)
  gorro: { nome: 'o gorro do título dá uma pirueta a cada toque', quem: 'Lia', atrasoPix: 0, vel: 1,
    acao: async p => { await p.waitForTimeout(1200);
      for (const espera of [1800, 1800]) { await p.click('#titulo'); await p.waitForTimeout(espera); } } },
  // a tela inicial com a lista: três eventos andando e quatro quitados antigos, recolhidos no fim; abre e fecha eles
  antigos: { nome: 'os quitados antigos abrindo e fechando na lista de eventos', inicio: true, vel: 1, semeia: () => {
      const dia = 86400000, agora = Date.now(), hex = (n) => n.toString(16).padStart(64, '0');
      const ev = (i, nome, dias, quite) => {
        const people = [{ id: 'eu', name: 'Fernando' }, { id: 'lia', name: 'Lia' }, { id: 'ju', name: 'Júlia' }];
        const expenses = [{ id: 'g1', desc: 'Janta', amount: 90, payer: 'eu', among: ['eu', 'lia', 'ju'], at: agora - dias * dia }];
        if (quite) expenses.push(
          { id: 'p1', kind: 'payment', desc: 'Pagamento', amount: 30, payer: 'lia', among: ['eu'], at: agora - dias * dia },
          { id: 'p2', kind: 'payment', desc: 'Pagamento', amount: 30, payer: 'ju', among: ['eu'], at: agora - dias * dia });
        localStorage.setItem(`tolisa:${hex(i)}`, JSON.stringify({ code: `ev${i}aa1`, me: 'eu',
          snapshot: { name: nome, people, expenses, updatedAt: agora - dias * dia } }));
      };
      try {
        if (localStorage.getItem('tolisa')) return;
        localStorage.setItem('tolisa', JSON.stringify({ visits: 5 }));
        ev(1, 'bailedamada', 1, false); ev(2, 'churras da laje', 3, false); ev(3, 'praia', 9, false);
        ev(4, 'aspirador de pó', 20, true); ev(5, 'mada 25', 40, true); ev(6, 'pizza', 60, true); ev(7, 'uber show', 90, true);
      } catch {}
    },
    acao: async p => { await p.waitForTimeout(1200);
      for (const espera of [2200, 1800, 2200]) { await p.click('details.antigos > summary'); await p.waitForTimeout(espera); } } },
  // o banco demora: o carregando fica na tela e a nota sai da impressora quando a sala chega
  imprime: { nome: 'abrir o evento: o carregando e a nota saindo da impressora', quem: 'Lia', atrasoPix: 600, atrasoSala: 1800,
    vel: 1, acao: async p => { await p.waitForTimeout(3500); } },
  risco: { nome: 'o risco correndo nas linhas pagas', quem: 'Lia', atrasoPix: 0,
    acao: async p => { await p.evaluate(() => document.querySelector('#settle').scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(3500); } },
};

async function video(opts = {}) {
  const { cena = 'pix', largura = 390, altura = 844 } = opts;
  const c = CENAS[cena]; if (!c) throw new Error(`cena desconhecida: ${cena} (tem ${Object.keys(CENAS).join(', ')})`);
  const vel = opts.vel ?? c.vel ?? 0.8;
  const dados = opts.dados || c.dados || DADOS;
  const saida = opts.saida || path.join(os.tmpdir(), `video-${cena}.webm`);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'tolisa-vid-'));
  const { srv, porta } = await servir();
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  try {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura }, hasTouch: true,
      reducedMotion: opts.quieto ? 'reduce' : 'no-preference', colorScheme: esquema(opts.tema),
      recordVideo: { dir: pasta, size: { width: largura, height: altura } } });
    await ctx.route(/fake-db/, async r => {
      const u = r.request().url();
      if (u.includes('/pix/')) { if (c.atrasoPix) await new Promise(ok => setTimeout(ok, c.atrasoPix));
        return r.fulfill({ json: u.includes('/fernando/') ? 'fernando@exemplo.com' : null }); }
      if (r.request().method() !== 'GET') return r.fulfill({ json: {} });
      if (c.atrasoSala && u.includes('/rooms/')) await new Promise(ok => setTimeout(ok, c.atrasoSala));
      r.fulfill({ json: dados });
    });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    const sala = await sha256(dados.name);
    if (!c.inicio) await p.addInitScript(([sala, code, quem, gente]) => {
      try { localStorage.setItem('tolisa', JSON.stringify({ lastRoom: { code, id: sala } }));
        const eu = gente.find(x => x.name === quem);
        if (eu) localStorage.setItem(`tolisa:${sala}`, JSON.stringify({ me: eu.id })); } catch {}
    }, [sala, dados.name, c.quem, dados.people]);
    await poeTema(p, opts.tema);
    if (c.semeia) await p.addInitScript(c.semeia);
    if (opts.js) await p.addInitScript(opts.js);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: vel });
    await p.goto(`http://localhost:${porta}/${c.inicio ? '' : `?evento=${dados.name}`}`);
    if (opts.css) await p.addStyleTag({ content: opts.css });
    await p.waitForSelector(c.inicio ? '#gateCode' : c.chegada ? '#chegada [data-chegou]' : '#mine:not(.hidden)', { timeout: 8000 });
    await c.acao(p);
    if (erros.length) console.error('ERROS NA PÁGINA:', erros);
    const v = p.video(); await ctx.close();
    if (v) await v.saveAs(saida);
    return saida;
  } finally { await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true }); }
}

module.exports = { video, CENAS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cena = args.find(a => !a.startsWith('--')) || 'pix';
  const op = a => { const v = args.find(x => x.startsWith('--' + a + '=')); return v && v.split('=')[1]; };
  const arqCss = op('css'), arqJs = op('js');
  video({ cena, saida: op('saida'), vel: op('vel') ? Number(op('vel')) : undefined,
          css: arqCss ? fs.readFileSync(arqCss, 'utf8') : undefined,
          js: arqJs ? fs.readFileSync(arqJs, 'utf8') : undefined, quieto: args.includes('--quieto'), tema: op('tema'),
          largura: op('largura') ? Number(op('largura')) : undefined, altura: op('altura') ? Number(op('altura')) : undefined })
    .then(f => console.log(f)).catch(e => { console.error('FAIL', e); process.exit(1); });
}
