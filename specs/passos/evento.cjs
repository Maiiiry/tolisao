const { Given, When, Then, expect, idDe, AGORA, leQr } = require('./_mundo.cjs');

const festa = require('../_festa.cjs');

const centavos = v => Math.round(Number(v.replace(/\./g, '').replace(',', '.')) * 100);

const poeGente = (mundo, nome, gente) =>
  mundo.criaEvento({ name: nome, people: gente.map((n, i) => ({ id: idDe(n), name: n, at: i + 1 })), expenses: [], deleted: [] });

const poeGastos = (mundo, linhas) => {
  const id = n => mundo.pessoa(n).id;
  linhas.forEach((g, i) => {
    const e = { id: 'g' + (mundo.evento.expenses.length + 1), desc: g['o quê'], amount: centavos(g.valor) / 100,
      payer: id(g.pagou), among: g['divide entre'].split(/\s*,\s*/).map(id), at: AGORA - 7 * 86400000 + i * 60000 };
    mundo.evento.expenses.push(e);
  });
};

Given('o evento {string} com {gente}', async ({ mundo }, nome, gente) => { poeGente(mundo, nome, gente); });

// turma grande: o dobro das 10 cores fixas (PALETTE), pra passar com folga do ponto em que
// a cor começa a ser gerada. Os nomes e o número não importam pro cenário, só que é muita gente
const TURMA = 'Ana Bia Caio Duda Edu Fê Gil Hugo Iara Jão Kika Léo Mel Nina Otto Pri Quel Rui Sol Téo'.split(' ');
Given('um evento com uma turma grande', async ({ mundo }) => { poeGente(mundo, 'turma', TURMA); });
// formatura: mais gente do que costuma dividir um gasto. Só a primeira e a última têm nome de
// gente porque são as únicas que o cenário cita; o resto é turma
Given('uma formatura com {int} pessoas, da Ana à Zoe', async ({ mundo }, n) => {
  poeGente(mundo, 'formatura', ['Ana', ...Array.from({ length: n - 2 }, (_, i) => `Aluno${i + 2}`), 'Zoe']);
});
Given('a/o {word} pagou R$ {num} dividido igual entre todo mundo', async ({ mundo }, quem, valor) => {
  mundo.evento.expenses.push({ id: 'g' + (mundo.evento.expenses.length + 1), desc: 'Buffet', amount: valor,
    payer: mundo.pessoa(quem).id, among: mundo.evento.people.map(p => p.id), at: AGORA - 86400000 });
});

// gastos miúdos de uma viagem longa, todos depois dos que já estão no evento: Lanche 1 é o mais velho
Given('mais {int} gastos de R$ {num} pagos pela/pelo {word}, divididos entre todo mundo', async ({ mundo }, n, valor, quem) => {
  const ultimo = Math.max(0, ...mundo.evento.expenses.map(e => e.at));
  for (let i = 1; i <= n; i++)
    mundo.evento.expenses.push({ id: 'g' + (mundo.evento.expenses.length + 1), desc: 'Lanche ' + i, amount: valor,
      payer: mundo.pessoa(quem).id, among: mundo.evento.people.map(p => p.id), at: ultimo + i * 60000 });
});
Given('os gastos:', async ({ mundo }, tabela) => { poeGastos(mundo, tabela.hashes()); });

// a mesma festa que o acerto e o anotar usam, de specs/_festa.cjs
Given('o evento de exemplo {string}', async ({ mundo }, nome) => {
  const f = festa[nome];
  if (!f) throw new Error(`não tem festa de exemplo "${nome}" em specs/_festa.cjs`);
  poeGente(mundo, nome, f.gente);
  poeGastos(mundo, f.gastos);
});

Given('(que )o/a {word} tem a chave pix {string}', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });
Given('(que )o/a {word} já cadastrou a chave pix {string} em outro aparelho', async ({ mundo }, quem, chave) => { mundo.banco.pix(mundo.sala, mundo.pessoa(quem).id, chave); });

