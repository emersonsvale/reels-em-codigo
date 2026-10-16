---
name: "reels-edicao"
description: "Edita Reels ponta a ponta com HyperFrames, a partir do vídeo bruto da pessoa falando + o roteiro gravado. Faz cortes por silêncio, J-cuts, zoom alternado entre cortes, legendas em português (Whisper local), título de abertura amarelo fundido, legenda pílula karaokê, painel explicativo animado, split screen, SFX e render final 1080x1920 até 50MB. Use SEMPRE que a pessoa mandar um vídeo bruto pra editar, pedir \"edita esse reels\", \"monta o vídeo\", \"corta isso aqui\", \"põe legenda nesse vídeo\", ou entregar gravação + roteiro juntos, mesmo sem citar a skill."
---

# Edição de Reels

Pipeline determinístico: **vídeo bruto + roteiro → Reel pronto**. Tudo roda local, sem nuvem e sem assinatura.

O motor é o [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache 2.0): a composição é um HTML, o render é headless Chrome + FFmpeg. Mesmo input, mesmo output, sempre.

## PERFIL (leia antes de tudo)

Os dados da pessoa (nome, @ de cada rede, pasta de trabalho, kit de SFX, cor de destaque) ficam em `perfil.json`. Procure nesta ordem:

1. `perfil.json` nesta pasta da skill;
2. `../reels-video-animado/perfil.json` (a skill irmã usa o mesmo arquivo).

Se não existir, copie `perfil.example.json` (desta pasta), pergunte à pessoa os campos numa pergunta só e grave `perfil.json` aqui. Nunca invente @ nem nome. Onde este texto diz `perfil.x`, use o valor do arquivo.

## LIMITE DE TAMANHO: MÁXIMO 50MB

**Nenhum vídeo final pode passar de 50MB** (limite prático de upload e de envio por chat). Mire em ~46MiB (≈48MB) pra ter folga nas duas unidades (MB e MiB).

Como garantir: encode **em 2 passes com bitrate calculado pela duração**, em vez de CRF:

```bash
DUR=<duração em segundos>
VB=$(python3 -c "print(int((46*8388608/$DUR - 192000)/1000))")   # kbps de vídeo; áudio AAC 192k
ffmpeg -y -i <entrada> -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile p2 -pix_fmt yuv420p -an -f mp4 /dev/null
ffmpeg -y -i <entrada> ... -c:v libx264 -preset slow -b:v ${VB}k -maxrate $((VB*13/10))k -bufsize $((VB*2))k -pass 2 -passlogfile p2 \
  -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart final.mp4
```

Num vídeo de 52s isso dá ~7,1Mbps de vídeo e 48,6MB no final, sem perda visível. **Sempre confira o tamanho depois do encode** e, se passar de 50MB, baixe o alvo (ex.: 44MiB) e refaça. Se o bitrate calculado cair abaixo de ~4Mbps (vídeo longo), avise antes de entregar.

Vídeo curto e simples (interface chapada, 30–40s) cabe folgado com `-crf 14`–`18`. Confira o tamanho do mesmo jeito.

## PADRÃO OURO

**Todo vídeo segue este pacote por padrão**, a não ser que a pessoa peça diferente:

