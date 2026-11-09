# language: pt
Funcionalidade: Foto da conta
  No bar, a conta chega impressa. Quem anota tira a foto dela pelo canto do anotar e fica com ela à mão enquanto digita
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
    Depois de tirada, a foto fica em miniatura no canto do anotar, e qualquer pessoa do evento vê a mesma.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    E eu tiro a foto da conta
    Então o anotar mostra a foto da conta
    Quando eu abro o evento como Beto em outro aparelho
    E eu toco no ✎
    Então o anotar mostra a foto da conta

  Cenário: a miniatura amplia pra ler, e a ampliada troca a foto
    A miniatura é só lembrete: pra ler a conta, toca nela; saiu torta ou cortada, troca ali mesmo.
    Dado que eu pedi pra testar tudo
    Quando eu abro o evento como Ana
    E eu toco no ✎
    E eu tiro a foto da conta
    E eu abro a foto da conta
    Então a foto da conta aparece ampliada
    Quando eu troco a foto da conta
    E eu volto da foto ampliada
    Então o anotar mostra a foto da conta