Given('que eu abro o site sem evento', async ({ mundo }) => { await mundo.abre({ semEvento: true }); });
When('eu abro o evento como {word}', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu abro o evento como {word} num celular', async ({ mundo }, quem) => { await mundo.abre({ quem, toque: true }); });
When('eu troco pra {word}', async ({ mundo }, quem) => { await mundo.souEu(quem); });
When('eu abro o evento como {word} em outro aparelho', async ({ mundo }, quem) => { await mundo.abre({ quem }); });
When('eu recarrego a página', async ({ mundo }) => { await mundo.p.reload(); await mundo.p.waitForSelector('#app:not(.loading)'); });

When('eu digito o código {string}', async ({ mundo }, codigo) => { await mundo.p.fill('#gateCode', codigo); await mundo.p.click('#gateForm button'); });
// evento criado pelo campo: o código é sorteado, o nome é o que a pessoa digitou
Given('que este aparelho já abriu o evento {string} pelo link {string}', async ({ mundo }, nome, codigo) => {
  const ev = mundo.criaEvento({ name: codigo, people: [], expenses: [], deleted: [] }); ev.name = nome;
  mundo.antes = { ...mundo.antes, ['tolisa:' + mundo.sala]: JSON.stringify({ code: codigo, openedAt: AGORA, snapshot: ev }) };
});
When('eu colo no campo do código:', async ({ mundo }, txt) => { await mundo.p.fill('#gateCode', txt); await mundo.p.click('#gateForm button'); });
Then('o site pergunta se é um evento novo', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeVisible(); });
When('eu volto', async ({ mundo }) => { await mundo.p.click('#cancelBtn'); });
// a página recarrega pelo ?novo= e para no cartão que pergunta, sem abrir evento nenhum
When('eu digito no cartão do evento o nome {string}, que não é da minha lista', async ({ mundo }, nome) => {
  await mundo.p.fill('#gateCode', nome);
  await Promise.all([mundo.p.waitForEvent('load'), mundo.p.click('#gateForm button')]);
  await mundo.p.waitForSelector('#abreEsse');
});
When('eu toco em abrir esse mesmo', async ({ mundo }) => { await mundo.p.click('#abreEsse'); });
Then('o cartão do código volta com {string} escrito', async ({ mundo }, codigo) => { await expect(mundo.p.locator('#gateCode')).toHaveValue(codigo); });
Then('aparece o recado {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#gateErr')).toHaveText(txt); });
When('eu toco fora do cartão', async ({ mundo }) => { await mundo.p.mouse.click(5, 5); await mundo.p.waitForTimeout(200); });
// um nome novo no campo já é o evento: nada de "criar?" no meio
When('eu crio o evento {string}', async ({ mundo }, nome) => {
  await mundo.p.fill('#gateCode', nome); await mundo.p.click('#gateForm button'); await mundo.p.waitForSelector('#app:not(.loading)');
});
// os dois toques chegam antes do banco responder o primeiro
When('eu toco duas vezes no botão com o nome {string}', async ({ mundo }, nome) => {
  await mundo.p.fill('#gateCode', nome); await mundo.p.click('#gateForm button', { clickCount: 2 }); await mundo.p.waitForSelector('#app:not(.loading)');
});
Then('o banco tem {int} evento(s)', async ({ mundo }, n) => {
  await expect.poll(() => Object.keys(mundo.banco.arvore.rooms || {}).length).toBe(n);
});
Then('o endereço termina em {string}', async ({ mundo }, fim) => { await expect.poll(() => mundo.p.evaluate(() => location.search)).toBe(fim); });
Then('o endereço tem um código sorteado', async ({ mundo }) => {
  await expect.poll(() => mundo.p.evaluate(() => location.search)).toMatch(/^\?evento=[a-z0-9]{6}$/);
});
Then('o nome do evento no cabeçalho é {string}', async ({ mundo }, nome) => { await expect(mundo.p.locator('#roomLabel')).toHaveText(nome); });
Then('o site não pergunta nada', async ({ mundo }) => { await expect(mundo.p.locator('#okBtn')).toBeHidden(); });
When('eu colo o link {string} na mesma aba', async ({ mundo }, q) => { await mundo.p.evaluate(q => { location.search = q; }, q); });

