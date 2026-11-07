// acha o código perdido de um evento a partir do id da sala (o sha-256 do código, que a busca do /visitas mostra) e do
// nome dele. Não é teste. Tenta, em todos os núcleos, os dois formatos de código com 6 sorteados (36⁶, uns 2 bilhões):
//   "<nome>-k7f3q9"  os eventos de 26/set a 1º/nov (o nome em minúsculas, como foi digitado, e um final sorteado)
//   "k7f3q9"          os de depois de 1º/nov
// Os de antes (o código era o nome) a busca já acha; os 8 sorteados de 26/set e os 10 da tarde de 1º/nov não cabem.
//
//   node specs/acha-codigo.cjs <id> "<nome do evento>"
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { createHash } = require('crypto');
const os = require('os');

const A = '0123456789abcdefghijklmnopqrstuvwxyz';
const TOTAL = 36 ** 6;

if (isMainThread) {
  const [id, nome = ''] = process.argv.slice(2);
  if (!/^[0-9a-f]{64}$/.test(id || '')) {
    console.error('uso: node specs/acha-codigo.cjs <id de 64 letras> "<nome do evento>"');
    process.exit(1);
  }
  const prefixos = [...new Set([nome.trim().toLowerCase() ? nome.trim().toLowerCase() + '-' : null, ''])].filter(
    (p) => p !== null,
  );
  const n = os.cpus().length,
    inicio = Date.now();
  let vivos = n,
    feito = 0;
  console.log(`${n} núcleos, ${prefixos.length * TOTAL} tentativas no máximo (${prefixos.map((p) => `"${p}??????"`).join(', ')})`);
  const ws = Array.from({ length: n }, (_, k) => {
    const w = new Worker(__filename, { workerData: { id, prefixos, de: Math.floor((TOTAL * k) / n), ate: Math.floor((TOTAL * (k + 1)) / n) } });
    w.on('message', (m) => {
      if (m.achou) {
        console.log(`\nachou: ${m.achou}\nlink: https://tolisa.com.br/?evento=${encodeURIComponent(m.achou)}`);
        ws.forEach((x) => x.terminate());
        process.exit(0);
      }
      feito += m.feito;
      const s = (Date.now() - inicio) / 1000;
      process.stdout.write(`\r${((feito / (prefixos.length * TOTAL)) * 100).toFixed(1)}% em ${Math.round(s)} s   `);
    });
    w.on('exit', () => {
      if (--vivos === 0) {
        console.log('\nnão achou: o código não é de nenhum desses formatos (ou o nome do evento mudou depois)');
        process.exit(2);
      }
    });
    return w;
  });
} else {
  const { id, prefixos, de, ate } = workerData;
  const alvo = Buffer.from(id, 'hex');
  for (const p of prefixos) {
    const base = Buffer.from(p, 'utf8'),
      buf = Buffer.alloc(base.length + 6);
    base.copy(buf);
    let conta = 0;
    for (let i = de; i < ate; i++) {
      let v = i;
      for (let j = 5; j >= 0; j--) {
        buf[base.length + j] = A.charCodeAt(v % 36);
        v = Math.floor(v / 36);
      }
      if (createHash('sha256').update(buf).digest().equals(alvo)) {
        parentPort.postMessage({ achou: buf.toString('utf8') });
        return;
      }
      if (++conta === 5e6) {
        parentPort.postMessage({ feito: conta });
        conta = 0;
      }
    }
    parentPort.postMessage({ feito: conta });
  }
}
