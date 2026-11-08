# language: pt
Funcionalidade: A diva cobra sozinha
  Todo dia às 19h de Brasília o cron da Cloudflare acorda a API. Quem tem a receber num evento parado
  ganha um lembrete (no máximo um por semana), e quem recebe ganha um aviso no mêsversário de cada dívida:
  aos 15 dias e depois todo mês. O texto do push é o sw.js que escreve; a API só decide quem e quando.

  Contexto:
    Dado a API no ar

  Regra: o evento parado cobra quem tem a receber

    Cenário: só quem tem a receber é cobrado, e a marca dura uma semana
      Dado um evento parado em que a Ana pagou R$ 30 dividido com a Bia e ninguém mexe há 8 dias
      E que a Ana se inscreveu com o aparelho 1
      E que a Bia se inscreveu com o aparelho 9
      Quando o cron das 19h roda
      Então 1 pessoa é lembrada
      E o aviso vai só para o aparelho 1
      E a marca de lembrete da Ana dura 7 dias
      E a Bia não ganha marca de lembrete

    Cenário: quem já foi lembrado na semana não é cobrado de novo
      Dado um evento parado em que a Ana pagou R$ 30 dividido com a Bia e ninguém mexe há 8 dias
      E que a Ana se inscreveu com o aparelho 1
      E que o cron das 19h rodou
      Quando o cron das 19h roda
      Então 0 pessoas são lembradas
      E foi mandado 1 aviso no total
      E o cron não gravou nada

    Cenário: evento mexido na semana não cobra nem grava nada
      Dado um evento parado em que a Ana pagou R$ 30 dividido com a Bia e ninguém mexe há 6 dias
      E que a Ana se inscreveu com o aparelho 1
      Quando o cron das 19h roda
      Então 0 pessoas são lembradas
      E nenhum aviso foi mandado
      E o cron não gravou nada

    Cenário: a cobrança cabe nos 50 fetch por execução do plano grátis
      Dado um evento parado em que a Ana pagou R$ 30 dividido com a Bia e ninguém mexe há 8 dias
      E 40 eventos em que a Ana está inscrita em 2 aparelhos
      Quando o cron das 19h roda
      Então alguém é lembrado
      E a API fez no máximo 50 chamadas externas

  Regra: o saldo é a mesma conta do app

    Cenário: partes que fecham, centavo que sobra, item apagado e gente que sumiu
      Dado o evento com Ana, Bia e Caio
      E que os lançamentos do evento são:
        | id | tipo  | valor | pagou | para           | partes              | quando       |
        | a  | gasto | 10    | Ana   | Ana, Bia, Caio |                     | há 1 segundo |
        | b  | gasto | 10    | Bia   | Ana, Bia       | Ana 7,00, Bia 3,00  | há 1 segundo |
        | c  | gasto | 10    | Bia   | Ana, Bia       | Ana 0,01, Bia 0,01  | há 1 segundo |
        | x  | gasto | 99    | Caio  | Ana            |                     | há 1 segundo |
        | d  | gasto | 5     | Ana   | Fantasma       |                     | há 1 segundo |
      E que o lançamento "x" foi apagado
      E que o Firebase devolve quem divide cada gasto como objeto de índices
      Então os saldos são:
        | pessoa | saldo |
        | Ana    | -5,34 |
        | Bia    | 8,67  |
        | Caio   | -3,33 |

  Regra: a dívida faz mêsversário

    Esquema do Cenário: aos 15 dias e depois todo mês, no dia de Brasília
      Então a dívida de "<começou>" vista em "<hoje>" tem o último aniversário "<aniversário>"

      Exemplos:
        | começou          | hoje             | aniversário          |
        | 2026-03-01       | 2026-03-15       | nenhum               |
        | 2026-03-01       | 2026-03-16       | 2026-03-16 (15 dias) |
        | 2026-03-01       | 2026-03-31       | 2026-03-16 (15 dias) |
        | 2026-03-01       | 2026-04-01       | 2026-04-01 (1 mês)   |
        | 2026-03-01       | 2026-06-03       | 2026-06-01 (3 meses) |
        | 2026-01-31       | 2026-02-28       | 2026-02-28 (1 mês)   |
        | 2026-01-31       | 2026-03-31       | 2026-03-31 (2 meses) |
        | 2026-03-01 22:00 | 2026-03-15 22:00 | nenhum               |

    Cenário: o mêsversário é de quem recebe, conta do último gasto da dívida e vale por uma semana
      Dado o evento com Ana e Bia
      E que os lançamentos do evento são:
        | id      | tipo      | valor | pagou | para     | por | quando     |
        | g1      | gasto     | 30    | Ana   | Ana, Bia | Ana | 2026-03-01 |
        | pg      | pagamento | 5     | Bia   | Ana      | Bia | 2026-03-31 |
        | apagado | gasto     | 8     | Bia   | Ana, Bia | Bia | 2026-03-30 |
      E que o lançamento "apagado" foi apagado
      Então em 2026-04-01 a Ana tem o mêsversário da dívida da Bia, o de 1 mês, de 2026-04-01
      E em 2026-04-07 a Ana tem o mêsversário da dívida da Bia, o de 1 mês, de 2026-04-01
      E em 2026-04-08 a Ana não tem mêsversário
      E em 2026-04-01 a Bia não tem mêsversário
      Quando a Bia paga o resto: R$ 10 pra Ana em 2026-03-31
      Então em 2026-04-01 a Ana não tem mêsversário

    Cenário: no mêsversário a diva avisa quem recebe, uma vez só, mesmo com o evento mexido
      Dado que hoje é 2026-04-01
      E o evento com Ana e Bia
      E que os lançamentos do evento são:
        | id      | tipo      | valor | pagou | para     | por | quando     |
        | g1      | gasto     | 30    | Ana   | Ana, Bia | Ana | 2026-03-01 |
        | pg      | pagamento | 5     | Bia   | Ana      | Bia | 2026-03-31 |
      E que o evento foi mexido pela última vez em 2026-03-31
      E que a Ana se inscreveu com o aparelho 1
      E que a Bia se inscreveu com o aparelho 9
      Quando o cron das 19h roda
      Então 1 pessoa é lembrada
      E o aviso vai só para o aparelho 1
      E a marca de mêsversário da Bia pra Ana dura 8 dias
      Quando o cron das 19h roda
      Então 0 pessoas são lembradas
      E o cron não gravou nada

    Cenário: num evento parado que faz mêsversário vai um push só, o do aniversário
      Dado um evento parado em que a Ana pagou R$ 30 dividido com a Bia e ninguém mexe há 15 dias
      E que a Ana se inscreveu com o aparelho 1
      Quando o cron das 19h roda
      Então 1 pessoa é lembrada
      E a Ana não ganha marca de lembrete
