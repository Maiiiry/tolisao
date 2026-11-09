# language: pt
Funcionalidade: Acertar as contas
  Minha conta diz quanto eu devo ou tenho a receber, e é de lá que eu ajo:
  o ✔ quita, o copiar pix já vai com o valor e o cobrar manda no zap o link
  de quem me deve. Falta pagar só mostra.

  # a mesma festa do anotar.feature, repetida de propósito: as contas daqui saem desta
  # tabela, e quem lê confere os números sem abrir outro arquivo
  # quem é e quanto gastou cada um está em specs/_festa.cjs, na forma desta tabela
  Contexto:
    Dado o evento de exemplo "bailedamada"

  Cenário: o acerto é o mínimo de transferências
    Quando eu abro o evento como Lia
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |
    E a minha linha no acerto é "Lia → Fernando"
    E o Falta pagar não tem botão nenhum

  Cenário: a nota de quem deve
    Quando eu abro o evento como Lia
    Então Minha conta diz "eu devo" R$ 117,84
    E eu devo R$ 117,84 pro Fernando
    E eu vejo 1 botão de quitar em Minha conta
    E o subtítulo diz "pra quem eu devo?"
    E o sincronizado fica no rodapé, depois do código de barras
    E a página não fica mais larga que a tela

  Cenário: a nota de quem tem a receber
    Quando eu abro o evento como Júlia
    Então Minha conta diz "me devem" R$ 34,72
    E o Klinsmann me deve R$ 34,72
    E eu vejo 0 botões de quitar em Minha conta

  Cenário: quitar pelo ✔
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |

  Cenário: pagar só uma parte
    "Te mando 50 agora e o resto sexta": o que eu pago sai da dívida e o resto segue na nota.
    Quando eu abro o evento como Lia
    E eu pago R$ 50,00 da primeira linha de Minha conta e aviso no zap
    Então o zap abre com a mensagem:
      """
      ✅ Fernando, te paguei R$ 50,00 do *bailedamada* 👍
      {site}/pago/?evento=bailedamada&quem=fernando
      """
    E Minha conta diz "eu devo" R$ 67,84
    E o pagamento "Lia → Fernando" está carimbado "PAGO"

  Cenário: quitar é pagar tudo; com menos, o cartão vira pagar
    Quando eu abro o evento como Lia
    E eu toco no paguei da primeira linha de Minha conta
    Então o cartão pergunta "Quitar?" com o botão "quitei"
    Quando eu troco o valor por R$ 50,00
    Então o cartão pergunta "Pagar?" com o botão "paguei"
    E o cartão diz "Lia pagou R$ 50,00 pra Fernando"

  Cenário: desfazer um pagamento
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    E eu começo a desfazer o pagamento "Lia → Fernando" e volto atrás
    Então o pagamento "Lia → Fernando" continua carimbado
    Quando eu toco duas vezes no carimbo do pagamento "Lia → Fernando"
    Então nenhum cartão abre
    Quando eu desfaço o pagamento "Lia → Fernando"
    Então nenhum pagamento está carimbado
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |
    E eu devo R$ 117,84 pro Fernando
    Quando eu abro o evento como Fernando em outro aparelho
    Então nenhum pagamento está carimbado
    E falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61  |
      | Klinsmann | Júlia    | 34,72  |

  Cenário: quitar e avisar no zap
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta e aviso no zap
    Então o zap abre com a mensagem:
      """
      ✅ Fernando, te paguei R$ 117,84 do *bailedamada* 👍
      {site}/pago/?evento=bailedamada&quem=fernando
      """

  Cenário: cobrar no zap quem me deve
    O link da cobrança já entra como quem deve: a pessoa abre e cai na própria conta.
    A dívida faz aniversário: conta do último gasto em que a pessoa entrou, que é quando a conta dela fechou.
    Dado que o último gasto foi anotado há 5 dias
    Quando eu abro o evento como Fernando
    E eu cobro a Mengla no zap
    Então o zap abre com a mensagem:
      """
      💅 Mengla, não tô cobrando, só lembrando: faltam R$ 174,43 pra Fernando no *bailedamada*
      🎂 hoje a dívida completa 5 dias

      {site}/fiado/?evento=bailedamada&quem=mengla
      """

  Cenário: cobrar de novo a mesma pessoa lembra de outro jeito
    Lembrar sempre com a mesma frase cansa: a segunda cobrança já vem diferente.
    Quando eu abro o evento como Fernando
    E eu cobro a Mengla no zap
    E eu cobro a Mengla no zap
    Então o zap abre com a mensagem:
      """
      🍻 Mengla, o *bailedamada* foi bom demais, né? só faltam R$ 174,43 pra Fernando
      🎂 hoje a dívida completa 1 semana. já saiu da maternidade 🏥

      {site}/fiado/?evento=bailedamada&quem=mengla
      """

  Esquema do Cenário: a cobrança muda de tom conforme a dívida envelhece
    Na primeira semana cobrar é só alegria; depois insiste, e só depois de um mês chora que tá lisa.
    Dado que o último gasto foi anotado há <dias> dias
    Quando eu abro o evento como Fernando
    E eu cobro a Mengla no zap
    Então a mensagem do zap começa com "<primeira linha>"

    Exemplos:
      | dias | primeira linha                                                                          |
      | 7    | 💅 Mengla, não tô cobrando, só lembrando: faltam R$ 174,43 pra Fernando no *bailedamada* |
      | 8    | 🙈 Mengla, odeio ser essa pessoa, mas faltam R$ 174,43 pra Fernando no *bailedamada*      |
      | 31   | 🥲 Mengla, tô lisa, socorro: faltam R$ 174,43 pra Fernando no *bailedamada*              |

  Cenário: cobrar abre o zap na escolha de contato
    No zap a pessoa escolhe o contato, ou o grupo, sem passar por cartão nenhum.
    Quando eu abro o evento como Fernando
    E eu cobro a Mengla no zap
    Então o zap abre na escolha de contato

  Cenário: copiar o pix já com o valor, e o quitei fica esperando
    Quem volta do app do banco acha o quitei na tela, sem procurar o ✔ da linha.
    Dado que o Fernando tem a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
    Quando eu abro o evento como Lia
    E eu toco em copiar pix
    Então fica copiado o pix copia e cola:
      """
      00020126580014br.gov.bcb.pix01367d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d5204000053039865406117.845802BR5908FERNANDO6006BRASIL62070503***630476B9
      """
    E o cartão pergunta "Quitar?"

  Cenário: pagar uma parte e copiar o pix dessa parte
    Quem só manda um pedaço agora copia o pix já com esse pedaço, sem fechar o cartão.
    Dado que o Fernando tem a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
    Quando eu abro o evento como Lia
    E eu toco no paguei da primeira linha de Minha conta
    E eu troco o valor por R$ 50,00
    E eu toco em copiar pix no cartão
    Então fica copiado o pix copia e cola:
      """
      00020126580014br.gov.bcb.pix01367d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d520400005303986540550.005802BR5908FERNANDO6006BRASIL62070503***6304F8BE
      """
    E o cartão continua aberto

  Cenário: o pix do cartão de pagar não passa do que eu devo
    Valor digitado a mais vira pix da dívida inteira, como o quitei: ninguém manda dinheiro sobrando.
    Dado que o Fernando tem a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
    Quando eu abro o evento como Lia
    E eu toco no paguei da primeira linha de Minha conta
    E eu troco o valor por R$ 500,00
    E eu toco em copiar pix no cartão
    Então fica copiado o pix copia e cola:
      """
      00020126580014br.gov.bcb.pix01367d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d5204000053039865406117.845802BR5908FERNANDO6006BRASIL62070503***630476B9
      """

  Cenário: sem chave pix, o cartão de pagar não oferece pix
    Quando eu abro o evento como Lia
    E eu toco no paguei da primeira linha de Minha conta
    Então o cartão não tem copiar pix

  Cenário: a rede engasga e o copiar pix fica
    No bar a rede cai toda hora: uma busca que falha não tira da nota a chave que já chegou.
    Dado que o Fernando tem a chave pix "7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d"
    Quando eu abro o evento como Lia
    E a rede engasga quando o app busca as chaves pix de novo
    Então os botões da minha linha são "✔ paguei" e "copiar pix"

  Cenário: mandar a comanda pro zap
    Dado que o Fernando tem a chave pix "fernando@exemplo.com"
    Quando eu abro o evento como Lia
    E eu quito a primeira linha de Minha conta
    E eu toco em enviar
    Então baixa a imagem "evento-bailedamada.png"
    E o zap abre com a mensagem:
      """
      🧾 acerto do *bailedamada*

      💸 Mengla paga R$ 174,43 pra Fernando (pix: fernando@exemplo.com)
      💸 Klinsmann paga R$ 73,61 pra Fernando (pix: fernando@exemplo.com)
      💸 Klinsmann paga R$ 34,72 pra Júlia

      tudo aqui 👉 {site}/fiado/?evento=bailedamada
      """
    E o QR da comanda abre o evento direto

  Cenário: a comanda de uma viagem longa sai inteira
    Uma semana de viagem tem gasto demais pra uma imagem só: a comanda traz os mais novos,
    o total soma tudo e o resto fica no link.
    Dado mais 74 gastos de R$ 10,00 pagos pela Lia, divididos entre todo mundo
    Quando eu abro o evento como Lia
    E eu toco em enviar
    Então a comanda lista os 25 gastos mais novos
    E a comanda diz "+ 55 ITENS · TUDO NO LINK"
    E a comanda fecha com o total de R$ 1.480,32 e o "tolisa.com.br"

  Cenário: os botões dizem o que fazem
    Dado que o Fernando tem a chave pix "fernando@exemplo.com"
    Quando eu abro o evento como Lia
    Então os botões da minha linha são "✔ paguei" e "copiar pix"

  Cenário: no dedo o ✔ é fácil de acertar, no mouse não sobra área
    Quando eu abro o evento como Lia num celular
    Então a área de toque do ✔ tem pelo menos 44px
    Quando eu abro o evento como Lia
    Então a área do ✔ tem menos de 30px

  # o poll já baixa o evento: pagamento novo pra quem está vendo vira aviso, uma vez só
  Cenário: quem recebe vê o aviso quando alguém paga
    Quando eu abro o evento como Fernando
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então aparece o aviso "💸 Mengla te pagou R$ 174,43"
    Quando eu recarrego a página
    E o app sincroniza
    Então não aparece aviso de pagamento

  Cenário: dois pagamentos juntos viram um aviso só
    Quando eu abro o evento como Fernando
    E a Mengla e o Klinsmann pagam o que devem pro Fernando em outro aparelho
    Então aparece o aviso "💸 Mengla e Klinsmann te pagaram R$ 248,04"

  Cenário: o aviso também chega pra quem usa leitor de tela
    Quando eu abro o evento como Fernando
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então o leitor de tela anuncia "💸 Mengla te pagou R$ 174,43"

  Cenário: quem não recebeu não vê aviso
    Quando eu abro o evento como Lia
    E a Mengla paga R$ 174,43 pro Fernando em outro aparelho
    Então não aparece aviso de pagamento


  Cenário: quem recebe perdoa depois de quem deve já ter marcado paguei em outro aparelho
    A minha nota ainda não sabia do paguei: o perdão não quita de novo, senão quem pagou passa a ter a receber.
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    E o Klinsmann paga R$ 3,61 pro Fernando em outro aparelho, antes da minha nota atualizar
    E eu perdoo o Klinsmann
    Então aparece o aviso "Já tá quitado"
    E o banco tem 2 pagamentos do Klinsmann pro Fernando

  Cenário: quem recebe dá baixa no que recebeu por fora
    Quem pagou em dinheiro ou esqueceu de marcar não precisa abrir o evento: quem recebeu marca por ele.
    Quando eu abro o evento como Fernando
    E eu marco que recebi da Mengla
    Então falta pagar:
      | quem      | paga pra | valor |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Fernando | 73,61 |
      | Klinsmann | Júlia    | 34,72 |
    E o pagamento "Mengla → Fernando" está carimbado "PAGO"

  # os R$ 3,61 que sobraram do Klinsmann: pouco demais pra cobrar; dívida grande não se perdoa, só se dá baixa
  Cenário: só dívida pequena se perdoa
    Abaixo de R$ 50,00 e com pelo menos um dia sem pagar, o cartão do recebi oferece perdoar.
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    Então só o Klinsmann pode ser perdoado em Minha conta
    Quando eu perdoo o Klinsmann
    Então falta pagar:
      | quem      | paga pra | valor  |
      | Mengla    | Fernando | 174,43 |
      | Lia       | Fernando | 117,84 |
      | Klinsmann | Júlia    | 34,72  |
    E o pagamento "Klinsmann → Fernando" está carimbado "PERDOADO"

  Cenário: dívida de hoje ainda não se perdoa
    No mesmo dia ainda é cedo: perdão é pra dívida que ficou pra trás.
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    E que o último gasto foi anotado hoje
    Quando eu abro o evento como Fernando
    Então ninguém pode ser perdoado em Minha conta

  Cenário: quem perdoa conta no zap
    Perdão bom é perdão contado: o cartão oferece o zap, com o valor e o link do evento.
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    E eu perdoo o Klinsmann e aviso no zap
    Então o zap abre com o perdão dos R$ 3,61 do Klinsmann

  Cenário: desfazer um perdão
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Fernando
    E eu perdoo o Klinsmann
    E eu começo a desfazer o perdão "Klinsmann → Fernando"
    Então o cartão pergunta "Desfazer o perdão?"
    Quando eu confirmo
    Então o Klinsmann me deve R$ 3,61

  Cenário: quem devia fica sabendo do perdão
    Dado que o Klinsmann já pagou R$ 70,00 pro Fernando
    Quando eu abro o evento como Klinsmann
    E o Fernando perdoa os R$ 3,61 do Klinsmann em outro aparelho
    Então aparece o aviso "🙏 Fernando perdoou teus R$ 3,61"