When('eu toco no nome do evento', async ({ mundo }) => { await mundo.p.click('#roomLabel'); await mundo.p.waitForSelector('#evBack'); });
Then('o cartão mostra:', async ({ mundo }, txt) => {
  // o R$ vem colado no valor por um espaço que não quebra; no .feature ele é um espaço comum
  await expect.poll(async () => (await mundo.linhas('#overlayBox')).map(l => l.replace(/\u00a0/g, ' '))).toEqual(txt.split('\n').map(l => l.trim()).filter(Boolean));
});
Then('a nota não aparece atrás', async ({ mundo }) => { await expect(mundo.p.locator('#app')).toBeHidden(); });
Then('a nota volta', async ({ mundo }) => { await expect(mundo.p.locator('#app')).toBeVisible(); });
When('eu aperto o voltar do navegador', async ({ mundo }) => { await mundo.p.goBack(); });
When('eu toco em voltar', async ({ mundo }) => { await mundo.p.click('#evBack'); });
When('eu toco em compartilhar', async ({ mundo }) => { await mundo.p.click('#waBtn'); });
When('eu mando pro grupo todo', async ({ mundo }) => { await mundo.p.click('[data-link-pra=""]'); });
Then('fica copiado o link do evento', async ({ mundo }) => {
  await expect.poll(() => mundo.p.evaluate(() => /** @type {any} */ (window).__copiado))
    .toMatch(new RegExp(`^${mundo.base}/(semverba|sextou|fiado)/\\?evento=${mundo.evento.name}$`));
});
// o link do evento: a pasta (semverba, sextou ou fiado) só escolhe a figurinha do preview
const linkDoEvento = mundo => `${mundo.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(semverba|sextou|fiado)/\\?evento=${mundo.evento.name}`;
const casaConvite = (mundo, txt) => new RegExp(`^${txt.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{link\\}', linkDoEvento(mundo))}$`, 'u');
Then('o zap abre com o convite:', async ({ mundo }, txt) => {
  await expect.poll(() => mundo.p.evaluate(() => window.__aberto ? decodeURIComponent(window.__aberto.split('text=')[1]).trim() : null))
    .toMatch(casaConvite(mundo, txt));
});
Given('que meu celular compartilha', async ({ mundo }) => {
  mundo.aparelho.push(() => { navigator.share = async d => { window.__compartilhado = d.text; }; });
});
Given('que a folha de compartilhar do meu celular falha', async ({ mundo }) => {
  mundo.aparelho.push(() => { navigator.share = async () => { throw new DOMException('não deu', 'NotAllowedError'); }; });
});
Then('o celular compartilha o convite pro evento', async ({ mundo }) => {
  await expect.poll(() => mundo.p.evaluate(() => window.__compartilhado)).toMatch(new RegExp(`👉 ${linkDoEvento(mundo)}$`, 'u'));
  expect(await mundo.p.evaluate(() => window.__aberto)).toBeFalsy();
});
Then('o cartão fecha', async ({ mundo }) => { await expect(mundo.p.locator('#overlay')).toHaveClass(/\bhidden\b/); });
When('eu toco na caixa do caderno em branco', async ({ mundo }) => { await mundo.p.click('#settle .empty.anota'); });
When('eu toco em chamar a turma, na caixa do caderno em branco', async ({ mundo }) => { await mundo.p.click('#settle [data-chama]'); });
When('eu toco em anotar, na caixa do caderno em branco', async ({ mundo }) => { await mundo.p.click('#settle [data-anota]'); });
Then('o formulário de anotar abre', async ({ mundo }) => { await expect(mundo.p.locator('#sheet')).not.toHaveClass(/\bhidden\b/); });
When('eu toco no meu nome', async ({ mundo }) => { await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#whoSel'); });
Then('o cartão de quem é você já vem com {word} escolhida/escolhido', async ({ mundo }, quem) => {
  await expect(mundo.p.locator('#whoSel option:checked')).toHaveText(quem);
  await expect(mundo.p.locator('#whoSel')).not.toBeFocused();
});
Then('o cartão de quem é você não tem botão de sair', async ({ mundo }) => { await expect(mundo.p.locator('#leaveBtn')).toHaveCount(0); });

Then('aparece o aviso {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#toast')).toHaveText(txt); });
// o aviso some sozinho: sem região viva, o leitor de tela nem fica sabendo dele
Then('o leitor de tela anuncia {string}', async ({ mundo }, txt) => {
  const t = mundo.p.locator('#toast'); await expect(t).toHaveText(txt);
  await expect(t).toHaveAttribute('role', 'status'); await expect(t).toHaveAttribute('aria-live', 'polite');
});
When('eu aperto Esc', async ({ mundo }) => { await mundo.p.keyboard.press('Escape'); });

