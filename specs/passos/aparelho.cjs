const { Given, When, Then, expect, AGORA } = require('./_mundo.cjs');

// o que o aparelho já guardava de outros eventos, antes desta visita (as gavetas se somam)
const naGaveta = (mundo, k, o) => { const a = (mundo.antes ||= {}); a[k] = JSON.stringify({ ...JSON.parse(a[k] || '{}'), ...o }); };
Given('que neste aparelho eu sou {word} no {string}', async ({ mundo }, quem, nome) => {
  const rooms = mundo.banco.arvore.rooms, sala = Object.keys(rooms).find(id => rooms[id].name === nome), ev = rooms[sala];
  naGaveta(mundo, `tolisa:${sala}`, { code: nome, openedAt: AGORA - 86400000, me: ev.people.find(p => p.name === quem).id,
    snapshot: JSON.parse(JSON.stringify({ v: 2, updatedAt: AGORA - 86400000, gone: [], ...ev })) });
});
// a última visita deste aparelho ao evento: o que mudou depois dela ganha marca na lista
Given('que eu vi o evento pela última vez ontem', async ({ mundo }) => { naGaveta(mundo, `tolisa:${mundo.sala}`, { lastSeen: AGORA - 86400000 }); });
Given('que eu já usei a chave pix {string} em outro evento', async ({ mundo }, chave) => { naGaveta(mundo, 'tolisa', { pixKey: chave }); });
Given('que da última vez, em outro evento, eu fui {string}', async ({ mundo }, nome) => { naGaveta(mundo, 'tolisa', { myName: nome }); });
Given('que eu já usei a chave pix {string} como {word}', async ({ mundo }, chave, quem) => { naGaveta(mundo, 'tolisa', { pixKey: chave, pixName: quem }); });
// eventos que só este aparelho conhece, com outra turma: o nome é o mesmo, a pessoa (o id) não
Given('que este aparelho foi {word} em {int} evento(s)', async ({ mundo }, quem, n) => {
  for (let i = 0; i < n; i++) {
    const sala = String(i).repeat(64).slice(0, 64), id = 'velho' + i;
    naGaveta(mundo, `tolisa:${sala}`, { code: 'antigo' + i, openedAt: AGORA - (i + 2) * 86400000, me: id,
      snapshot: { v: 2, name: 'antigo' + i, updatedAt: AGORA - (i + 2) * 86400000, people: [{ id, name: quem, at: 1 }], expenses: [], deleted: [], gone: [] } });
  }
});

const gaveta = (mundo, k) => mundo.p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

Given('que este aparelho guardou, do jeito antigo, que eu sou {word} e o segredo {string} da chave dele', async ({ mundo }, quem, tok) => {
  const eu = mundo.pessoa(quem).id;
  mundo.antes = { [`racha:${mundo.sala}:me`]: eu, [`racha:${mundo.sala}:pixtok:${eu}`]: tok, 'racha:visitas': '4',
    'racha:room': JSON.stringify({ code: mundo.evento.name, id: mundo.sala }) };
});
When('eu abro o evento', async ({ mundo }) => { await mundo.abre(); await mundo.p.waitForSelector('#app:not(.loading)'); });
Then('o aparelho guarda que eu sou {string} e o segredo {string} da chave do/da {word}', async ({ mundo }, id, tok, quem) => {
  const s = await gaveta(mundo, `tolisa:${mundo.sala}`);
  expect(s.me).toBe(id); expect(s.pixTokens[mundo.pessoa(quem).id]).toBe(tok);
  expect(s.code).toBe(mundo.evento.name);
  const dev = await gaveta(mundo, 'tolisa'); expect(dev).toMatchObject({ visits: 5 }); expect(dev.lastRoom).toBeUndefined();
});
Then('o aparelho não guarda mais nada do jeito antigo', async ({ mundo }) => {
  expect(await mundo.p.evaluate(() => Object.keys(localStorage).filter(k => !k.startsWith('tolisa')))).toEqual([]);
});
Then('o segredo que o banco guarda pro/pra {word} é o que ficou no aparelho', async ({ mundo }, quem) => {
  const id = mundo.pessoa(quem).id;
  await expect.poll(() => mundo.banco.pega(['pix', mundo.sala, id, 'tok'])).toBeTruthy();
  expect((await gaveta(mundo, `tolisa:${mundo.sala}`)).pixTokens[id]).toBe(mundo.banco.pega(['pix', mundo.sala, id, 'tok']));
});