1. **Entrega = MP4 final pronto**, 1080x1920, 30fps, **no máximo 50MB**, tudo queimado (título, legenda karaokê, painéis, tags, CTA, SFX). Peças MOV separadas só se pedirem.
2. **Título de abertura** amarelo fundido (padrão fixo abaixo), 0 a ~3s.
3. **Legenda pílula amarela karaokê** o vídeo inteiro (padrão fixo abaixo).
4. **Painel Explicativo** em 3 a 4 momentos de explicação, escolhidos a partir da fala. Um painel pode ter 2 conteúdos em sequência (troca com crossfade sem tirar a moldura). Receitas na seção do painel.
5. **Fora dos painéis:** zoom punch-in (1.04 a 1.09, entrada 0,22s easeOut + drift leve de 0.004/s) nas viradas da fala ("Mas agora", "Prontinho!", "Só que calma aí", CTA), e **tags no topo**: pílula amarela (raio 22, altura 112, Poppins Bold 56) com ícone SVG preto + texto, centro y≈356, reforçando a frase dita ("2 novidades", "Prontinho", "Funciona no celular"). Entrada back.out 0,35s, saída fade + sobe 14px em 0,25s. Tags seguidas trocam uma pela outra.
6. **CTA final:** coração amarelo com contorno preto (≈300px, y≈260) que dá pop 2x no "dois toques", depois botão pílula amarela "+ Seguir" (y≈600) que é apertado (scale .9) e vira preto com texto amarelo "✓ Seguindo". **Sem @**, porque o @ costuma mudar entre redes (veja `perfil.redes`).
7. **SFX do kit** (`perfil.pasta_sfx`, ou `assets/sfx/` desta skill): whoosh na entrada de até 3 painéis, pin em até 3 momentos de dado/CTA. Volume 0.35 (whoosh) e 0.45 (pin), `alimiter` no final. Sem música. Se o kit estiver vazio, gere sons simples com `../reels-video-animado/scripts/gerar_sfx.py`.
8. **Depois do vídeo:** título, descrição e hashtags por plataforma (Instagram, TikTok, YouTube Shorts, Facebook), só com fatos do roteiro.

## ANTES DE EDITAR: pergunte

Antes de começar qualquer edição, **pergunte à pessoa** numa pergunta só (AskUserQuestion), com o padrão ouro como opção recomendada:

1. **Painel Explicativo:** "Sim, você propõe (Recomendado)" / "Sim, mas me mostra antes" / "Não, tela cheia". Nunca use esse layout sem essa resposta. Se escolherem "me mostra antes", mande a lista de momentos + conteúdo pra aprovar antes de renderizar.
2. **Entrega:** "MP4 final pronto (Recomendado)" / "MP4 + peças MOV" / "Só peças MOV".
3. **Cortes de silêncio:** "Sim, corta os silêncios" / "Não, mantém o vídeo inteiro".
4. Se o vídeo **já vier com título e legenda** prontos, confirme se é só pra acrescentar elementos (ex.: logos animadas) sem refazer nada.

Só siga depois da resposta. A palavra final é sempre de quem pediu.

## PADRÃO FIXO DE TÍTULO E LEGENDA

**Todo Reel usa este modelo de título e legenda.** Ele substitui o que `references/sistema-visual.md` diz sobre título (serifada em card de papel) e legenda (texto branco com scrim escuro). Essas duas partes do sistema visual NÃO valem. O resto (gráficos, split, zoom, safe zones) continua valendo.

### Cor única

```css
--amarelo: #FDD400;   /* fundo do título e da legenda (ou perfil.cor_destaque) */
--preto:   #000000;   /* texto */
```

Sem outra cor no título nem na legenda. Nada de contorno, sombra forte ou gradiente.

### Título de abertura

- **Texto:** o gancho do roteiro, em **CAIXA ALTA**, até **3 linhas** curtas (ex.: `AS MELHORES / FERRAMENTAS DE / IA PARA OUT/2026`). Quebre as linhas na mão pra ficarem equilibradas.
- **Caixa:** fundo amarelo colado no texto, **uma caixa por linha que se fundem num bloco só** (estilo "texto com fundo" do TikTok/Instagram): cada linha tem a largura dela, e onde a linha de cima é mais estreita que a de baixo a junção faz um canto côncavo arredondado. Cantos com raio ~16px. Padding horizontal ~32px.
- **Fonte:** sans grotesca pesada (peso 800–900), preto, tracking levemente negativo. Pilha: `"Inter", "Segoe UI Black", "Arial Black", sans-serif` com `font-weight: 900`. Sem Inter Black instalada, baixe de github.com/rsms/inter/releases (extras/ttf/Inter-Black.ttf) e carregue via @font-face.
- **Tamanho:** ~96px de fonte, entrelinha ~112px, letter-spacing -2px (3 linhas ocupam ~380px de altura).
- **Posição:** centralizado, topo do bloco em **y ≈ 218px**, largura máxima ~880px (x 100–980).
- **Tempo:** entra em 0s e fica **~3s**, saindo antes da segunda frase. Entrada rápida (fade + subida de 20–30px, 0,3s), saída em fade de 0,25s.

