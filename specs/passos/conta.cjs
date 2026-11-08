const { Given, When, Then, expect } = require('./_mundo.cjs');

When('a tela do celular é pequena', async ({ mundo }) => { await mundo.p.setViewportSize({ width: 390, height: 360 }); });
When('eu rolo o anotar até o fim', async ({ mundo }) => { await mundo.p.evaluate(() => document.querySelector('#sheet').scrollTo(0, 1e5)); });
Then('o anotar não oferece a foto da conta', async ({ mundo }) => { await expect(mundo.p.locator('#fotoConta')).toBeHidden(); });
Then('o anotar oferece a foto da conta', async ({ mundo }) => { await expect(mundo.p.getByRole('button', { name: /foto da conta/ })).toBeVisible(); });
Then('a foto da conta continua à vista', async ({ mundo }) => { const topo = await mundo.p.locator('#fotoConta').evaluate((e) => e.getBoundingClientRect().top); expect(topo).toBeGreaterThanOrEqual(0); expect(topo).toBeLessThan(2); });

// a foto da conta: um PNG de 1 pixel serve, o app refaz como JPEG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
When('eu tiro a foto da conta', async ({ mundo }) => {
  const [arq] = await Promise.all([mundo.p.waitForEvent('filechooser'), mundo.p.getByRole('button', { name: /foto da conta/ }).click()]);
  await arq.setFiles({ name: 'conta.png', mimeType: 'image/png', buffer: PNG });
});
When('eu abro a foto da conta', async ({ mundo }) => { await mundo.p.getByRole('button', { name: 'ampliar a foto' }).click(); });
When('eu troco a foto da conta', async ({ mundo }) => {
  const [arq] = await Promise.all([mundo.p.waitForEvent('filechooser'), mundo.p.getByRole('button', { name: 'trocar a foto' }).click()]);
  await arq.setFiles({ name: 'conta2.png', mimeType: 'image/png', buffer: PNG });
});
Then('a foto da conta aparece ampliada', async ({ mundo }) => { await expect(mundo.p.locator('.fotoGrande img')).toBeVisible(); });
When('eu volto da foto ampliada', async ({ mundo }) => { await mundo.p.click('#fotoGrandeVoltar'); });
Then('o anotar mostra a foto da conta', async ({ mundo }) => { await expect(mundo.p.locator('#fotoConta img')).toBeVisible(); });
