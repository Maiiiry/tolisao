# animações: as opções que ficaram de fora

referência das opções que foram pra folha de preview e não ganharam. o que está no ar fica no `style.css`; aqui fica
o CSS das outras, pronto pra gravar de novo (`node specs/video.cjs <cena> --css=arquivo.css`) se alguém quiser trocar.

## a nota saindo da impressora (cena `imprime`)

no ar: **C, linha a linha** (o papel cresce a partir do carregando e cada bloco cai no lugar, um depois do outro).

**A, matricial:** o papel sai em degraus de linha, tique-tique, e o texto vem junto com o corte.

```css
@keyframes imprimeA{from{clip-path:inset(-30px -40px calc(100% - var(--alto,150px)) -40px)}to{clip-path:inset(-30px -40px -40px -40px)}}
#app:not(.loading){animation:imprimeA 1s steps(22,end) backwards}
#app:not(.loading)>*:not(.stain){animation:none}
```

**B, fresta:** o papel é empurrado pra fora, liso, e o texto desce junto com ele, com um quiquezinho no fim.

```css
@keyframes imprimeB{from{clip-path:inset(-30px -40px calc(100% - var(--alto,150px)) -40px)}to{clip-path:inset(-30px -40px -40px -40px)}}
@keyframes empurraB{from{transform:translateY(-40px)}80%{transform:translateY(2px)}to{transform:none}}
#app:not(.loading){animation:imprimeB .9s cubic-bezier(.25,.75,.3,1) backwards}
#app:not(.loading)>*:not(.stain){animation:none}
#app:not(.loading)>:is(.hr,#chegada,#mine,#itemsSec,#settleHead,#settle,#fecho,#bars,#status,.tema){animation:empurraB .9s cubic-bezier(.25,.75,.3,1) both}
```

## quitados antigos abrindo (cenas `antigos`, `antigos1`, `antigos9`)

no ar: **C, leque** (os quitados saem empilhados de trás do "quitados antigos" e se abrem). as três dividem a base: a
lista estica e encolhe pelo `::details-content` e a setinha gira.

**A, gaveta:** só a base, sem nada nas linhas.

```css
.evs details.antigos{interpolate-size:allow-keywords}
.evs details.antigos::details-content{height:0;overflow:clip;transition:height .35s cubic-bezier(.3,.6,.4,1),content-visibility .35s allow-discrete}
.evs details.antigos[open]::details-content{height:auto}
.evs details.antigos>summary:before{content:"▸";display:inline-block;margin-right:.4em;transition:transform .25s ease}
.evs details.antigos[open]>summary:before{transform:rotate(90deg)}
```

**B, cascata:** a base, e cada evento cai no lugar um depois do outro, como a impressora.

```css
/* + a base da gaveta */
@keyframes linhaX{0%{opacity:0;transform:translateY(-10px)}70%{opacity:1;transform:translateY(1.5px)}100%{opacity:1;transform:none}}
.evs details.antigos[open]>.ev{animation:linhaX .3s ease-out both}
.evs details.antigos[open]>.ev:nth-of-type(2){animation-delay:60ms}
.evs details.antigos[open]>.ev:nth-of-type(3){animation-delay:120ms}
.evs details.antigos[open]>.ev:nth-of-type(4){animation-delay:180ms}
.evs details.antigos[open]>.ev:nth-of-type(n+5){animation-delay:240ms}
```

## ver os itens (cena `aperta`)

no ar: **C, leque** (a lista estica e os itens saem de trás da linha; o `.leque` vem do toque, no `app.js`). as três
dividem a base: o `#itemsBody` estica e encolhe. no ar, a base saiu do CSS e foi pro toque no `app.js` (um `animate()`
só até o pé da tela, com a margem junto): o `interpolate-size` abaixo corria a altura inteira, centenas de pixels por
quadro com muitos itens, e os 8px da margem e a junção das margens vizinhas sumiam de uma vez no fim do fecha.

**A, gaveta:** só a base (a versão em CSS, a de antes).

```css
#itemsBody{interpolate-size:allow-keywords;overflow:clip;height:auto;transition:height .4s cubic-bezier(.3,.6,.4,1),display .4s allow-discrete}
#itemsBody.hidden{height:0}
@starting-style{#itemsBody:not(.hidden){height:0}}
```

**B, cascata:** a base, e cada item cai no lugar um depois do outro (no ar, trocaria o leque pelo `linhaX` no
`#itemsBody.leque #expenses>*`).

```css
@keyframes linhaX{0%{opacity:0;transform:translateY(-10px)}70%{opacity:1;transform:translateY(1.5px)}100%{opacity:1;transform:none}}
#itemsBody.leque #expenses>*{animation:linhaX .3s ease-out both}
#itemsBody.leque #expenses>:nth-child(2){animation-delay:40ms}
#itemsBody.leque #expenses>:nth-child(3){animation-delay:80ms}
#itemsBody.leque #expenses>:nth-child(4){animation-delay:120ms}
#itemsBody.leque #expenses>:nth-child(5){animation-delay:160ms}
#itemsBody.leque #expenses>:nth-child(n+6){animation-delay:200ms}
```