Como montar a caixa fundida no HTML: **duas camadas idênticas empilhadas**. Camada de baixo: `<p>` com `display:inline` + `background: var(--amarelo)` + texto `color: transparent` + `box-decoration-break: clone; -webkit-box-decoration-break: clone;` + `padding: 4px 32px`, com `line-height` 112px pra as linhas encostarem, e o bloco com `filter:url(#goo)` (SVG: `feGaussianBlur stdDeviation=9` → `feColorMatrix` alpha `0 0 0 28 -12` → `feComposite operator=atop` com a SourceGraphic). Camada de cima: o mesmo `<p>` sem fundo, texto preto. O goo arredonda e funde o fundo, e o texto de cima fica nítido.

### Legenda

- **Estilo:** **pílula amarela**, texto **preto**, raio ~14px, **uma linha só**.
- **Texto:** caixa normal, mantém a pontuação. **Até 4 palavras por cue** (`MAX_WORDS = 4` no `build-composition.mjs`), quebrando também em pontuação e em pausa maior que 0,45s. A cue fica até o início da próxima (no máximo 0,6s depois da última palavra).
- **Fonte:** sans geométrica **bold 700–800**, ~50px. Pilha: `"Figtree", "Plus Jakarta Sans", "Poppins", "Segoe UI", sans-serif`.
- **Caixa:** altura ~84px, padding horizontal ~16–18px, largura se ajusta ao texto.
- **Posição:** centralizada, **centro em y ≈ 1587px** (~83% da altura). Acima da UI do Instagram e abaixo do rosto. (No Painel Explicativo ela muda de lugar.)
- **Karaokê palavra a palavra:** palavra já falada em **preto cheio**; as que ainda vêm em **preto a ~55% de opacidade**. A virada acontece no `start` de cada palavra do `transcript.json`, convertido pro tempo da timeline.
- **Entrada/saída da cue:** troca seca ou pop curtíssimo (scale 0,92→1 em 0,1s).

Implementação no `build-composition.mjs`: cada cue vira `<div class="cue">` com uma `<span class="w">` por palavra. No CSS, `.cue .w { opacity: .55 }`; na timeline GSAP, `tl.set(span, { opacity: 1 }, tempoDaPalavraNaTimeline)` pra cada palavra.

### O que não fazer

- Não voltar pra legenda branca com scrim nem pro título serifado em card de papel.
- Não usar caixa alta na legenda nem mais de uma linha.
- Não trocar o amarelo por outra cor no título ou na legenda (a não ser `perfil.cor_destaque`).
- Se o vídeo **já tem** título e legenda, não refazer. Só acrescentar o que foi pedido.

## LAYOUT PAINEL EXPLICATIVO (só com confirmação)

Pra momentos de **explicação**: gráfico, imagem, print, lista, número ou informação. A pessoa sai da tela cheia e vai pra uma **moldura arredondada embaixo**, e o conteúdo aparece **em cima**, sobre fundo claro pontilhado. **Sempre animado**, nunca estático.

### Composição (1080×1920)

```css
--papel:      #F0EFE8;   /* fundo claro, levemente quente */
--ponto:      #C9C7BE;   /* pontos da trama */
--tinta:      #1A1A1A;   /* título do painel e textos */
--linha:      #9A988F;   /* linha dos gráficos pontilhados */
```

| Elemento | Posição / tamanho |
|---|---|
| **Fundo** | tela inteira `--papel`, com trama de pontos (Ø ~4px, espaçamento ~14px, cor `--ponto`, opacidade ~.55). **O fundo do stage também tem que ser `--papel`**, senão aparece faixa escura enquanto a moldura encolhe |
| **Título do painel** | centralizado, y ≈ 92–125px, sans arredondada peso 500–600, ~50px, `--tinta`. Pilha: `"Outfit", "Quicksand", "Figtree", "Poppins", sans-serif` |
| **Zona de conteúdo** | x 60–1020, y 180–860 |
| **Moldura do vídeo** | x 86–994, y 870–1785 (~908×915), squircle raio ~180px, borda clara fina (~6px `#fff` a 80%), `object-fit: cover`, `object-position: 50% 35%` |
| **Legenda** | a mesma pílula, centralizada no **topo da moldura**, centro em y ≈ 955px |

