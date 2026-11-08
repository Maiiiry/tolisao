# language: pt
Funcionalidade: Texto da conta
  No bar, a conta chega impressa, e o próprio celular já lê o texto de uma foto. Em vez de somar de cabeça
  o que entra no gasto, a pessoa copia o texto da foto, cola no anotar e toca nos preços: a soma vai pro valor.
  Ainda é protótipo do modo mesa: só aparece pra quem pediu pra testar.

  Contexto:
    Dado o evento "bar" com Ana, Beto e Caio

  Cenário: sem pedir pra testar, o anotar não oferece colar a conta
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar não oferece colar a conta

  Cenário: quem ligou a foto pelo link antigo continua com o modo mesa
    O teste da foto passou pra dentro do modo mesa: quem já testava não precisa ligar de novo.
    Dado que eu tinha ligado a foto da conta pelo link antigo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar oferece colar a conta

  Regra: pra quem pediu pra testar, os preços tocados no texto colado somam no valor do anotar

    Contexto:
      Dado que eu pedi pra testar o modo mesa
      Quando eu abro o evento como Ana
      E eu toco no ✎

    Exemplo: na primeira vez, o cartão ensina a copiar o texto da foto
      Ninguém sabe de cabeça que o celular lê texto em foto: o passo a passo vem aberto até a primeira conta colada.
      Quando eu abro o texto da conta
      Então o cartão ensina a copiar no iPhone e no Android

    Exemplo: a soma do que eu toquei vai pro valor
      Quando eu colo a conta:
        """
        CHOPP 12,90
        PORCAO 39,90
        AGUA 22,00
        """
      E eu toco em 12,90 e 39,90 na conta
      E eu uso a soma da conta
      Então o valor do anotar é 52,80

    Exemplo: tocar de novo num preço tira ele da soma
      Quando eu colo a conta:
        """
        CHOPP 12,90
        PORCAO 39,90
        """
      E eu toco em 12,90, 39,90 e 12,90 na conta
      Então a conta soma R$ 39,90

    Exemplo: o item com quantidade vale a quantidade vezes o unitário
      A impressora térmica corta o total na beirada do papel: ele sai do "6 UND x 18,90", com o nome da linha de cima.
      Quando eu colo a conta:
        """
        BUDWEISER 600ML
        6 UND x 18,90
        """
      Então a conta mostra "BUDWEISER 600ML" por 113,40

    Exemplo: o pontilhado, o R$ grudado e o total do item na linha de baixo
      Quando eu colo a conta:
        """
        BRAHMA CHOPP......9X.....R$12,00
        -TOTAL ITEM....R$108,00
        ESPETINHO DE FRANGO.....1X.....R$10,00
        """
      Então a conta mostra "BRAHMA CHOPP" por 108,00
      E a conta mostra "ESPETINHO DE FRANGO" por 10,00

    Exemplo: o texto sem preço avisa
      Quando eu colo a conta:
        """
        OBRIGADO PELA PREFERENCIA
        """
      Então a conta diz "não achei preço nesse texto"

  Cenário: a foto da conta fica guardada no evento, de referência pra digitar
    Quem tira a foto da conta no anotar fica com ela ali ao lado enquanto digita os itens,
    e qualquer pessoa do evento vê a mesma foto.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    E eu tiro a foto da conta
    Então aparece o aviso "Foto da conta guardada"
    E o anotar mostra a foto da conta
    Quando eu abro o evento como Beto em outro aparelho
    E eu toco no ✎
    Então o anotar mostra a foto da conta
