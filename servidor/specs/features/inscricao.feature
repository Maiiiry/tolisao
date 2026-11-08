# language: pt
Funcionalidade: Inscrever o aparelho no aviso
  Quem liga o 🔔 no app inscreve o aparelho no aviso do celular. A API guarda a inscrição no KV
  e só aceita pedido de quem já esteve no tô lisa: o site, o localhost, e o dono do tok.

  Contexto:
    Dado a API no ar

  Cenário: o site e o localhost podem usar a API
    Quando eu peço a chave vindo de "https://tolisa.com.br"
    Então a resposta libera a origem "https://tolisa.com.br"
    Quando eu pergunto de "http://localhost:8000" o que a API aceita
    Então a API responde 204
    E a resposta libera a origem "http://localhost:8000"
    E a resposta permite POST

  Esquema do Cenário: outro site não usa a API
    Quando eu peço a chave vindo de "<origem>"
    Então a API responde 403
    E a resposta não libera nenhuma origem

    Exemplos:
      | origem                        |
      | https://tolisa.com.br.mal.com |
      | http://tolisa.com.br          |
      | https://mal.com               |
      | http://localhost.mal.com      |

  Cenário: a chave pública sai até sem Origin (curl, teste de fumaça)
    Quando eu peço a chave sem origem
    Então a resposta traz a chave pública do aviso

  Esquema do Cenário: pedido de inscrição torto é recusado e não grava nada
    Quando eu me inscrevo com sala "<sala>", pessoa "<pessoa>", tok "<tok>", push "<push>" e chaves "<chaves>"
    Então a API responde 400
    E nada foi guardado no KV

    Exemplos:
      | sala   | pessoa  | tok     | push                         | chaves    |
      | curta  | válida  | válido  | válido                       | completas |
      | válida | Ana!    | válido  | válido                       | completas |
      | válida | válida  | curto   | válido                       | completas |
      | válida | válida  | válido  | http://push.exemplo.com/x    | completas |
      | válida | válida  | válido  | válido                       | faltando  |

  Cenário: texto que não é JSON, lista e corpo gigante são recusados
    Quando eu mando em /inscreve o texto "não é json"
    Então a API responde 400
    Quando eu mando em /inscreve o texto "[]"
    Então a API responde 400
    Quando eu mando em /inscreve um pedido de 5000 letras
    Então a API responde 400
    E nada foi guardado no KV

  Cenário: id de aviso torto, método errado e rota que não existe
    Quando eu peço o aviso do lançamento "../x"
    Então a API responde 400
    Quando eu faço um GET em /inscreve
    Então a API responde 405
    Quando eu mando um POST vazio em /nada
    Então a API responde 404

  Cenário: o primeiro tok manda, outro tok é recusado
    Quando a Ana se inscreve com o aparelho 1
    Então a API responde 201
    Quando a Ana se inscreve com o aparelho 2
    Então a API responde 201
    Quando a Ana se inscreve com o aparelho 3 usando outro tok
    Então a API responde 403
    E a Ana tem 2 aparelhos inscritos
    E o tok da Ana não fica guardado como foi enviado

  Cenário: inscrever de novo o mesmo aparelho não gasta gravação
    Dado que a Ana já se inscreveu com o aparelho 1
    Quando a Ana se inscreve de novo com o aparelho 1
    Então a API responde 200
    E nada foi gravado desde então

  Cenário: cada pessoa tem no máximo 5 aparelhos, sai o mais velho
    Quando a Ana se inscreve com os aparelhos de 1 a 7
    Então a Ana tem 5 aparelhos inscritos
    E o aparelho 7 está entre eles
    E o aparelho 1 não está mais

  Cenário: sair do aviso precisa do tok de quem se inscreveu
    Dado que a Ana já se inscreveu com o aparelho 1
    Quando a Ana pede pra sair do aparelho 1 com outro tok
    Então a API responde 403
    Quando a Ana pede pra sair do aparelho 1 com o tok dela
    Então a API responde 200
    E a Ana tem 0 aparelhos inscritos
