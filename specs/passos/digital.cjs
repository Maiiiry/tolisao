const { Given, When, Then, expect } = require('./_mundo.cjs');

// a digital do celular: o autenticador virtual do Chromium (CDP), com passkey que o celular lembra
// sozinho e a digital sempre aceita. `credenciais` são passkeys que ele já traz (as sincronizadas)
async function digital(ctx, p, credenciais = [], prf = true) {
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
      automaticPresenceSimulation: true, hasPrf: prf },
  });
  for (const credential of credenciais) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  return { cdp, authenticatorId };
}

Given('que meu celular tem digital', async ({ mundo }) => {
  mundo.naPagina = async (ctx, p) => { mundo.digital = await digital(ctx, p); };
});
// o ?digital do endereço, que o aparelho guarda
Given('que eu pedi pra testar a digital', async ({ mundo }) => {
  const a = (mundo.antes ||= {});
  a.tolisa = JSON.stringify({ ...JSON.parse(a.tolisa || '{}'), passkeyOn: true });
});

When('eu abro o tô lisa', async ({ mundo }) => {
  if (mundo.p) await mundo.p.goto(mundo.base + '/');
  else await mundo.abre({ semEvento: true });
  await mundo.p.waitForSelector('#gateCode');
});
When('eu abro o tô lisa pelo endereço de testar a digital', async ({ mundo }) => {
  await mundo.p.goto(mundo.base + '/?digital');
  await mundo.p.waitForSelector('#gateCode');
});

// a digital mora no menuzinho do título "Meus eventos"
const abreMenu = (p) => p.getByRole('button', { name: /Meus eventos/ }).click();
When('eu guardo meus eventos na digital', async ({ mundo }) => { await abreMenu(mundo.p); await mundo.p.getByRole('button', { name: 'guardar com a digital' }).click(); });
// sem tabindex o link nem pega o foco, e o Enter cai no vazio
When('eu guardo meus eventos na digital pelo teclado', async ({ mundo }) => {
  await abreMenu(mundo.p);
  const b = mundo.p.getByRole('button', { name: 'guardar com a digital' });
  await b.focus(); await expect(b).toBeFocused(); await mundo.p.keyboard.press('Enter');
});

// o celular novo: aparelho limpo, que só tem a digital com a passkey sincronizada do primeiro
When('eu entro com a digital num celular novo', async ({ mundo }) => {
  const { cdp, authenticatorId } = mundo.digital;
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials, 'a passkey guardada').toHaveLength(1);
  mundo.antes = { tolisa: JSON.stringify({ passkeyOn: true }) };
  mundo.naPagina = async (ctx, p) => { mundo.digital = await digital(ctx, p, credentials); };
  await mundo.abre({ semEvento: true });
  await mundo.p.waitForSelector('#gateCode');
  await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0);
  await abreMenu(mundo.p);
  await mundo.p.getByRole('button', { name: 'entrar com a digital' }).click();
});

Then('o {string} volta pra lista, comigo como {word}', async ({ mundo }, nome, quem) => {
  const ev = mundo.p.locator('#overlayBox .ev', { hasText: nome });
  await expect(ev.locator('.l')).toHaveText(nome);
  await expect(ev).toContainText(`sou ${quem}`);
});

Then('o cartão não oferece a digital', async ({ mundo }) => {
  await expect(mundo.p.locator('#overlayBox h2').first()).toBeVisible();
  await expect(mundo.p.getByRole('button', { name: /Meus eventos/ })).toHaveCount(0);
});
Then('o cartão oferece {string}', async ({ mundo }, txt) => {
  await abreMenu(mundo.p);
  await expect(mundo.p.getByRole('button', { name: txt })).toBeVisible();
});

// limpar o navegador: o aparelho esquece tudo, o tok do pix junto, mas a passkey fica no celular.
// Volta pelo endereço de testar a digital, que liga ela de novo
When('eu limpo o navegador e volto ao evento como {word}', async ({ mundo }, quem) => {
  // limpar no meio do cadastro é outra história: espera a chave chegar no banco
  await expect.poll(() => mundo.banco.pega(['pix', mundo.sala, mundo.pessoa(quem).id, 'key'])).toBeTruthy();
  await mundo.p.evaluate(() => localStorage.clear());
  await mundo.p.goto(mundo.link + '&digital'); await mundo.souEu(quem);
});
When('eu libero a minha chave com a digital', async ({ mundo }) => {
  await mundo.p.click('#whoBtn'); await mundo.p.click('#pixDigital');
});
// digital antiga: sem a extensão que tira um segredo da passkey (PRF)
Given('que a digital do meu celular é antiga', async ({ mundo }) => {
  mundo.naPagina = async (ctx, p) => { mundo.digital = await digital(ctx, p, [], false); };
});
Then('o cartão de quem é você deixa trocar e apagar a minha chave', async ({ mundo }) => {
  await expect(mundo.p.locator('#pixTroca')).toBeVisible(); await expect(mundo.p.locator('#pixApaga')).toBeVisible();
});
Then('o cartão de quem é você não oferece liberar com a digital', async ({ mundo }) => {
  await mundo.p.click('#whoBtn'); await mundo.p.waitForSelector('#pixOutro'); await expect(mundo.p.locator('#pixDigital')).toHaveCount(0);
});