// evento sem ninguém: o "quem é você?" vira a lista de gente
// a sala aberta é a gaveta que guarda o código que está no endereço
const salaAberta = mundo => mundo.p.evaluate(() => { const c = new URLSearchParams(location.search).get('evento');
  return Object.keys(localStorage).find(k => k.startsWith('tolisa:') && JSON.parse(localStorage.getItem(k) || '{}').code === c)?.slice(7); });
When('eu digo que sou', async ({ mundo }) => { await mundo.p.click('#souSim'); });
When('eu digo que não sou', async ({ mundo }) => { await mundo.p.click('#souNao'); });
When('eu toco em quem é você', async ({ mundo }) => { await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#overlayBox h2'); });
When('eu ponho {gente} na lista', async ({ mundo }, gente) => {
  for (const n of gente) { await mundo.p.fill('#setupName', n); await mundo.p.press('#setupName', 'Enter'); await expect(mundo.p.locator('#setupName')).toHaveValue(''); }
});
When('eu tento pôr {word} na lista de novo', async ({ mundo }, n) => { await mundo.p.fill('#setupName', n); await mundo.p.press('#setupName', 'Enter'); });
When('eu tiro o/a {word} da lista', async ({ mundo }, nome) => {
  // o nome inteiro: "Lia" também está dentro de "Júlia"
  await mundo.p.getByRole('button', { name: `tirar ${nome}`, exact: true }).click();
  await expect(mundo.p.locator('#overlayBox [data-renome]', { hasText: new RegExp(`^${nome}$`) })).toHaveCount(0);
});
When('eu escrevo {word} e aperto pronto sem dar enter', async ({ mundo }, n) => { await mundo.p.fill('#setupName', n); await mundo.p.click('#setupGo'); });
// pega a pessoa pelo id, não pelo texto (que muda), e espera a troca assentar: senão, em máquina lenta,
// a próxima troca começa antes desta gravar e a digitação cai num nome que a lista acabou de redesenhar
When('eu troco o nome da/do {word} pra {word} na lista', async ({ mundo }, de, pra) => {
  const id = await mundo.p.locator('#overlayBox [data-renome]', { hasText: de }).first().getAttribute('data-renome');
  const el = mundo.p.locator(`#overlayBox [data-renome="${id}"]`); await el.click();
  await mundo.p.keyboard.press('ControlOrMeta+A'); await mundo.p.keyboard.type(pra); await mundo.p.keyboard.press('Enter');
  await expect(el).not.toBeFocused(); await expect(el).toHaveText(new RegExp(`^(${pra}|${de})$`));
});
When('eu escolho outra pessoa', async ({ mundo }) => { await mundo.p.selectOption('#whoSel', '__new'); await mundo.p.waitForSelector('#setupName'); });
Then('só a/o {word} tem ✕ na lista', async ({ mundo }, nome) => {
  await expect(mundo.p.locator('#overlayBox').getByRole('button', { name: /^tirar / })).toHaveCount(1);
  await expect(mundo.p.getByRole('button', { name: `tirar ${nome}`, exact: true })).toHaveCount(1);
});
Then('o leitor de tela lê {string} no ✕ da/do {word}', async ({ mundo }, txt, nome) => {
  const linha = mundo.p.locator('#overlayBox .row.pessoa').filter({ has: mundo.p.locator('[data-renome]', { hasText: new RegExp(`^${nome}$`) }) });
  await expect(linha.getByRole('button')).toHaveAccessibleName(txt);
});
Then('ninguém tem a mesma cor', async ({ mundo }) => {
  const cores = await mundo.p.$$eval('#overlayBox .row.pessoa .bola', bs => bs.map(b => getComputedStyle(b).backgroundColor));
  expect(cores).toHaveLength(TURMA.length); expect(new Set(cores).size).toBe(TURMA.length);
});
// o Quem vai? de quem já está no evento: entra como a primeira da turma (quem é não muda nada aqui)
// e escolhe "+ outra pessoa" no quem é você
When('eu abro o Quem vai?', async ({ mundo }) => {
  await mundo.abre({ quem: mundo.evento.people[0].name });
  await mundo.p.click('#whoBtn'); await mundo.p.selectOption('#whoSel', '__new'); await mundo.p.waitForSelector('#setupName');
});
When('eu continuo', async ({ mundo }) => { await mundo.p.click('#setupGo'); });
Then('a casinha do Quem vai? já vem com {string}', async ({ mundo }, nome) => { await expect(mundo.p.locator('#setupName')).toHaveValue(nome); });
Then('o site pergunta quem é você entre {gente}', async ({ mundo }, gente) => {
  await expect(mundo.p.locator('#overlayBox [data-sou]')).toHaveText(gente);
});
Then('o evento no banco tem {gente}', async ({ mundo }, gente) => {
  const sala = await salaAberta(mundo);
  await expect.poll(() => (mundo.banco.pega(['rooms', sala, 'people']) || []).map(p => p.name)).toEqual(gente);
});

// a turma de outro evento: o cartão dela abre pela lista de gente do evento novo
When('eu trago a turma do {string}', async ({ mundo }, nome) => {
  await mundo.p.locator('#overlayBox [data-turma]', { hasText: nome }).click(); await mundo.p.click('#turmaGo'); await mundo.p.waitForSelector('#setupGo');
});
When('eu trago a turma do {string} sem o/a {word}', async ({ mundo }, nome, fora) => {
  await mundo.p.locator('#overlayBox [data-turma]', { hasText: nome }).click();
  await mundo.p.locator('#overlayBox .turma .chip', { hasText: fora }).click();
  await mundo.p.click('#turmaGo'); await mundo.p.waitForSelector('#setupGo');
});
// o próximo rolê sai do evento quitado e cai direto no cartão da turma dele
When('eu chamo o próximo rolê de {string}', async ({ mundo }, nome) => {
  await mundo.p.click('#proxRole'); await mundo.p.fill('#proxNome', nome); await mundo.p.click('#proxForm button');
  await mundo.p.waitForSelector('#turmaGo');
});
When('eu trago a turma toda', async ({ mundo }) => { await mundo.p.click('#turmaGo'); await mundo.p.waitForSelector('#setupGo'); });
const pessoaNoBanco = (mundo, sala, nome) => (mundo.banco.pega(['rooms', sala, 'people']) || []).find(p => p.name === nome);
Then('{gente} são as mesmas pessoas do {string}', async ({ mundo }, gente, nome) => {
  const sala = await salaAberta(mundo), antigo = Object.values(mundo.banco.arvore.rooms).find(r => r.name === nome);
  for (const n of gente) expect(pessoaNoBanco(mundo, sala, n).id).toBe(antigo.people.find(p => p.name === n).id);
});
Then('{gente} é a mesma pessoa do {string}', async ({ mundo }, [n], nome) => {
  const sala = await salaAberta(mundo), antigo = Object.values(mundo.banco.arvore.rooms).find(r => r.name === nome);
  await expect.poll(() => pessoaNoBanco(mundo, sala, n)?.id).toBe(antigo.people.find(p => p.name === n).id);
});
// a galera de sempre: quem já rachou comigo em outros eventos, em cápsulas no Quem vai?
const galera = mundo => mundo.p.locator('#overlayBox [data-galera]:visible');
When('eu ponho {gente} da galera de sempre', async ({ mundo }, gente) => {
  for (const n of gente) { await galera(mundo).filter({ hasText: new RegExp(`^\\+${n}$`) }).click();
    await expect(mundo.p.locator('#overlayBox [data-renome]', { hasText: new RegExp(`^${n}$`) })).toHaveCount(1); }
});
When('eu começo a escrever {string} no Quem vai?', async ({ mundo }, txt) => { await mundo.p.fill('#setupName', txt); });
Then('a galera de sempre é {gente}', async ({ mundo }, gente) => { await expect(galera(mundo)).toHaveText(gente.map(n => '+' + n)); });
Then('o Quem vai? não mostra a galera de sempre', async ({ mundo }) => {
  await expect(mundo.p.locator('#setupName')).toBeVisible(); await expect(mundo.p.locator('#overlayBox [data-galera]')).toHaveCount(0);
});
Then('o evento novo não tem nenhum gasto', async ({ mundo }) => {
  expect(mundo.banco.pega(['rooms', await salaAberta(mundo), 'expenses']) || []).toEqual([]);
});
Then('o evento novo guarda a chave pix da/do {word} {string}', async ({ mundo }, nome, chave) => {
  const sala = await salaAberta(mundo);
  await expect.poll(() => mundo.banco.pega(['pix', sala, pessoaNoBanco(mundo, sala, nome)?.id, 'key'])).toBe(chave);
});
Then('o evento novo não tem a chave pix da/do {word}', async ({ mundo }, nome) => {
  const sala = await salaAberta(mundo);
  expect(mundo.banco.pega(['pix', sala, pessoaNoBanco(mundo, sala, nome).id])).toBeNull();
});
// o segredo nasce no evento novo: fica na gaveta dele e não sai em link nenhum
Then('o segredo da chave da/do {word} no evento novo é só deste evento', async ({ mundo }, nome) => {
  const sala = await salaAberta(mundo), id = pessoaNoBanco(mundo, sala, nome).id, tok = mundo.banco.pega(['pix', sala, id, 'tok']);
  const gavetas = await mundo.p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, JSON.parse(localStorage.getItem(k) || '{}')])));
  expect(gavetas[`tolisa:${sala}`].pixTokens[id]).toBe(tok);
  for (const [k, g] of Object.entries(gavetas)) if (k !== `tolisa:${sala}`) expect(JSON.stringify(g)).not.toContain(tok);
  expect(await mundo.p.evaluate(() => location.href)).not.toContain(tok);
});

