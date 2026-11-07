// o tema antes da primeira pintura: carrega no <head>, antes do style.css desenhar, e põe o data-tema (e o
// data-escuro) no <html>. Sem ele, a página pintava no papel e só trocava quando o app.js chegava, no fim: um
// piscar de tema. É a mesma conta do tema() do app.js, que depois reaplica (e cuida da troca): mudou lá o NATAL, o
// ESCUROS ou o BARRA, mude aqui também.
(function () {
  var NATAL = [new Date(2026, 10, 1).getTime(), new Date(2027, 0, 7).getTime()];
  var BARRA = { '': '#6b4a2b', natal: '#123a2a', neon: '#0c0912', grafite: '#160f0b' };
  var t = '';
  try {
    t = (JSON.parse(localStorage.getItem('tolisa') || '{}') || {}).tema || '';
  } catch (e) {}
  if (!t) t = Date.now() >= NATAL[0] && Date.now() < NATAL[1] ? 'natal' : '';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'neon' : '';
  if (!BARRA.hasOwnProperty(t)) t = ''; // o 'papel' gravado, e o que não for tema
  var html = document.documentElement;
  if (t) html.setAttribute('data-tema', t);
  if (t === 'neon' || t === 'grafite') html.setAttribute('data-escuro', '');
  var barra = document.querySelector('meta[name="theme-color"]');
  if (barra) barra.setAttribute('content', BARRA[t]);
})();
