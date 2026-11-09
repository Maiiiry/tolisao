# language: pt
Funcionalidade: O que fica guardado no aparelho
  Sem cadastro, quem você é e o segredo da sua chave pix moram no navegador.
  Tudo fica em duas gavetas: "tolisa", com o que é do aparelho, e
  "tolisa:<sala>", com o que é de cada evento.

  Contexto:
    Dado o evento "bailedamada" com Fernando, Júlia e Lia
    E os gastos:
      | o quê  | valor  | pagou | divide entre          |
      | Airbnb | 300,00 | Júlia | Fernando, Júlia, Lia  |

  Cenário: o Fernando chega no admin pela tela inicial, sem pedir nada
    Dado que neste aparelho eu me chamo "Fernando"
    E que eu abro o site sem evento
    Então a tela inicial tem o botão do admin

  Cenário: o Fernando também chega no admin pela tela de outro evento
    Quando eu abro o evento como Fernando
    E eu toco no nome do evento
    Então a tela inicial tem o botão do admin

  Cenário: quem não é o Fernando não vê o admin, nem testando tudo
    Dado que eu pedi pra testar tudo
    E que neste aparelho eu me chamo "Júlia"
    E que eu abro o site sem evento
    Então a tela inicial não tem o botão do admin

  Cenário: quem já usava o site não perde quem é nem o segredo da chave
    Dado que este aparelho guardou, do jeito antigo, que eu sou Fernando e o segredo "tok-antigo" da chave dele
    Quando eu abro o evento
    Então o cabeçalho diz "sou Fernando"
    E o aparelho guarda que eu sou "fernando" e o segredo "tok-antigo" da chave do Fernando
    E o aparelho não guarda mais nada do jeito antigo

  Cenário: o segredo da chave nova fica na gaveta do evento
    Quando eu abro o evento como Júlia
    E eu cadastro a chave pix "julia@exemplo.com"
    Então aparece o aviso "Chave Pix salva"
    E o segredo que o banco guarda pra Júlia é o que ficou no aparelho
    Quando eu recarrego a página
    Então o cabeçalho diz "sou Júlia"

  Cenário: o último evento de antes da lista aparece nela
    Dado que este aparelho guardou o "bailedamada" como o último evento, do jeito de antes da lista
    E que eu abro o site sem evento
    Então o cartão mostra:
      """
      TÔ LISA
      *** MEUS EVENTOS ***
      BAILEDAMADA
      R$ 100,00
      ✕
      sou Lia · 3 pessoas
      agora
      *** OUTRO EVENTO ***
      BORA
      """
    E o aparelho não guarda mais o último evento na gaveta dele