// o evento some do banco com o aparelho ainda guardando a cópia
When('o evento some do banco', async ({ mundo }) => {
  await mundo.p.waitForSelector('#app:not(.loading)');
  await expect.poll(() => mundo.p.evaluate(k => !!JSON.parse(localStorage.getItem(k) || '{}').snapshot, `tolisa:${mundo.sala}`)).toBe(true);
  delete mundo.banco.arvore.rooms[mundo.sala];
});
// o banco segura o pedido, e o relógio anda o prazo do app (REDE_MS) com o sync esperando
When('a rede engasga e o banco para de responder', async ({ mundo }) => {
  await mundo.p.waitForSelector('#app:not(.loading)');
  mundo.banco.mudo = true;
  await mundo.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => mundo.banco.segurados || 0).toBeGreaterThan(0);
  await mundo.p.context().clock.runFor(8000);
});
// a pessoa volta pra aba: o sync tenta de novo
When('a rede volta', async ({ mundo }) => {
  mundo.banco.mudo = false;
  await mundo.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
});
Then('o rodapé diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#status')).toHaveText(txt); });
Then('o rodapé diz que sincronizou', async ({ mundo }) => { await expect(mundo.p.locator('#status')).toHaveText(/Sincronizado \d/); });
When('eu abro o site de novo', async ({ mundo }) => { await mundo.p.reload(); await mundo.p.waitForSelector('#overlayBox h2'); });
When('eu trago o evento de volta da minha cópia', async ({ mundo }) => {
  await Promise.all([mundo.p.waitForEvent('load'), mundo.p.click('#restoreBtn')]);
  await mundo.p.waitForSelector('#app:not(.loading)');
});
Then('o evento volta pro banco com o/a {word}', async ({ mundo }, desc) => {
  expect((mundo.banco.pega(['rooms', mundo.sala, 'expenses']) || []).map(e => e.desc)).toEqual([desc]);
});
When('eu desisto do evento', async ({ mundo }) => { await Promise.all([mundo.p.waitForEvent('load'), mundo.p.click('#lostBack')]); });
Then('aparece o cartão do código', async ({ mundo }) => { await expect(mundo.p.locator('#gateCode')).toBeVisible(); });
Then('o aparelho esquece o evento', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => location.search)).toBe('');
  await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0);
  const g = await mundo.p.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), `tolisa:${mundo.sala}`);
  expect(g.hidden).toBe(true); expect(g.snapshot).toBeTruthy();
});

