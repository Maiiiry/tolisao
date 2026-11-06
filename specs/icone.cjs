const { chromium } = require('./_pw.cjs');
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
// os ícones do app (ficha-*.png): a diva na ficha (node specs/icone.cjs).
// a diva vem do diva-ia.png, o diva.png reduzido a 64 px e ampliado 4x com o Real-ESRGAN (x4plus):
// o diva.png já é um emoticon minúsculo ampliado, e direto nele o ícone saía borrado.
const face = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'diva-ia.png')).toString('base64');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM }); const p = await b.newPage();
  await p.setContent('<canvas id=c></canvas>');
  const desenha = (lado, visivel, fundoCheio) => p.evaluate(async ([lado, visivel, fundoCheio, face]) => {
    const c = (document.getElementById('c')); c.width = c.height = lado;
    const x = c.getContext('2d'), m = lado / 2, R = visivel / 2, F1 = '#9a5b00', F2 = '#fff8e6';
    const img = new Image(); img.src = face; await img.decode();
    x.imageSmoothingQuality = 'high';
    x.clearRect(0, 0, lado, lado);
    if (fundoCheio) { x.fillStyle = F1; x.fillRect(0, 0, lado, lado); }
    else { x.beginPath(); x.arc(m, m, R, 0, 7); x.fillStyle = F1; x.fill(); }
    x.save(); x.translate(m, m); x.fillStyle = F2;
    for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, i * 2 * Math.PI / 14, (i + .5) * 2 * Math.PI / 14); x.fill(); }
    x.restore();
    const r = R * .62;
    x.beginPath(); x.arc(m, m, r + R * .06, 0, 7); x.fillStyle = F1; x.fill();
    x.save(); x.beginPath(); x.arc(m, m, r, 0, 7); x.clip();
    const s = r * 2 * 1.12; x.drawImage(img, m - s / 2, m - s / 2, s, s); x.restore();
    return c.toDataURL('image/png'); }, [lado, visivel, fundoCheio, face]);
  const grava = (nome, url) => { fs.writeFileSync(path.join(raiz, nome), Buffer.from(url.split(',')[1], 'base64')); console.log(nome); };
  grava('ficha-maskable.png', await desenha(512, 410, true));
  grava('ficha-512.png', await desenha(512, 512, false));
  grava('ficha-192.png', await desenha(192, 192, false));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
