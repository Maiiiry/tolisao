# language: pt
Funcionalidade: Painel do dono
  O tolisa.com.br/admin pede ao Worker o resumo das visitas e o que a busca de eventos precisa.
  O nó `visitas` do Firebase não tem .read, então quem lê é uma conta de serviço SÓ DE LEITURA,
  e a chave do painel (VISITAS_CHAVE) vai no corpo do POST, nunca na URL.

  Contexto:
    Dado a API no ar
    E que o painel do dono está ligado

  Cenário: com a chave certa o painel recebe o resumo, o token e os códigos da digital
    Dado que o banco tem visitas:
      | dia        | visitas |
      | 2026-11-06 | 4       |
      | 2026-11-07 | 2       |
    E que um aparelho guardou na digital o evento "aspirador-k7f3q9"
    E que outro aparelho guardou na digital uma lista estragada
    E que um aparelho guardou na digital um código de 200 letras
    E que o KV tem uma chave que não é da digital
    Quando eu entro no painel com a chave certa
    Então a API responde 200
    E o painel devolve o resumo dos últimos 15 dias do banco "https://banco.exemplo.com"
    E o painel entrega o token "tok-google" da conta de serviço
    E os códigos recuperáveis são "aspirador-k7f3q9"
    E a resposta libera "https://tolisa.com.br" e não fica em cache
    E a conta de serviço assinou o pedido do token
    E o painel leu o banco só dos últimos 15 dias, com o token

  Cenário: chave errada não lê o banco nem devolve token
    Quando eu entro no painel com a chave "quase-a-chave-mas-nao"
    Então a API recusa com 403 "chave errada"
    E a API não pediu nada pra fora

  Esquema do Cenário: sem os secrets certos o painel fica desligado e diz o que falta
    Dado que o secret <secret> está <estado>
    Quando eu entro no painel com a chave certa
    Então a API responde 503
    E o aviso do painel diz "<diz>"

    Exemplos:
      | secret         | estado             | diz                     |
      | VISITAS_CHAVE  | vazio              | falta o VISITAS_CHAVE   |
      | VISITAS_CHAVE  | com 5 letras       | tem 5 letras            |
      | VISITAS_SA     | vazio              | falta o VISITAS_SA      |
      | VISITAS_SA     | que não é JSON     | não é um JSON           |
      | VISITAS_SA     | sem client_email   | não tem client_email    |

  Cenário: o token do Google é reaproveitado entre as entradas no painel
    Quando eu entro no painel com a chave certa
    E eu entro no painel com a chave certa
    Então a API pediu o token ao Google 1 vez

  Cenário: o endereço velho da página manda pro painel no site
    Quando eu abro o endereço velho /visitas
    Então a API responde 302
    E ela manda pra "https://tolisa.com.br/admin/"

  Cenário: o resumo é dos últimos 15 dias: semana, a anterior e o melhor dia, sem o lixo de fora da janela
    Dado que o banco tem visitas:
      | dia        | visitas |
      | 2026-11-07 | 3       |
      | 2026-11-01 | 5       |
      | 2026-10-30 | 2       |
      | 2026-10-24 | 7       |
      | 2026-10-23 | 9       |
      | 2000-01-01 | 999     |
      | 2026-11-02 | -4      |
      | 2026-11-03 | x       |
    Quando o resumo é feito em "2026-11-07T15:00:00Z"
    Então o resumo diz:
      | campo         | valor |
      | hoje          | 3     |
      | ontem         | 0     |
      | semana        | 8     |
      | semana antes  | 2     |
      | quinzena      | 17    |
    E o melhor dia foi "2026-10-24" com 7 visitas
    E a lista vai de "2026-11-07" com 3 visitas até "2026-10-24" com 7 visitas, em 15 dias

  Cenário: o dia vira à meia-noite de São Paulo, não de Greenwich
    Dado que o banco tem visitas:
      | dia        | visitas |
      | 2026-11-06 | 1       |
      | 2026-11-07 | 9       |
    Quando o resumo é feito em "2026-11-07T02:00:00Z"
    Então o resumo diz:
      | campo | valor |
      | hoje  | 1     |
