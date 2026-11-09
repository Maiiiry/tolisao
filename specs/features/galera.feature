# language: pt
Funcionalidade: A galera de sempre
  Nem todo rolê é com a mesma turma: o evento novo junta gente de eventos diferentes,
  e quem já rachou comigo vem num toque, continuando a ser a mesma pessoa.
  Ainda é protótipo: só aparece pra quem pediu pra testar.

  Contexto:
    Dado o evento "churras" com Fernando, Júlia e Lia
    E que neste aparelho eu sou Lia no "churras"
    E o evento "show" com Lia e Charles
    E que neste aparelho eu sou Lia no "show"

  Cenário: sem pedir pra testar, o Quem vai? não mostra a galera
    Dado que eu abro o site sem evento
    Quando eu crio o evento "praia"
    Então o Quem vai? não mostra a galera de sempre

  Cenário: pedir pra testar tudo liga de uma vez o que está em teste
    Quem testa não decora um link por função: um só liga todas, e fica lembrado no aparelho.
    Dado que eu pedi pra testar tudo
    E que eu abro o site sem evento
    Quando eu crio o evento "praia"
    E eu começo a escrever "cha" no Quem vai?
    Então a galera de sempre é Charles

  Regra: pra quem pediu pra testar, a galera dos meus eventos vem num toque

    Contexto:
      Dado que eu pedi pra testar a galera de sempre
      E que eu abro o site sem evento

    Exemplo: uma pessoa de cada evento, e cada uma é a mesma de lá
      Quando eu crio o evento "praia"
      E eu ponho Júlia e Charles da galera de sempre
      E eu continuo
      Então o evento no banco tem Júlia e Charles
      E Júlia é a mesma pessoa do "churras"
      E Charles é a mesma pessoa do "show"

    Exemplo: quem racha mais vem primeiro, e quem já está na lista sai da galera
      Quando eu crio o evento "praia"
      E eu ponho Fernando na lista
      Então a galera de sempre é Lia, Júlia e Charles

    Exemplo: escrevendo o nome, a galera fica só com quem bate
      Quando eu crio o evento "praia"
      E eu começo a escrever "cha" no Quem vai?
      Então a galera de sempre é Charles
