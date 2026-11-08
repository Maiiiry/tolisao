# CLAUDE.md

## o que é

"tô lisa · quem me deve?": divisor de gastos entre amigos, sem app e sem cadastro. `index.html`, `style.css` e `app.js`, sem build, no GitHub Pages, com Firebase Realtime Database via REST. site: https://tolisa.com.br/. tudo em pt-BR, tela e código.

este arquivo é o mapa e as regras que não se quebram. como cada feature se comporta está no código e nos `.feature`: não precisa vir pra cá.

## onde fica o quê

- `app.js`: tudo num IIFE com `// @ts-check` e tipos em JSDoc no topo. o sumário logo abaixo é o mapa das seções, cada uma num `// #region` (o `_regras.cjs` confere que o sumário bate); o estado da página fica junto em "o estado da página"; os cliques ficam na tabela `CLIQUES`. flags em maiúscula no topo ligam e desligam coisa meio pronta; as que estão em teste ligam num aparelho pelo link de cada uma (`?mesa`, `?galera`…) ou todas de uma vez pelo `?testes`.
- `style.css`: papel e madeira, fonte VT323. as cores são variáveis no `:root`; os temas (o "tema:" do pé da nota troca entre papel, natal, neon, grafite e o do celular; #285) redefinem elas no `html[data-tema]`, no fim do arquivo; os escuros ganham também o `data-escuro`. o natal é o padrão de 1º/nov a 6/jan (`NATAL` no `app.js`), com a diva de gorro (`diva-natal.png`, do `specs/gorro.cjs`).
- `manifest.json` + `sw.js`: PWA mínima, rede primeiro com cache de reserva.
- `database.rules.json`: regras do Firebase. mudou na main, o `regras.yml` publica sozinho (conta de serviço no secret `FIREBASE_SA`); regra nova tem que aceitar o app que já está no ar, porque as duas sobem juntas.
- preview do link no zap: o `index.html` usa `og/inicio.jpg` (o pin 😳 é fixo nele); `semverba/`, `sextou/`, `fiado/` (cobrança, a figurinha sai do código do evento; `c/h`, `c/i`, `c/j` ficam pros links velhos), `pago/` e `quitado/` são páginas só com as `og:`, imagem em `og/`; o `vai.js` repassa pro app. quem escolhe a pasta é o `shareUrl()`.
- `qr.js`: o gerador de QR (`qrMatriz`, `qrSvg`), script comum que o `index.html` carrega antes do `app.js` e a plaquinha de mesa também usa.
- `admin/`: o painel do dono (`tolisa.com.br/admin`): a chave vai pro `POST /admin` da API, que devolve as visitas e um token de uma hora; a busca de eventos (nome ou pessoa) baixa o `rooms.json` com ele, no navegador, e mostra o link quando o código é recuperável (o id da sala quando não é: `specs/acha-codigo.cjs`).
- `mesa/`: plaquinha de mesa pra imprimir (quatro A6 numa A4). sem nada, o QR do HTML leva pro site; com `?evento=<código>`, o `mesa.js` troca pelo QR do evento e põe o nome dele. o cartão do QR do evento tem o link "imprimir plaquinha de mesa".
- `specs/`: cucumber em português (`playwright-bdd`). `features/*.feature` é a especificação, `passos/*.cjs` os passos, `_banco.cjs` imita o Firebase com as regras, `_api.cjs` imita a API do aviso (os dois são uma função `responde()`, que serve o playwright e o `npm run dev`; o `dev.cjs` sobe o site com eles), `_cobertura.cjs` mede o que os cenários executam, `_regras.cjs` confere as regras abaixo que dá pra ler em arquivo (fontes da CSP, `.read` do banco e do pix, o formato que o pix aceita, `clean()`, imagens do link, `<a>` sem `href` com `role="button"`). `preview.cjs` e `video.cjs` geram imagem e vídeo, não são testes; o `acha-codigo.cjs` (`node specs/acha-codigo.cjs <id> "<nome>"`) também não: acha o código perdido de um evento pelo id da sala (a busca do `tolisa.com.br/admin` mostra), testando os finais de 6 sorteados; o `contraste.cjs` (`npm run contraste`, aceita `-- --tema=neon --tela=quitar --tudo`) também não: abre cada tema e cada janela, força o hover e o `:active` e lista o texto abaixo de 4,5:1 e a borda ou ícone de botão abaixo de 3:1; o `readme.cjs` (`npm run readme`) usa os dois pra refazer as imagens e o gif do README, em `docs/readme/`. `specs/contas/` guarda fotos de conta de verdade, cada uma com o gabarito num `.json` do lado (o `pages.yml` não publica): a base realista pro texto da conta (o 📋 do anotar atrás do `?mesa`, onde se cola o texto que o celular leu da foto).
- `servidor/`: a API (Worker da Cloudflare, KV `tolisa`) do aviso por push (pagamento pra pessoa e gasto novo com ela), e o cron diário que cobra evento parado e avisa quem recebe no mêsversário da dívida (15 dias, depois todo mês; `[triggers]` no `wrangler.toml`). JS puro, testes em cucumber (`cd servidor && npm ci && npm test`). dependência só ali (`wrangler`, pra subir, e `@cucumber/cucumber`, pra testar). **o que ele faz, as rotas, o KV e os secrets estão em `servidor/README.md`; as regras e como testar, em `servidor/CLAUDE.md`.** o `POST /admin` serve o painel do dono (resumo das visitas e o que a busca de eventos precisa; lê o banco com o `VISITAS_SA`, conta de serviço só de leitura, e abre com o secret `VISITAS_CHAVE`). quem sobe é o `servidor.yml`, que gera as chaves VAPID na primeira vez e passa esses dois secrets pro Worker; o `pages.yml` não publica a pasta.
- `.github/workflows/`: o que roda sozinho. `tests.yml` (todo PR e a `main`: prettier, tipos, regras, os testes do `servidor/` e o `npm test` do site; é o check `test`, o que a `main` exige), `pages.yml` (publica o site no GitHub Pages quando a `main` muda; só ele publica), `regras.yml` (**publica o `database.rules.json` no Firebase** com o secret `FIREBASE_SA`, rodando `.github/scripts/regras.mjs`, quando o arquivo muda na `main`; ele lê o que ficou lá e confere que é igual ao do arquivo, e roda junto com o `pages.yml`, por isso a regra nova tem que aceitar o app que já está no ar), `servidor.yml` (sobe o Worker da `servidor/` quando `servidor/**` muda na `main`), `analytics.yml` (na mão: lê o Cloudflare Web Analytics e escreve o resumo do job) e `release.yml` (na mão: cria a tag e as notas). o dependabot (`.github/dependabot.yml`) abre os PRs de atualização; check `test` verde e merge.
- `docs/qa.md`: roteiro e achados das sessões de QA. `docs/neon-escuro.md`: as versões do neon do quite em fundo escuro (QT e PT), referência pro modo escuro. `docs/animacoes.md`: o CSS das opções de animação que não ganharam a folha de preview.
- `CONTRIBUTING.md`: as mesmas regras pra gente. mudou regra aqui, mude lá.

## comandos

- rodar: `npm run dev` (banco e API falsos, em memória; `npm run dev -- --festa` já abre o bailedamada). o `python3 -m http.server` abre com o banco de verdade: visita em localhost não conta, mas evento criado vai pro ar.
- testes: `npm ci`, depois `npm test` (`npm test -- pix` roda um arquivo). a saída é pontinho, falhas e os 5 cenários mais lerdos; `npm run relatorio` gera o passo a passo em `specs/relatorio.html`. o `specs/_pw.cjs` acha o chromium da máquina se faltar o da versão do playwright; `PW_CHROMIUM=/caminho/do/chrome` escolhe na mão.
- cobertura: `npm run cobertura` (aceita `-- pix`) diz o % de linhas do `app.js` que os cenários executam e os trechos sem cenário. é lanterna, não meta nem check.
- tipos: `npm run types` (tem que sair limpo). sintaxe: `node --check app.js`.
- formato: `npm run formata` (prettier no `app.js`, aspas simples, 120 colunas; o CI cobra). o commit que formatou tudo está no `.git-blame-ignore-revs`.
- regras: `npm run regras`. tudo junto (sintaxe, formato, tipos, regras, testes): `npm run qualidade`, o mesmo que o CI cobra.
- o hook em `.claude/settings.json` roda sintaxe e tipos a cada edição no `app.js`.

## deploy

a `main` é o que tá no ar, exige o check `test` e recusa push direto. quando o usuário escolhe uma opção que você ofereceu, isso já é o aval: commite, mergeie e suba sem perguntar de novo.

1. `npm run qualidade` verde.
2. branch, PR, check verde, merge (`--merge --delete-branch`). check verde basta. o PR que resolve issue diz `Closes #N` na descrição (em inglês, uma linha por issue): é o que faz o GitHub fechar ela no merge. resolveu só uma parte, `Refs #N` e diga o que falta na issue.
3. `git checkout main && git pull origin main`.
4. espere o `pages.yml` terminar verde. só depois diga que tá no ar.

o passo a passo de acompanhar o PR até o ar tá na skill `babysit`.

- quem publica é o `.github/workflows/pages.yml`, e só ele (fonte do Pages: GitHub Actions). se alguém voltar pra "deploy from a branch", o Pages publica a branch crua por cima, com `?v=__V__` literal e CSS velho por dias.
- pushes seguidos cancelam o deploy anterior: espere o último antes de conferir.
- o `?v=` de `app.js` e `style.css` vira o SHA no deploy. o valor no `index.html` é reserva: suba ele (data + letra) junto com mudança visual.

## regras que não se quebram

- **sem dependência no site, sem framework, sem build.** `package.json` é só ferramenta. edição pequena (a única exceção foi a formatação do prettier).
- **aspas simples no `const DB = '...'` e no `const API = '...'`:** o `specs/_serve.cjs` troca essas linhas pelo banco e pela API falsos, e sem elas o `app.js` nem sai pros testes.
- **o banco é hostil.** id casa `/^[a-z0-9]{1,32}$/`, texto passa por `esc()` antes de `innerHTML`, tudo que vem do banco ou do cache passa por `clean()`.
- **regras do banco:** o `.read` nunca sobe pro nó `rooms` (senão `GET /rooms.json` baixa tudo). o `.validate` de `rooms/$room` é o formato do `clean()`: mexeu num, mexa no outro. validação de banco não vira cenário. `visitas/<dia>` só se soma (+1 por aparelho por dia): sem `.read`, sem apagar, o dono lê no `tolisa.com.br/admin` (ou no console). o aparelho do dono sai da conta sozinho: o último nome escolhido nele ser Fernando (`souFernando()`) pula a contagem, e é o mesmo teste que mostra o botão do admin.
- **CSP** no `<meta>` do `index.html`: só o próprio site, `*.firebaseio.com`, a API do aviso (`tolisa-api.fernando-costa-fd0.workers.dev`, o `const API`) e o Cloudflare Web Analytics (`static.cloudflareinsights.com` no script, `cloudflareinsights.com` no envio; ele leva o `?evento=`, o dono aceitou). o `_serve.cjs` tira o script nos testes. o `<script>` do fim entra pelo sha256: mexeu nele, recalcule.
- **service worker:** mudou a estratégia, troque o nome `CACHE`.
- **código do evento** novo é sorteado (`codigoNovo()`, 6 letras e números, sem o nome): código curto se adivinha testando o hash no banco. os de antes (`churras-k7f3q9`) continuam abrindo.
- **aparelho:** duas gavetas de JSON no localStorage, chaves em inglês e camelCase: `tolisa` (`device()`) e `tolisa:<sala>` (`room()`). migração só apaga o velho depois de gravar o novo: perder o `tok` do pix trava a chave.
- **dinheiro** é centavo inteiro até virar texto. o banco guarda `amount` em reais: leia com `centavos(e)`; `reais()`, `comSifrao()` e `valorHtml()` recebem centavos.
- **imagens do link** (`og/`) abaixo de ~300 KB, senão o WhatsApp ignora; trocar o nome fura o cache dele.
- **fontes** em `fonts/` são OFL 1.1 e Apache 2.0, não MIT.

## convenções

- **resposta ao usuário: em português e curta.** sem rodeio, só o que importa pra decidir.
- **issues proativas.** viu bug, código frágil ou ideia de melhoria fora do que foi pedido, abra uma issue curta sem perguntar (label `rascunho`, mais `bug` ou `enhancement`), depois de procurar se já existe uma. o dono avalia depois. no fim da tarefa, diga numa linha quais abriu.

- cores de gente saem de `PALETTE`/`MARKR` pelo índice. vermelho e verde são de deve/recebe; nada de amarelo.
- animação entra na fila do `agenda()`, na ordem da página, e só roda com a seção na tela.
- **teste não pode deixar o CI lento.** cenário que precisa esperar animação não existe: animação se confere no vídeo.
- **cenário é especificação, não roteiro de clique.** comportamento visto pela pessoa, sem detalhe de implementação, `Dado` como estado. escreveu ou revisou cenário, use a skill `gherkin`.
- **mudança visual termina com preview enviado ao usuário**, sem ele pedir (skill `preview`). opções vão numa folha comparativa em tamanho real; animação vai de vídeo.