A trama de pontos pode formar um **gráfico de área pontilhado** por trás da moldura (área abaixo da linha preenchida com pontos). Use quando o conteúdo for evolução. Nos outros casos, trama uniforme e suave.

### Tipos de conteúdo

- **`grafico`**: linha/área pontilhada ou barras arredondadas. Rótulos curtos em `--tinta`, destaque de 1 valor em amarelo.
- **`imagem`**: print, logo ou foto num card branco com raio 32px e sombra suave.
- **`lista`**: até 4 itens, marcador redondo.
- **`numero`**: número grande (~200px) com linha de apoio.
- **`info`**: frase curta (até 8 palavras).

### Receitas de conteúdo (reutilize e adapte)

- **Juntar coisas**: 4 tiles brancos (raio 32, altura 124, Poppins Bold 48, bolinha cinza) espalhados, entram com stagger 0,12s back.out e flutuam; no verbo da fala convergem pro centro, encolhem e somem dentro de um card grande que dá pop com nome + subtítulo.
- **Antes/confusão**: janela de navegador (card branco, 3 bolinhas, 7 abas em stagger), cursor SVG indo e voltando, e 3 bolhas amarelas "?" com pop e balanço.
- **Documento**: card branco com barra amarela de título crescendo, linhas cinza se desenhando (~0,32s cada), cursor piscando, etiqueta preta inclinada.
- **Slides**: 3 cards 16:9 sobem com stagger e abrem em leque (-12°, 0, 12°); o da frente tem barras crescendo (uma amarela).
- **Passo a passo**: até 3 itens com círculo amarelo numerado (Inter Black) + texto Poppins Bold 58, entrando da esquerda no tempo da fala; depois selos com pop e leve rotação.
- **Liberação/status**: barra de progresso listrada amarela enchendo, cards de plano com "liberado ✓" entrando no nome falado, card "em breve" pulsando no fechamento.

### Animação (obrigatória)

**Entrada (~0,6s):**
1. O vídeo em tela cheia **encolhe e arredonda** até a moldura (`left/top/width/height` e `border-radius` 0→180px, `power3.inOut`).
2. Junto, o fundo `--papel` surge em fade e a trama aparece em onda de baixo pra cima.
3. A legenda desliza de y 1587 pro topo da moldura (y 955).
4. Título do painel entra em fade + subida de 20px, 0,1s depois.
5. O conteúdo se **constrói** 0,2s depois: linha se desenha (`stroke-dashoffset`, ~0,8s); barras crescem com stagger 0,08s; imagem dá pop (0,9→1, −3°→0, `back.out`); lista entra item a item (0,12s); número conta de 0 ao valor (~0,7s).

**Durante:** nada pulando. No máximo flutuação de 4–6px. Troca de conteúdo: crossfade de 0,3s **sem** tirar a moldura.

**Saída (~0,5s):** conteúdo e título sobem e somem (fade + y −20px), a moldura **expande de volta** pra tela cheia com raio indo a 0, legenda volta pra y 1587.

### No plan.json

```json
"painel": [
  {
    "inicio": 8.4, "fim": 14.0,
    "titulo": "Número 1",
    "tipo": "grafico",
    "conteudo": { "forma": "area", "pontos": [12, 18, 15, 22, 30, 26, 34] }
  }
]
```

Tempos na **timeline final**. Painel dura no mínimo ~3s. Painéis seguidos mantêm a moldura e só trocam o conteúdo. Entre painéis, pelo menos ~1,8s de rosto em tela cheia.

## FLUXO EM AMBIENTE SEM NPM/PYPI (ex.: Cowork na nuvem)

Quando npm e PyPI estão bloqueados mas GitHub releases funcionam:

