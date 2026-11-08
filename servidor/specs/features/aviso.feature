# language: pt
Funcionalidade: Avisar no celular
  Quando alguém marca que te pagou, te perdoa, ou anota um gasto com você, o app pede pra API avisar.
  A API não confia no corpo do pedido: relê o lançamento no Firebase e avisa só quem deve ser avisado,
  uma vez só, e só se o lançamento for de agora.

  Contexto:
    Dado a API no ar
    E o evento com Ana e Bia

  Cenário: o pagamento avisa quem recebeu, uma vez só
    Dado que os lançamentos do evento são:
      | id  | tipo      | valor | pagou | para | por | quando         |
      | pg1 | pagamento | 10    | Bia   | Ana  | Bia | há 1 segundo   |
    E que a Ana se inscreveu com o aparelho 1
    E que a Bia se inscreveu com o aparelho 9
    Quando o app avisa do lançamento "pg1"
    Então a API diz que 1 pessoa foi avisada
    E o aviso vai só para o aparelho 1
    E o aviso foi mandado como o serviço de push exige
    Quando o app avisa do lançamento "pg1"
    Então a API diz que 0 pessoas foram avisadas
    E nenhum aviso novo foi mandado
    E a marca de aviso do lançamento "pg1" some em 1 dia

  Cenário: o perdão avisa quem devia, não quem perdoou
    Dado que os lançamentos do evento são:
      | id  | tipo   | valor | pagou | para | por | quando       |
      | pd1 | perdão | 5     | Bia   | Ana  | Ana | há 1 segundo |
    E que a Ana se inscreveu com o aparelho 1
    E que a Bia se inscreveu com o aparelho 9
    Quando o app avisa do lançamento "pd1"
    Então o aviso vai só para o aparelho 9

  Cenário: quem marcou que recebeu não é avisado do próprio clique
    Dado que os lançamentos do evento são:
      | id  | tipo      | valor | pagou | para | por | quando       |
      | rc1 | pagamento | 5     | Bia   | Ana  | Ana | há 1 segundo |
    E que a Ana se inscreveu com o aparelho 1
    Quando o app avisa do lançamento "rc1"
    Então a API diz que 0 pessoas foram avisadas
    E nenhum aviso foi mandado

  Cenário: gasto novo avisa quem divide e quem pagou, menos quem anotou, uma vez só
    Dado o evento com Ana, Bia e Caio
    E que os lançamentos do evento são:
      | id | tipo  | valor | pagou | para     | por | quando       |
      | g1 | gasto | 90    | Caio  | Ana, Bia | Ana | há 1 segundo |
    E que a Ana se inscreveu com o aparelho 1
    E que a Bia se inscreveu com o aparelho 9
    E que o Caio se inscreveu com o aparelho 7
    Quando o app avisa do lançamento "g1"
    Então a API diz que 2 pessoas foram avisadas
    E o aviso vai para os aparelhos 7 e 9
    Quando o app avisa de novo do lançamento "g1"
    Então a API diz que 0 pessoas foram avisadas
    E foram mandados 2 avisos no total

  Cenário: gasto de aparelho antigo, que só guardou o nome de quem anotou, também não avisa quem anotou
    Dado que os lançamentos do evento são:
      | id | tipo  | valor | pagou | para     | por              | quando       |
      | g2 | gasto | 20    | Bia   | Ana, Bia | Bia (só o nome)  | há 1 segundo |
    E que a Ana se inscreveu com o aparelho 1
    E que a Bia se inscreveu com o aparelho 9
    Quando o app avisa do lançamento "g2"
    Então o aviso vai só para o aparelho 1

  Esquema do Cenário: lançamento velho, apagado ou inexistente não avisa
    Dado que os lançamentos do evento são:
      | id        | tipo      | valor | pagou | para     | por | quando         |
      | gvelho    | gasto     | 20    | Bia   | Ana      | Bia | há 11 minutos  |
      | gapagado  | gasto     | 20    | Bia   | Ana      | Bia | há 1 segundo   |
      | pvelho    | pagamento | 5     | Bia   | Ana      | Bia | há 11 minutos  |
    E que o lançamento "gapagado" foi apagado
    E que a Ana se inscreveu com o aparelho 1
    Quando o app avisa do lançamento "<id>"
    Então a API responde 404
    E nenhum aviso foi mandado

    Exemplos:
      | id        |
      | gvelho    |
      | gapagado  |
      | pvelho    |
      | naoexiste |

  Cenário: sem ninguém inscrito, o aviso não gasta gravação
    Dado que os lançamentos do evento são:
      | id  | tipo      | valor | pagou | para | por | quando       |
      | pg1 | pagamento | 10    | Bia   | Ana  | Bia | há 1 segundo |
    Quando o app avisa do lançamento "pg1"
    Então a API diz que 0 pessoas foram avisadas
    E nada foi gravado no KV até agora

  Cenário: a inscrição que o celular apagou (410) sai do KV
    Dado que os lançamentos do evento são:
      | id  | tipo      | valor | pagou | para | por | quando       |
      | pg1 | pagamento | 10    | Bia   | Ana  | Bia | há 1 segundo |
    E que a Ana se inscreveu com o aparelho 1
    E que o serviço de push responde que a inscrição morreu
    Quando o app avisa do lançamento "pg1"
    Então a Ana tem 0 aparelhos inscritos

  Cenário: o aviso é assinado com a chave VAPID do Worker
    Quando a API assina um aviso para "https://fcm.googleapis.com/fcm/send/abc" no instante 1800000000
    Então o token é ES256 e diz quem manda, pra quem e até quando
    E a assinatura confere com a chave pública
