# servidor/ · a API do tô lisa

O tô lisa é um site estático (GitHub Pages) que guarda os eventos direto no Firebase, sem servidor.
Esta pasta é o **único backend**: um Worker da Cloudflare (`tolisa-api`) que faz o que um site estático
não consegue sozinho. Sem ele o app continua dividindo conta; o que some é o aviso no celular, a cobrança
automática, a digital e o painel do dono.

Endereço: `https://tolisa-api.fernando-costa-fd0.workers.dev` (é o `const API` do `app.js`).

## O que ele faz

| rota / gatilho | quem chama | o que faz |
|---|---|---|
| `GET /chave` | o app, ao ligar o 🔔 | devolve a chave pública VAPID, que o navegador usa pra se inscrever no push |
| `POST /inscreve` | o app | guarda a inscrição de push do aparelho (`sala`, `pessoa`, `sub`, `tok`) |
| `POST /desinscreve` | o app | tira a inscrição (precisa do mesmo `tok`) |
| `POST /avisa` | o app, logo depois de anotar | relê o lançamento no Firebase e manda push pra quem deve ser avisado |
| `POST /digital/desafio`, `/digital/guarda`, `/digital/entra` | o app (protótipo, atrás do `?digital`) | guarda a lista de eventos do aparelho atrás de uma passkey e devolve noutro celular |
| `POST /admin` | `tolisa.com.br/admin` | resumo das visitas, token de leitura do Firebase e códigos recuperáveis, só com a chave do dono |
| `GET /visitas` | links antigos | redireciona pro `tolisa.com.br/admin/` |
| **cron** todo dia 19h de Brasília (`0 22 * * *` UTC) | a Cloudflare | a "diva cobra sozinha": lembra quem tem a receber em evento parado e avisa quem recebe no mêsversário da dívida |

### Aviso no celular (`src/index.js`, `src/vapid.js`)

1. A pessoa liga o 🔔; o app pega a chave em `/chave`, se inscreve no push e manda a inscrição em `/inscreve`
   com um `tok` sorteado no aparelho. **Quem inscreve primeiro manda**: o `tok` fica guardado só como sha-256,
   e outro `tok` pra mesma pessoa é recusado (igual ao `tok` do pix).
2. Alguém marca um pagamento, perdoa uma dívida ou anota um gasto. O app avisa `POST /avisa {sala, id}`.
3. A API **não confia no corpo**: relê a sala no Firebase e confere que o lançamento existe, é de menos de
   10 minutos, não foi apagado e quem fez a ação não é avisado do que ele mesmo fez.
   - pagamento: avisa quem recebe; perdão: avisa quem devia; gasto novo: avisa quem divide e quem pagou.
4. O push sai **vazio** (sem texto, só `TTL` e a assinatura VAPID). Quem escreve a mensagem é o `sw.js` do
   site, que relê o evento no banco quando o push chega. A API nunca carrega valor nem nome.
5. Inscrição que o celular apagou (resposta 404/410 do serviço de push) sai do KV. Cada pessoa tem no máximo
   5 aparelhos: entra um novo, sai o mais velho.

### A diva cobra sozinha (o cron, `lembra()` em `src/index.js`)

Todo dia lê, por sala inscrita, o evento no Firebase:

- **mêsversário da dívida**: aos 15 dias e depois todo mês no mesmo dia (o 31 num mês curto vira o último dia),
  contado no dia de Brasília e do **último gasto em que o devedor entrou**; avisa quem recebe, uma vez por
  dívida e aniversário, com prazo de uma semana pra ainda avisar.
- **evento parado**: sem mudança há 7 dias e com saldo a receber, um lembrete por semana por pessoa. No dia
  de um mêsversário vai um push só (o do aniversário).

O saldo (`saldo()`, `acerto()`) é a **mesma conta do `balances()`/`settlements()` do `app.js`** (e do `sw.js`).
Mexeu na conta lá, mexa aqui.

### Digital (`src/digital.js`)

Guarda a lista de eventos do aparelho (código e "quem sou eu") atrás de uma passkey (WebAuthn): noutro
celular, ou depois de limpar o navegador, a digital devolve a lista. Sem CBOR e sem biblioteca: no cadastro a
chave pública vem do `getPublicKey()` e o attestation é `none`; na entrada a assinatura ES256 se confere com o
WebCrypto. Confere desafio de uso único (5 min), origem, `rpId`, presença do usuário e contador. O `tok` do pix
**nunca** vem pra cá (no servidor ele viraria desvio de pagamento).

