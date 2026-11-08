# language: pt
Funcionalidade: Foto da conta
  No bar, a conta chega impressa. Quem anota tira a foto dela no anotar e fica com ela à vista enquanto digita
  os itens: o evento todo vê a mesma foto. Ainda é protótipo do modo mesa: só aparece pra quem pediu pra testar.

  Contexto:
    Dado o evento "bar" com Ana, Beto e Caio

  Cenário: sem pedir pra testar, o anotar não oferece a foto da conta
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar não oferece a foto da conta

  Cenário: quem ligou a foto pelo link antigo continua com o modo mesa
    O teste da foto passou pra dentro do modo mesa: quem já testava não precisa ligar de novo.
    Dado que eu tinha ligado a foto da conta pelo link antigo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    Então o anotar oferece a foto da conta

  Cenário: a foto da conta fica guardada no evento, de referência pra digitar
    Quem tira a foto da conta no anotar fica com ela ali ao lado enquanto digita os itens,
    e qualquer pessoa do evento vê a mesma foto.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    E eu tiro a foto da conta
    Então o anotar mostra a foto da conta
    Quando eu abro o evento como Beto em outro aparelho
    E eu toco no ✎
    Então o anotar mostra a foto da conta

  Cenário: com a foto no anotar, dá pra ampliar e trocar por ela mesma
    Dois botões na própria foto: ampliar pra ler melhor, trocar quando saiu torta ou cortada.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    E eu tiro a foto da conta
    E eu abro a foto da conta
    Então a foto da conta aparece ampliada
    Quando eu volto da foto ampliada
    E eu troco a foto da conta
    Então o anotar mostra a foto da conta

  Cenário: a foto fica à vista no topo enquanto o anotar rola
    Num celular pequeno o formulário não cabe de uma vez: a foto fica presa no topo, pra pessoa digitar os itens olhando a conta.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E a tela do celular é pequena
    E eu toco no ✎
    E eu tiro a foto da conta
    E eu rolo o anotar até o fim
    Então a foto da conta continua à vista