// o link pode dizer quem vai abrir (&quem=); ?senha= é o nome antigo do parâmetro
// o link do zap é a última coisa da mensagem
const linkDoZap = mundo => mundo.p.evaluate(() => decodeURIComponent(window.__aberto.split('text=')[1]).trim().split(/\s+/).pop());
Then('o link do zap entra como {word}', async ({ mundo }, quem) => {
  // a pasta semverba, sextou ou fiado só escolhe a figurinha do preview
  await expect.poll(() => linkDoZap(mundo)).toMatch(new RegExp(`^${mundo.base}/(semverba|sextou|fiado)/\\?evento=${mundo.evento.name}&quem=${mundo.pessoa(quem).id}$`));
});
When('eu abro o link do zap em outro aparelho', async ({ mundo }) => {
  const link = await linkDoZap(mundo); await mundo.abre({ link }); await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu colo o link do evento pra {word} na mesma aba', async ({ mundo }, quem) => {
  await mundo.p.evaluate(q => { location.search = q; }, `?evento=${mundo.evento.name}&quem=${mundo.pessoa(quem).id}`);
  await mundo.p.waitForSelector('#app:not(.loading)');
});
When('eu abro o endereço {string}', async ({ mundo }, q) => { await mundo.abre({ link: mundo.base + '/' + q }); await mundo.p.waitForSelector('#app:not(.loading)'); });