1. **Acesso:** peça acesso à pasta do vídeo e à do kit de SFX. Não converta em VM fraca; converta onde tiver CPU.
2. **Proxy 1080:** `ffmpeg -vf "scale=1080:1920:flags=lanczos,fps=30" -c:v libx264 -preset veryfast -crf 16 -c:a aac -b:a 192k -ar 48000` em background, e áudio 16k mono pra transcrição.
3. **Transcrição:** sherpa-onnx via GitHub releases. Binário: `https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.14/sherpa-onnx-v1.12.14-linux-x64-shared.tar.bz2` (rodar com `LD_LIBRARY_PATH=<pasta>/lib`). Modelo: `.../releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2`. Fatie o áudio em pedaços de 1,6 a 3,4s cortando no ponto de menor energia (+0,3s de silêncio nas pontas), transcreva com `sherpa-onnx-offline --whisper-language=pt --num-threads=2`, e retranscreva janelas duvidosas com outros limites. VAD+ASR de uma vez engole frases.
4. **Corrija a transcrição na mão:** nomes próprios e trechos cortados, conferindo com o roteiro.
5. **Tempo por palavra:** em cada pedaço, distribua as palavras só sobre os frames com voz (RMS de 10ms, suavizado, acima de percentil20 + 12dB), peso = nº de letras + 1,5.
6. **Composição:** HTML único com `render(t)` determinística (sem GSAP: easings próprios easeOutCubic, easeInOutCubic, backOut). O vídeo entra como `<img>` trocando pra `frames/fNNNNN.jpg` (extraídos com `ffmpeg -q:v 3`) com `await img.decode()`. Fontes locais via @font-face. Palavras injetadas como JSON.
7. **Preview:** ~12 tempos-chave num contact sheet antes do render cheio. Confira título, legenda, painel sem colidir com o título do painel, nada sobre a boca, frames de transição da moldura.
8. **Render:** Playwright (python) 1080x1920, `page.evaluate(render(i/30))` + screenshot JPEG q93, em 2 processos paralelos. Áudio do proxy + SFX com `adelay`, `amix normalize=0`, `alimiter=limit=0.95`. **Encode final em 2 passes** (seção LIMITE), conferindo < 50MB.
9. **Entrega:** se a ferramenta de envio tiver limite por arquivo (ex.: 20MB), divida com `tar cf - final.mp4 | split -b 18M -d - t.part`, junte no destino com `cat t.part0* | tar xf -` e **confira o md5**. Salve como `<nome-original>_editado.mp4` ao lado do bruto.

## FLUXO LOCAL (HyperFrames)

### Onde ficam os scripts

Instale a skill numa pasta fixa (ex.: `~/.claude/skills/reels-edicao/`). Os scripts PowerShell se localizam sozinhos (`$PSScriptRoot`). Pra chamar os `.mjs` direto, passe o caminho:

```powershell
node "<pasta-da-skill>\scripts\plan-cuts.mjs" .
```

### Antes de começar

Uma vez por máquina:

```bash
node -v            # precisa 22+
ffmpeg -version
npx hyperframes doctor
```

### Estrutura de pastas

```
<perfil.pasta_trabalho>\
├── SFX\                     kit: pin, rise, boom, whoosh, pop
├── reel-01\
│   ├── gravacao.mp4         o bruto (qualquer nome, o script acha sozinho)
│   ├── roteiro.md           o roteiro gravado
│   └── projeto\             criado pelo script; o bruto nunca é tocado
└── reel-02\
```

