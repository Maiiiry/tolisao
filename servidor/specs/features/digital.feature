# language: pt
Funcionalidade: Entrar com a digital
  A lista de eventos do aparelho (código e quem sou eu em cada um) fica guardada atrás de uma passkey.
  Noutro celular, ou depois de limpar o navegador, a digital devolve a lista. A API não usa CBOR nem
  biblioteca: confere a assinatura ES256 com o WebCrypto. O `tok` do pix nunca vem pra cá.

  Contexto:
    Dado a API no ar
    E que meu celular tem uma digital

  Cenário: guardar e entrar: a lista volta com quem sou eu em cada evento
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
      | praia-x1y2z3   |     |
    Quando eu entro com a digital
    Então a API responde 200
    E voltam os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
      | praia-x1y2z3   |     |

  Cenário: assinatura de outra chave não entra
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital assinando com a chave de outro celular
    Então a API recusa com 403 "assinatura não bate"

  Cenário: assinatura mexida depois de assinar não entra
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital depois de mexer no contador já assinado
    Então a API recusa com 403 "assinatura não bate"

  Cenário: o desafio vale uma vez só
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital
    E eu repito o mesmo pedido de entrada
    Então a API recusa com 403 "desafio vencido"

  Cenário: desafio inventado ou velho não passa
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital num desafio que a API nunca deu
    Então a API recusa com 403 "desafio vencido"
    Quando eu entro com a digital num desafio de 6 minutos atrás
    Então a API recusa com 403 "desafio vencido"

  Cenário: o desafio vem com prazo de 5 minutos no KV
    Quando eu peço um desafio
    Então o desafio dura 300 segundos no KV

  Cenário: outra origem não guarda nem entra, e gasta o desafio do mesmo jeito
    Quando eu guardo a digital vindo de "https://tolisa.com.br.mal.com"
    Então a API recusa com 403 "origem estranha"
    E o desafio foi gasto
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital vindo de "https://mal.com"
    Então a API recusa com 403 "origem estranha"

  Cenário: passkey de outro site (rpId) não passa
    Quando eu guardo a digital de uma passkey do site "mal.com"
    Então a API recusa com 403 "rpId estranho"
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital de uma passkey do site "mal.com"
    Então a API recusa com 403 "rpId estranho"

  Cenário: no localhost o rpId é localhost
    Quando eu guardo a digital pelo "http://localhost:8000" com a passkey de "localhost"
    Então a API responde 201

  Cenário: sem a pessoa tocar no leitor, não entra
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital sem ninguém ter tocado no leitor
    Então a API recusa com 403 "ninguém tocou"

  Cenário: o contador só anda pra frente (passkey clonada não entra)
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu entro com a digital com o contador em 5
    Então a API responde 200
    Quando eu entro com a digital com o contador em 5
    Então a API recusa com 403 "contador voltou"
    Quando eu entro com a digital com o contador em 6
    Então a API responde 200

  Cenário: passkey sincronizada fica no 0 e entra sem gravar a digital de novo
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    E que eu entrei com a digital
    Quando eu entro com a digital
    Então só o desafio foi gravado no KV

  Cenário: guardar de novo junta a lista, e o "eu" novo vence
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
      | praia-x1y2z3   |     |
    Quando eu guardo de novo, já com a digital cadastrada, os eventos:
      | código         | eu   |
      | praia-x1y2z3   | bia  |
      | bar-a1b2c3     | caio |
    Então a API responde 200 com 3 eventos
    Quando eu entro com a digital
    Então voltam os eventos:
      | código         | eu   |
      | churras-k7f3q9 | ana  |
      | praia-x1y2z3   | bia  |
      | bar-a1b2c3     | caio |

  Cenário: não se cadastra por cima de uma passkey que já existe
    Dado que a digital guardou os eventos:
      | código         | eu  |
      | churras-k7f3q9 | ana |
    Quando eu cadastro a mesma passkey outra vez
    Então a API responde 409

  Cenário: digital desconhecida não entra
    Quando eu entro com a digital
    Então a API responde 404

  Esquema do Cenário: pedido de guardar torto é recusado e não cadastra nada
    Quando eu guardo a digital com <defeito>
    Então a API responde 400
    E nenhuma digital foi cadastrada

    Exemplos:
      | defeito                              |
      | um código de evento em maiúscula     |
      | um "eu" com caractere estranho       |
      | eventos que não são uma lista        |
      | mais de 100 eventos                  |
      | um algoritmo que não é ES256         |
      | um id com ../                        |
      | dados que não são base64             |

  Cenário: a assinatura em DER volta a ser a r||s do WebCrypto
    Então uma assinatura em DER vira r||s, e uma torta é recusada
    E eventos repetidos na lista contam uma vez só