Given('que este aparelho guardou o {string} como o último evento, do jeito de antes da lista', async ({ mundo }, nome) => {
  mundo.antes = { tolisa: JSON.stringify({ visits: 3, lastRoom: { code: nome, id: mundo.sala } }),
    [`tolisa:${mundo.sala}`]: JSON.stringify({ me: 'lia', snapshot: mundo.evento }) };
});
Then('o aparelho não guarda mais o último evento na gaveta dele', async ({ mundo }) => {
  expect((await gaveta(mundo, 'tolisa')).lastRoom).toBeUndefined();
  expect((await gaveta(mundo, `tolisa:${mundo.sala}`)).code).toBe(mundo.evento.name);
});

const salaDe = (mundo, nome) => { const rooms = mundo.banco.arvore.rooms; return Object.keys(rooms).find(id => rooms[id].name === nome); };
Given('que o {string} sumiu do banco', async ({ mundo }, nome) => { delete mundo.banco.arvore.rooms[salaDe(mundo, nome)]; });
// os links de cada coisa em teste, que o aparelho guarda
Given('que eu pedi pra testar a galera de sempre', async ({ mundo }) => { naGaveta(mundo, 'tolisa', { galeraOn: true }); });
Given('que eu pedi pra testar tudo', async ({ mundo }) => { naGaveta(mundo, 'tolisa', { testesOn: true }); });
Given('que eu pedi pra testar o modo mesa', async ({ mundo }) => { naGaveta(mundo, 'tolisa', { mesaOn: true }); });
// o ?foto de antes do ?mesa: o aparelho que ligou por ele guardou o fotoOn
Given('que eu tinha ligado a foto da conta pelo link antigo', async ({ mundo }) => { naGaveta(mundo, 'tolisa', { fotoOn: true }); });

// o tema: o botão do pé da nota, e o claro/escuro do celular
When('eu toco no tema', async ({ mundo }) => { await mundo.p.click('#temaBtn'); });
// Tab de verdade até o tema: prova que ele pega foco, não só que reage ao Enter
When('eu troco o tema só com o teclado', async ({ mundo }) => {
  for (let i = 0; i < 80 && !(await mundo.p.evaluate(() => document.activeElement?.id === 'temaBtn')); i++) await mundo.p.keyboard.press('Tab');
  await mundo.p.keyboard.press('Enter');
});
When('eu toco no tema {int} vezes', async ({ mundo }, n) => { for (let i = 0; i < n; i++) await mundo.p.click('#temaBtn'); });
When('o celular passa pro escuro', async ({ mundo }) => { await mundo.p.emulateMedia({ colorScheme: 'dark' }); });
// o dia no relógio do aparelho, ao meio-dia (longe da virada do fuso): vale a partir do próximo carregamento
When('o calendário chega em {string}', async ({ mundo }, dia) => { await mundo.p.context().clock.setSystemTime(Date.parse(`${dia}T12:00:00-03:00`)); });
When('o celular volta pro claro', async ({ mundo }) => { await mundo.p.emulateMedia({ colorScheme: 'light' }); });
Then('o pé da nota diz {string}', async ({ mundo }, txt) => { await expect(mundo.p.locator('#temaBtn')).toHaveText(txt); });
// claro ou escuro pela luz do papel do recibo, do jeito que a pessoa vê
const luzDoPapel = (p) => p.locator('#app').evaluate(el => {
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
});
Then('o recibo é claro', async ({ mundo }) => { await expect.poll(() => luzDoPapel(mundo.p)).toBeGreaterThan(0.6); });
Then('o recibo é escuro', async ({ mundo }) => { await expect.poll(() => luzDoPapel(mundo.p)).toBeLessThan(0.2); });
// o admin (admin/, o painel do dono): o botão mora na tela inicial de quem testa tudo
Then('a tela inicial tem o botão do admin', async ({ mundo }) => {
  await expect(mundo.p.getByRole('button', { name: 'admin' })).toBeVisible();
});
Then('a tela inicial não tem o botão do admin', async ({ mundo }) => {
  await expect(mundo.p.locator('#gateCode')).toBeVisible();
  await expect(mundo.p.getByRole('button', { name: 'admin' })).toHaveCount(0);
});
