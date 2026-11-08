# Contas de verdade

Fotos de conta tiradas no bar, cada uma com o gabarito do lado: o que está escrito no papel. Eram a régua do leitor de foto do site (o tesseract, que saiu em 01/11/2026: lia metade à noite e inventava número). Ficam como base realista pra testar a foto da conta no anotar e qualquer leitor de conta que vier (o 📋 de colar o texto, que usava o texto copiado do celular, saiu do app).

## Pôr uma conta nova

1. A foto do jeito que o celular tirou, sem cortar nem girar: é o que a pessoa manda no app. Sem a localização (o GPS do EXIF); ficam marca, modelo, data e a orientação, que o navegador usa pra desvirar:

```sh
python3 - foto.jpg specs/contas/AAAA-MM-DD-lugar.jpg <<'PY'
import sys
from PIL import Image
i = Image.open(sys.argv[1]); velho = i.getexif(); novo = Image.Exif()
for k in (271, 272, 274, 306):  # marca, modelo, orientação, data
    if k in velho: novo[k] = velho[k]
i.save(sys.argv[2], quality='keep', exif=novo.tobytes())
PY
```

2. Do lado, o `.json` de mesmo nome, com o que está no papel. Dinheiro em centavos:

```json
{
  "onde": "onde foi",
  "como": "luz, mão, papel, e o que essa conta tem de difícil",
  "itens": [{ "nome": "BUDWEISER 600ML", "qtd": 6, "un": 1890, "total": 11340 }],
  "servico": 1792,
  "total": 25712,
  "outros": [17920, 12856]
}
```

`itens` na ordem do papel, um por linha da conta (item repetido aparece duas vezes). O `un` só quando o papel imprime o unitário. `outros` são os preços que estão no papel e não são item: subtotal, valor por pessoa, couvert separado. 

As fotos não vão pro site (o `pages.yml` tira esta pasta).

## O que o tesseract media (histórico)


31/10/2026, com a leitura esticada de reserva:

| conta | modo | itens | nome | total | inventou |
|---|---|---|---|---|---|
| 2026-10-23-caranguejo | cinza | 3/4 | 2/4 | não | 1 |
| 2026-10-23-caranguejo | contraste | 4/4 | 2/4 | não | 0 |
| 2026-10-29-xmenu | cinza | 6/9 | 0/9 | sim | 4 |
| 2026-10-29-xmenu | contraste | 3/9 | 0/9 | sim | 4 |
| 2026-10-30-oxemenu | cinza | 6/6 | 0/6 | sim | 0 |
| 2026-10-30-oxemenu | contraste | 1/6 | 0/6 | não | 1 |
| 2026-10-31-davis | cinza | 4/10 | 0/10 | não | 0 |
| 2026-10-31-davis | contraste | 3/10 | 0/10 | sim | 0 |
| 2026-10-31-toca-do-indio | cinza | 2/3 | 0/3 | não | 3 |
| 2026-10-31-toca-do-indio | contraste | 0/3 | 0/3 | não | 1 |

- **caranguejo**: o total de cada item e o TOTAL saem cortados na beirada (`257,1(`); os itens vêm do "qtd x unitário". Em cinza o "1 UND x 32,90" do Moscow Mule vira 7 (230,30).
- **xmenu**: conta em colunas (PRODUTO, QTDE, PRECO, VALOR), sem o "x", com ponto no decimal. O leitor só vê preço solto: não dá nome a nenhum, apaga o unitário de uns e não de outros, e troca 0 por 6 e 6 por 8 (19,06, 18,00). Nome de item quebra em duas linhas.
- **oxemenu**: a quantidade vem antes do nome (`9 CERVEJA ORIGINAL 600ML  R$ 126,00`), sem unitário. Em cinza ele acha todos os preços, mas nenhum com nome (só o `qtd x unitário` dá nome). Com mais contraste, a sombra do dedo e o flash apagam quase tudo: só sobram 4,00 e o subtotal.
- **davis**: colunas qtd, nome, unitário e total, com tracejado entre os itens e a sombra da mão atravessando a conta. Acha só os itens de fora da sombra; nome quebra no meio da palavra (`C/ Q` / `UEIJ.`).
- **toca-do-indio**: fonte estreita, zero cortado e pontilhado do nome até o preço (`BRAHMA CHOPP......9X.....R$12,00`); com quantidade, o total vem na linha de baixo (`-TOTAL ITEM....R$108,00`). Não acha preço nenhum: o pontilhado vira lixo, e o `R$` grudado no número faz a palavra não parecer preço.

## O que já se tentou

- **`R$` grudado e pontilhado antes do preço** (`FRANGO.....1X.....R$10,00`): saem antes de casar o preço. Ficou. Nas cinco contas não muda nada, porque o leitor quase não lê essas linhas; na Toca do Índio, com mais contraste, ele agora acha um `R$106,00` (era 108,00).
- **Apagar o pontilhado da foto antes de ler** (fileira de manchas pequenas e iguais, sem nada em cima e embaixo, pintada da cor do papel): a Toca do Índio fica limpa e o leitor continua sem ler (`npm run ocr -- toca --texto`); nas outras, tirar o tracejado mudou a leitura pra pior (de 28 itens achados pra 23, e de 10 preços inventados pra 12). Ficou de fora. O problema da Toca é a letra estreita e alta: esticando a foto 2× na horizontal ele lê `R$108,00`, `R$12,40` e `R$136,40`.
- **Esticar a foto na largura**: sempre esticada, cada conta reage de um jeito (1,5×: em cinza, de 17 itens achados pra 18; 2×: 15, com 13 inventados; a Toca do Índio só sai a 2×). Ficou como reserva: a primeira leitura achou menos de 3 preços, ele lê de novo a 2× e fica com a que achou mais. Em cinza, de 17 itens achados pra 21 (Davi's 2 → 4, Toca do Índio 0 → 2), e de 5 inventados pra 8: na Toca o zero cortado ainda vira outro algarismo (`R$6,00` sai `60,00`, `124,00` sai `120,00`). Quando lê duas vezes, demora o dobro.