// o QR do link do grupo, do "Mandar pra quem?": o SVG da tela vira imagem e passa pelo leitor
When('eu peço o QR do evento', async ({ mundo }) => { await mundo.p.click('#waBtn'); await mundo.p.click('#qrBtn'); await mundo.p.waitForSelector('#overlayBox .qr svg'); });
When('eu fecho o QR', async ({ mundo }) => { await mundo.p.click('#cancelBtn'); });
When('eu toco no link embaixo do QR', async ({ mundo }) => { await mundo.p.click('#qrLink'); });
Then('fica copiado o link curto do evento', async ({ mundo }) => {
  await expect.poll(() => mundo.p.evaluate(() => /** @type {any} */ (window).__copiado)).toMatch(doGrupo(mundo));
});
// o link curto, sem a pasta do preview do zap (semverba, sextou, fiado): o index.html abre o evento direto
const doGrupo = mundo => new RegExp(`^${mundo.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\?evento=${mundo.evento.name}$`);
Then('o QR na tela abre o evento direto', async ({ mundo }) => {
  const svg = await mundo.p.locator('#overlayBox .qr svg').evaluate(s => s.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" '));
  expect(await leQr(mundo.p, 'data:image/svg+xml,' + encodeURIComponent(svg))).toMatch(doGrupo(mundo));
});
// a plaquinha abre noutra aba: a página dela troca o QR do site pelo do evento
When('eu abro a plaquinha de mesa', async ({ mundo }) => {
  const [aba] = await Promise.all([mundo.p.context().waitForEvent('page'), mundo.p.click('#mesaLink')]);
  await aba.waitForLoadState();
  mundo.plaquinha = aba;
});
Then('a plaquinha leva o nome do evento', async ({ mundo }) => {
  await expect(mundo.plaquinha.locator('.placa .sub').first()).toHaveText(mundo.evento.name);
});
Then('o QR da plaquinha abre o evento direto', async ({ mundo }) => {
  const svg = await mundo.plaquinha.locator('.placa .qr').first().evaluate(s => s.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" '));
  expect(await leQr(mundo.p, 'data:image/svg+xml,' + encodeURIComponent(svg))).toMatch(doGrupo(mundo));
});
// a comanda é a que o "baixa a imagem" guardou
Then('o QR da comanda abre o evento direto', async ({ mundo }) => {
  expect(mundo.nota.comanda, 'a comanda não foi baixada antes').toBeTruthy();
  const png = 'data:image/png;base64,' + require('fs').readFileSync(mundo.nota.comanda).toString('base64');
  expect(await leQr(mundo.p, png)).toMatch(doGrupo(mundo));
});

// a chegada pelo link do grupo: a nota pergunta quem é você no topo, sem cartão
When('eu abro o link do grupo', async ({ mundo }) => { await mundo.abre(); await mundo.p.waitForSelector('#app:not(.loading)'); });
Then('a nota pergunta quem eu sou entre {gente}', async ({ mundo }, gente) => {
  await expect(mundo.p.locator('#chegada [data-chegou]')).toHaveText(gente);
});
Then('a nota não pergunta quem eu sou', async ({ mundo }) => { await expect(mundo.p.locator('#chegada')).toBeHidden(); });
When('eu toco no meu nome, {word}, no topo da nota', async ({ mundo }, quem) => {
  // pelo nome: o evento pode ter sido criado pela tela, sem passar pelo mundo
  await mundo.p.locator('#chegada [data-chegou]', { hasText: new RegExp(`^${quem}$`) }).click();
});
When('eu digo que não tô na turma', async ({ mundo }) => { await mundo.p.click('#chegouFora'); await mundo.p.waitForSelector('#setupName'); });

// a tela acesa do celular: quantos pedidos de tela acesa estão de pé fica em window.__acesa
Given('que meu celular deixa o site manter a tela acesa', async ({ mundo }) => {
  mundo.aparelho.push(() => {
    const w = /** @type {any} */ (window); w.__acesa = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { w.__acesa++; let solta = false;
      return { release: async () => { if (!solta) { solta = true; w.__acesa--; } } }; } } });
  });
});
Then('a tela fica acesa', async ({ mundo }) => { await expect.poll(() => mundo.p.evaluate(() => window.__acesa)).toBe(1); });
Then('a tela já pode apagar', async ({ mundo }) => { await expect.poll(() => mundo.p.evaluate(() => window.__acesa)).toBe(0); });

// a conta da nota: a linha dos itens e o Falta pagar
Then('a conta ainda não aparece', async ({ mundo }) => {
  await expect(mundo.p.locator('#itemsSec')).toBeHidden(); await expect(mundo.p.locator('#settleHead')).toBeHidden();
});
Then('a conta aparece', async ({ mundo }) => {
  await expect(mundo.p.locator('#itemsSec')).toBeVisible(); await expect(mundo.p.locator('#settleHead')).toBeVisible();
});
// o subtítulo embaixo do tô lisa; o rodapé é o recado entre os * * *, o código de barras e o sincronizado
const cabecaERodape = ['#tagline', '#signoff', '#bars', '#status'];
Then('a nota não tem subtítulo nem rodapé', async ({ mundo }) => {
  for (const s of cabecaERodape) await expect(mundo.p.locator(s)).toBeHidden();
});
Then('a nota tem subtítulo e rodapé', async ({ mundo }) => {
  for (const s of cabecaERodape) await expect(mundo.p.locator(s)).toBeVisible();
});