### Painel do dono (`src/visitas.js`)

O nó `visitas/<dia>` do Firebase só se soma (+1 por aparelho por dia) e não tem `.read`. O Worker lê com uma
conta de serviço **só de leitura** (`VISITAS_SA`), devolve o resumo dos últimos 15 dias e um token de uma hora
pro `admin.js` baixar o `rooms.json` direto no navegador (no Worker estouraria a CPU do plano grátis). A chave
(`VISITAS_CHAVE`, 20+ letras) vai no corpo do POST, nunca na URL.

## O que ele guarda (KV `tolisa`)

| chave | valor | some em |
|---|---|---|
| `sub:<sala>:<pessoa>:<hash do endpoint>` | a inscrição de push (JSON) | quando o serviço de push diz que morreu |
| `tok:<sala>:<pessoa>` | sha-256 do `tok` de quem inscreveu primeiro | nunca |
| `avisado:<sala>:<id>` | esse lançamento já avisou | 1 dia |
| `lembrou:<sala>:<pessoa>` | o lembrete do evento parado já foi | 7 dias |
| `niver:<sala>:<pessoa>:<devedor>:<dia>` | o mêsversário dessa dívida já foi avisado | 8 dias |
| `desafio:<desafio>` | desafio da digital ainda não usado | 5 min |
| `digital:<id>` | `{ chave, contador, eventos, em }` | nunca |

O plano grátis da Cloudflare dá **1000 gravações de KV por dia e 50 `fetch` por execução**: por isso o código só
grava o necessário (inscrever de novo o mesmo aparelho não grava) e o cron lê no máximo 45 salas/pushes por vez.

## Secrets e variáveis

Variáveis (no `wrangler.toml`): `FIREBASE_DB`, `VAPID_SUB`, `DIGITAL_ORIGENS`. O `id` do KV no arquivo é
`__KV_ID__`: o `servidor.yml` acha (ou cria) o namespace `tolisa` e troca na hora de subir.

Secrets do Worker (nunca no repo):

| secret | de onde vem |
|---|---|
| `VAPID_PRIVATE` (JWK P-256) e `VAPID_PUBLIC` | gerados pelo `chaves.mjs` **só na primeira vez**: trocar derruba todas as inscrições |
| `VISITAS_SA` | conta de serviço do Firebase **só de leitura** (papel "Firebase Realtime Database Viewer"), copiada do secret de mesmo nome do repo |
| `VISITAS_CHAVE` | a chave do painel do dono, copiada do secret do repo |

Secrets do **repositório** que o deploy usa: `CLOUDFLARE_API_TOKEN` (modelo "Edit Cloudflare Workers"),
`CLOUDFLARE_ACCOUNT_ID`, `VISITAS_SA`, `VISITAS_CHAVE`. Sem os dois últimos o painel fica desligado e o
deploy segue.

## Rodar, testar e subir

```sh
cd servidor
npm ci
npm test            # cucumber: specs/features/*.feature, em português
npx cucumber-js specs/features/aviso.feature   # um arquivo só
```

Os testes não falam com rede nenhuma: o KV, o Firebase, o serviço de push e o Google são de mentira
(`specs/passos/_mundo.cjs`). Como cada feature é escrita e o que fica nos passos: veja o `CLAUDE.md` desta pasta.

**Subir**: é automático. Mudou algo em `servidor/**` na `main`, o `.github/workflows/servidor.yml` roda
`npm ci` e `npm test`, acha ou cria o KV, sobe o Worker (gerando as chaves VAPID se for a primeira vez), liga o
painel do dono e confere `GET /chave`. O `pages.yml` não publica esta pasta.

## Mapa dos arquivos

- `src/index.js`: as rotas, o CORS, o aviso, o saldo e o cron (`lembra()`).
- `src/vapid.js`: assinatura VAPID (JWT ES256) e o envio do push.
- `src/digital.js`: a passkey. `src/visitas.js`: o painel do dono.
- `chaves.mjs`: gera as chaves VAPID (só o `servidor.yml` usa).
- `wrangler.toml`: nome, KV, variáveis e o cron.
- `specs/`: features, passos e o mundo de mentira. `cucumber.cjs`: a configuração.
