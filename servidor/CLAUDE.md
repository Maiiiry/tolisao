# CLAUDE.md · servidor/

A API do tô lisa: um Worker da Cloudflare em JS puro (`tolisa-api`, KV `tolisa`). O que ele faz, as rotas, o
KV, os secrets e o deploy estão no [README.md](README.md): leia antes de mexer. O CLAUDE.md da raiz vale pro
resto do projeto (pt-BR em tudo, resposta curta, issues proativas); aqui fica só o que é desta pasta.

## regras que não se quebram

- **sem dependência no Worker.** `src/` só usa API web padrão (fetch, WebCrypto, KV). `package.json` é só
  ferramenta: `wrangler` (sobe) e `@cucumber/cucumber` (testa), os dois em `devDependencies`.
- **o corpo do pedido nunca é confiável além dos ids.** O `/avisa` relê o lançamento no Firebase; id passa por
  regex (`SALA`, `ID`, `TOK`) antes de virar chave de KV.
- **o push vai vazio.** A API nunca manda valor nem nome: quem escreve o texto é o `sw.js` do site.
- **KV é contado** (1000 gravações por dia no plano grátis) **e o cron tem 50 `fetch` por execução**
  (`FETCH_POR_VEZ = 45`). Código novo que grava ou lê em laço tem que dizer quanto gasta. Escrever o que já está
  lá é desperdício: confira antes de gravar.
- **o `tok` só existe como sha-256** (`tok:<sala>:<pessoa>`): quem inscreve primeiro manda. O `tok` do pix
  **nunca** vem pra cá.
- **chaves VAPID não se trocam**: derruba todas as inscrições. O `servidor.yml` só gera na primeira vez.
- **`VISITAS_SA` é conta de serviço SÓ DE LEITURA.** Nunca a `FIREBASE_SA`, que publica as regras do banco.
- **a conta de saldo e de quem paga quem** (`saldo`, `acerto`) e o mêsversário (`ultimoNiver`, `mesversarios`)
  espelham o `balances()`/`settlements()`/`aniversario()` do `app.js` e do `sw.js`. Mexeu num, mexa nos três.
- **`PARADO_MS` espelha o `PARADO_DIAS` do `app.js`.**
- **CORS não é segurança**: o Worker recusa origem de fora, mas curl passa (sem `Origin`). A segurança é o `tok`,
  a chave do painel e a assinatura da passkey.
- **`wrangler.toml` com `__KV_ID__` literal**: o `servidor.yml` troca na hora de subir. Não ponha o id real.

## testes: cucumber, como o site

`npm test` (`cucumber-js`, config em `cucumber.cjs`). Mesma ideia do `specs/` da raiz: **a `.feature` em
português é a especificação, os passos são `.cjs`**, e nenhum teste fala com a rede.

- `specs/features/*.feature` (`# language: pt`): `inscricao` (CORS, pedido torto, tok, limite de aparelhos),
  `aviso` (pagamento, perdão, gasto, VAPID), `cobranca` (o cron, o saldo, o mêsversário), `digital` (a passkey)
  e `admin` (o painel e o resumo das visitas).
- `specs/passos/_mundo.cjs`: o mundo de cada cenário, recriado no `Before`: KV em memória (conta gravações), o
  `fetch` de mentira (Firebase, serviço de push, Google), as chaves VAPID e a conta de serviço de verdade (geradas
  uma vez), o `pede()` que chama `api.fetch` e guarda `this.resposta`, e o `instante("há 8 dias" | "2026-03-01")`.
  O `fetch` de verdade volta no `After`: um `fetch` não previsto lança erro de propósito.
- `specs/passos/{inscricao,aviso,cobranca,digital,admin}.cjs`: os passos. Vocabulário compartilhado: `a API responde N`,
  `a API recusa com N "erro"`, `a Ana se inscreveu com o aparelho N`, `o aviso vai só para o aparelho N`, e a tabela
  `os lançamentos do evento são:` (`id | tipo | valor | pagou | para | por | quando`, com `partes` opcional).
  Reaproveite antes de criar passo.
- Passos que importam o `src/` usam `import()` dinâmico (o `.cjs` não importa módulo ES direto).
- **cenário é especificação, não roteiro de requisição.** Diga o comportamento ("quem marcou que recebeu não é
  avisado do próprio clique"), não "POST /avisa com id rc1". O detalhe de implementação mora no passo.
  Uma regra nova da API entra como cenário na feature dela; bug corrigido ganha o cenário que o pegaria.
- Pra ver um teste de verdade falhar, quebre o `src/` de propósito (a TTL de uma marca, o limite de aparelhos) e
  confira que o cenário certo cai. Sem isso o cenário pode estar passando por engano.

## comandos

```sh
npm ci                # cucumber e wrangler
npm test              # tudo
npx cucumber-js specs/features/cobranca.feature   # uma feature
npx cucumber-js --name "mêsversário"              # cenários pelo nome
npx wrangler deploy   # NÃO: quem sobe é o servidor.yml
```

Subir é automático: mudou `servidor/**` na `main`, o `servidor.yml` roda `npm ci` + `npm test`, sobe o Worker e
confere o `/chave`. O CI (`tests.yml`) também roda `npm ci && npm test` aqui em todo PR.

## quando mexer no contrato com o site

Rota nova, campo novo ou mudança de formato mexe no `app.js` (o `postaApi`/`fetch(API …)`), no `sw.js` e, pro
painel, no `admin/admin.js`. O site e o Worker sobem em workflows diferentes e não ao mesmo tempo: **a mudança tem
que aceitar o app que já está no ar**, como as regras do banco.
