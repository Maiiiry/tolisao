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

  Cenário: pedir pra testar tudo liga de uma vez o que está em teste
    Quem testa não decora um link por função: um só liga todas, e fica lembrado no aparelho.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Lia
    E eu toco no ✎
    Então o anotar oferece colar a conta

  Cenário: quem testa tudo chega no admin pela tela inicial
    Dado que eu pedi pra testar tudo
    E que eu abro o site sem evento
    Então a tela inicial tem o botão do admin

  Cenário: sem pedir pra testar, a tela inicial não mostra o admin
    Dado que eu abro o site sem evento
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