Uma pasta por vídeo. O `SFX\` fica na raiz e é copiado pra dentro de cada projeto.

### 0. Perguntar

Veja **ANTES DE EDITAR: pergunte**. Sem resposta, não siga.

### 1. Preparar: um comando

```powershell
cd <perfil.pasta_trabalho>
& "<pasta-da-skill>\scripts\novo-reel.ps1" reel-01
```

Acha o bruto, faz o scaffold com `hyperframes init --resolution portrait`, copia roteiro e SFX, extrai o áudio, transcreve em português e planeja os cortes. Termina com o `plan.json` escrito.

Flags: `-Base` pra mudar a raiz (padrão: pasta atual), `-Modelo medium` pra transcrição mais precisa (e mais lenta).

### 2. A passada criativa (é aqui que se trabalha)

Abra `projeto\plan.json` e preencha, **lendo o `roteiro.md`**:

- **`titulo`**: o gancho em CAIXA ALTA, até 3 linhas curtas. Entra em 0s, dura ~3s.
- **`painel`**: só se a pessoa confirmou o Painel Explicativo.
- **`graficos`**: um por informação que ganha sendo *vista*: número, lista, comparação, nome de ferramenta. Tipos: `card`, `lista`, `numero`.
- **`split`**: gráfico em cima, pessoa embaixo. Use quando ela está *explicando* o gráfico. (Com Painel Explicativo, prefira o painel.)
- **`soVoz`**: só animação na tela, com a voz por cima.
- **`sfx`**: ver [references/sfx.md](references/sfx.md).
- **`cta`**: no padrão ouro, coração duplo + botão Seguir, sem @.

Tempos em `painel`, `graficos`, `split`, `soVoz` e `sfx` são **na timeline final** (depois dos cortes). Use o campo `text` de cada segmento do `plan.json` pra achar o momento.

Regra de ouro: **gráfico é escasso**. Um Reel de 30s aguenta 2 ou 3. Todo motion fica ligado a uma frase dita naquele instante.

[references/plan-exemplo.json](references/plan-exemplo.json) tem um preenchido.

### 3. Revisar

```powershell
& "<pasta-da-skill>\scripts\montar.ps1" reel-01
```

Compila o `index.html` e abre o preview em `localhost:3002`. Confira: lip sync nos cortes, título e legenda no padrão (karaokê funcionando), painel entrando e saindo animado sem faixa escura, gráfico na safe zone, CTA fora da UI do Instagram.

### 4. Renderizar

```powershell
& "<pasta-da-skill>\scripts\montar.ps1" reel-01 -Render
& "<pasta-da-skill>\scripts\montar.ps1" reel-01 -Render -Qualidade draft   # rascunho rápido
```

Sai em `projeto\final.mp4`. **Se passar de 50MB**, reencode em 2 passes antes de entregar.

## Rodando na mão

```powershell
$SKILL = "<pasta-da-skill>"
cd <perfil.pasta_trabalho>\reel-01\projeto

ffmpeg -y -i gravacao.mp4 -vn -c:a pcm_s16le -ar 48000 source-audio.wav
npx hyperframes transcribe gravacao.mp4 --model small --language pt
node "$SKILL\scripts\plan-cuts.mjs" .
node "$SKILL\scripts\build-composition.mjs" .
npx hyperframes preview
npx hyperframes render --quality high --output final.mp4
```

Parâmetros do `plan-cuts.mjs`:

| Flag | Padrão | O que faz |
|---|---|---|
| `--silence` | `0.35` | silêncio a partir do qual corta. Menor = mais cortes |
| `--jcut` | `0.18` | quanto o áudio antecede a imagem |
| `--zoom` | `1.08` | zoom dos cortes ímpares |
| `--min-seg` | `0.7` | segmento menor que isso funde no anterior |

## Como o J-cut funciona

O áudio corre contínuo: segmento `i` ocupa `[T_i, T_i + D_i)`. A **imagem** entra `jcutLead` segundos **depois** do áudio. Você ouve a próxima frase enquanto ainda vê o fim do plano anterior, e isso dá sensação de conversa em vez de colagem.

Pra o lip sync não quebrar, o in-point da mídia anda o mesmo tanto que o `data-start`. O `build-composition.mjs` já faz essa conta: **não mexa nela na mão**.

O plano anterior precisa de `jcutLead` segundos de imagem além do áudio. Essa sobra vem do silêncio cortado, então o `plan-cuts.mjs` limita o lead a 90% do silêncio disponível.

## Referências

- [references/schema-hyperframes.md](references/schema-hyperframes.md): contrato do HTML e armadilhas que quebram render
- [references/sistema-visual.md](references/sistema-visual.md): tokens, safe zones do 9:16 e zoom. **Título, legenda e Painel Explicativo seguem os padrões desta página, não os de lá.**
- [references/sfx.md](references/sfx.md): nomes dos arquivos e quando usar cada som
