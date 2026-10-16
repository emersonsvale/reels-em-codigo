---
name: "reels-video-animado"
description: "Transforma um roteiro de dica em Reel 100% animado em código (HyperFrames + HTML/GSAP/Three.js), sem a pessoa gravar nada: storyboard pra aprovar, narração com Gemini TTS, título amarelo fundido, legenda karaokê, SFX, card final com foto e @, MP4 1080x1920 até 50MB. Varia o estilo visual a cada vídeo (3D low-poly, interface animada, motion tipográfico, colagem, infográfico, vetor, whiteboard). Use quando pedirem \"vídeo animado\", \"reel sem gravar\", \"transforma esse roteiro em vídeo\", \"faz o vídeo da dica de hoje\" ou mandarem um roteiro pedindo o vídeo pronto."
---

# Reel animado a partir de roteiro

Roteiro de dica prática vira um Reel animado, fluido, sem a pessoa gravar nada. Tudo é código: HTML + CSS/GSAP (ou Three.js) renderizado quadro a quadro em Chromium, narração por TTS e montagem com FFmpeg. Nada de ferramenta de vídeo paga.

## PERFIL (leia antes de tudo)

Nome, @ de cada rede, foto, cor de destaque, texto do card final, pastas e voz ficam em `perfil.json` nesta pasta (ou em `../reels-edicao/perfil.json`). Se não existir: copie `perfil.example.json`, pergunte à pessoa os campos numa pergunta só e grave `perfil.json`. Peça uma foto de pelo menos 640px (ela vira um círculo de 320px). Nunca invente @, nome ou foto. Onde este texto diz `perfil.x`, use o valor do arquivo.

## Regras de produção

- **Voz: Gemini TTS** (seção 2). Ela não precisa gravar.
- **Técnica: código.** HyperFrames + HTML/GSAP/Three.js. Nada pago, nenhum crédito gasto sem a pessoa aprovar o preço antes.
- **Entrega:** MP4 pronto. Se houver `perfil.pasta_saida`, salve lá. Só diga que salvou depois de conferir que o arquivo existe no destino.
- **Nome do arquivo:** `AAAA-MM-DD-tema-curto-estilo.mp4` (ex.: `2026-10-15-ata-reuniao-lowpoly.mp4`).
- **Estilo varia:** escolha um estilo da biblioteca por vídeo e não repita o do vídeo anterior.
- **STORYBOARD PRIMEIRO:** antes de animar, entregue um storyboard (imagem com uma cena por quadro: tempo, fala, o que aparece, câmera) e espere o OK. Só depois anime e renderize. Em rotina automática sem ninguém pra aprovar, entregue só o storyboard e pare.
- **A pessoa decide sempre.** Se pedir outro estilo, roteiro ou voz, siga.
- **Não publica.** Não agenda, não cria post, não sobe em rede nenhuma.

## Regras de conteúdo

- Os fatos vêm do roteiro. Não invente número, nome de produto ou recurso. Se o roteiro tiver fonte/data, respeite.
- Texto na tela: o que o roteiro diz, só que mais curto. Nada que o roteiro não afirme.
- Nada de logo de marca real desenhado nas cenas. Use formas genéricas (janela, ícone de arquivo, balão, onda de áudio). Nome do produto aparece só como texto. (Exceção: os ícones de rede social do card final, desenhados como glifos simples.)
- Português do Brasil, palavras simples, sem travessão.
- Duração: 30 a 45 segundos. Um bloco do roteiro = uma cena.
- Aviso importante do roteiro (ex.: "só plano pago") vira cena própria e visível. Nunca esconda.

## Pipeline

### 0. Ambiente

Confira antes de assumir: `node -v` (22+), `ffmpeg -version`, `python -c "import numpy, playwright"`, e um navegador pro render (Chromium do Playwright, ou Chrome/Edge instalado: os scripts usam o que achar). Chave do Gemini em `GEMINI_API_KEY` (nunca grave a chave em arquivo do projeto). HyperFrames: siga `../reels-edicao/references/schema-hyperframes.md`.

Rede restrita: se algo falhar por certificado ou 403, **não desligue verificação de TLS**. Use a alternativa offline (Piper, seção 2b) e avise.

### 1. Roteiro

Pegue o roteiro da conversa ou do arquivo indicado. Extraia: título/gancho, blocos de fala, aviso, CTA. Escreva a narração final num `falas.json`, um bloco por cena, frases curtas, como a pessoa diria:

```json
[{"id": "b01", "text": "Criei uma skill que faz reels sem limite."},
 {"id": "b02", "text": "Em qualquer estilo."}]
```

Mantenha um CTA único.

### 2. Voz (Gemini TTS, padrão)

```bash
python scripts/voz_gemini.py falas.json --saida voz/
```

O script, com a configuração de `perfil.voz` (padrão: modelo `gemini-3.8-flash-tts`, voz `Sulafat`, tag `[upbeat]`, velocidade 1.12):

- gera um WAV por bloco;
- **transcreve cada fala com o Gemini e compara com o texto**; se sair diferente, gera de novo (até 3 vezes) e marca `<< CONFIRA` o que não passou;
- corta o silêncio das pontas e acelera com `atempo` (sem mudar o tom);
- grava `voz/duracoes.json`. **Essa duração manda no tempo da cena** (cena = fala + ~0,25s de respiro).

Armadilhas já conhecidas:

- O modelo **lê em voz alta** qualquer instrução escrita no texto ("Fale animado: ..."), e `systemInstruction` dá erro 400. Estilo só por tag de áudio no começo: `[upbeat]`, `[confident]`. Frase afirmativa que saiu com cara de pergunta: gere de novo com `[confident]` (`--so b03` gera só esse bloco).
- Às vezes aparece uma palavra a mais no começo ("Ops, ..."). A checagem pega; se não pegar, ouça.
- Palavra em inglês no meio do português ("reel", "skill") pode sair com pronúncia brasileira ("ríu"). Normal. Não troque a palavra se ela aparece escrita na legenda.
- Junte tudo depois com FFmpeg e normalize em -14 LUFS (`loudnorm=I=-14:TP=-1.5`).

Quer outra voz? Troque `perfil.voz.voz` (ex.: `Kore`, `Puck`, `Charon`) e gere de novo. A pessoa escolhe.

#### 2b. Sem rede pro Gemini (offline)

Piper, voz pt-BR `faber`:

```bash
pip install piper-tts
curl -L -o voz.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx
curl -L -o voz.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json
echo "Frase do bloco." | python -m piper -m voz.onnx -f bloco1.wav --length-scale 0.92
```

Soa menos natural. Use só se a pessoa aceitar, e avise na entrega.

### 3. Linha do tempo

Monte `plan.json`: cenas (início, fim, texto de tela, movimento, elementos), legendas por palavra e SFX. Tempo de cada palavra: distribua a duração do bloco proporcional ao número de letras (+1,5 por palavra). Se tiver Whisper local, prefira ele pra alinhar.

### 4. Estilo (varia a cada vídeo)

Escolha o que combina com o tema, diga qual usou na entrega e não repita o do vídeo anterior. Se a pessoa pedir um, use o dela.

1. **3D low-poly isométrico**: cidade clara, bonequinhos, tapetes coloridos. Bom pra dica com "gente fazendo coisa" (reunião, atendimento, fluxo). Detalhes em 4a.
2. **Motion tipográfico**: texto grande animado (palavras que entram, trocam e se encaixam), formas chapadas, wipes. Dica curta e direta. Só HTML/CSS/GSAP.
3. **Interface animada (UI mockup)**: janelas, chat, botões e cursor mostrando o passo a passo como gravação de tela estilizada, com zoom nos pontos importantes. Dica de ferramenta. Janela genérica com nome em texto.
4. **Papel recortado / colagem retrô**: recortes com meio-tom, vermelho tomate, mostarda, azul cobalto e creme, movimento em stop-motion (12fps nos elementos).
5. **Infográfico animado**: números, barras, linhas e ícones crescendo com easing, grade limpa. Quando o roteiro tem dado.
6. **Ilustração vetorial plana (2D)**: personagens e cenas em SVG, câmera deslizando, parallax em camadas.
7. **3D abstrato / objetos**: objetos soltos (celular, pasta, balão, relógio) girando sobre cor chapada, luz suave, câmera orbitando devagar.
8. **Quadro/giz (whiteboard)**: traço que se desenha sozinho (stroke-dashoffset).

Misturar dois estilos só se a transição ficar limpa. Todos seguem as mesmas regras de título, legenda, voz, SFX, render e conferência. Nenhum pode ter logo real nem copiar obra ou personagem específico.

#### 4a. Cena 3D low-poly (Three.js), estilo 1

- Câmera ortográfica ou perspectiva fraca, de cima a ~35°, dolly lento (3 a 6% por cena) e troca de enquadramento a cada cena. Sem tremor.
- Cidade: prédios-caixa creme com faixa azul-acinzentada, ruas claras, árvores de icosaedro verde sobre tronco marrom, banco, caixa de correio azul. Luz direcional suave, sombra leve.
- Gente: bonequinhos de caixas (cabeça, tronco, pernas) em laranja, azul, verde, roxo, vermelho, amarelo. Ciclo de caminhada simples, trilhas. `InstancedMesh` pra centenas.
- Tapetes coloridos no chão (rosa, azul, laranja) como "zonas" de cada ideia.
- Cartões de interface por cima (HTML/CSS sobre o canvas): rótulos numerados, caixas de número grande (fonte mono + número em cor viva), selo "ilustrativo" em cena simbólica.
- Metáforas simples: pessoa gravando no celular (onda de áudio), arquivo voando pra janela de chat, texto virando lista de tarefas, relógio girando.
- Instale Three.js por npm e deixe tudo local no HTML (nada de CDN no render).

**Movimento fluido em qualquer estilo:** easing sempre (`power2.inOut`, `back.out` pra cartões), nada linear. Render a 30fps, mas anime em **função do tempo** (`renderAt(t)`), nunca por quadro fixo, pra o render ser determinístico.

### 5. Título e legenda

Mesmo padrão da skill `reels-edicao` (seção "PADRÃO FIXO DE TÍTULO E LEGENDA"): título de abertura amarelo `perfil.cor_destaque` fundido, caixa alta, até 3 linhas, topo em y≈218, ~3s; legenda pílula amarela com texto preto, karaokê, o vídeo todo. Releia as medidas e o goo filter lá antes de montar.

### 6. SFX

Kit de `perfil.pasta_sfx` (whoosh e pin). Sem kit, gere: `python scripts/gerar_sfx.py sfx/`. Whoosh nas trocas de cena, pin em dado que aparece. Volume baixo (~0,1–0,35 sob a voz), narração sempre na frente. Sem música.

### 7. Render

1. Quadros com headless Chromium (HyperFrames ou Playwright chamando `renderAt(i/30)`), 1080x1920, 30fps.
2. Mixe narração + SFX, -14 LUFS.
3. **Card final** (seção abaixo).
4. Encode final **até 50MB** (fórmula de 2 passes na `reels-edicao`, seção "LIMITE DE TAMANHO"). Confira o tamanho.
5. Confira o MP4: duração bate com a narração, áudio presente, sem quadro preto no começo ou no fim (`blackdetect`).

### 8. Conferência (obrigatória)

- **Visual:** extraia ao menos 6 quadros (`ffmpeg -ss <t> -frames:v 1`) e olhe: título legível, legenda na área segura (nada sob a UI do Instagram: topo e ~220px de baixo), cartões sem texto cortado, nenhuma cena vazia.
- **Sincronia:** quadro no começo e no fim de cada fala; a legenda tem que acender a primeira e a última palavra daquela fala.
- **Áudio:** transcreva o áudio final com o Gemini e compare com o roteiro.

Se algo estiver errado, conserte e renderize de novo uma vez. Se persistir, avise em vez de dizer que está pronto.

### 9. Entrega

- O MP4 e uma resposta curta: tema, estilo, duração, tamanho, voz usada e qualquer fato não confirmado ou cena fraca.
- Título, descrição e hashtags por plataforma (Instagram, TikTok, YouTube Shorts, Facebook), só com o que o vídeo afirma. TikTok e YouTube não mandam mensagem automática pra quem comenta: lá o CTA pede pra comentar e a resposta vai no comentário.

## CARD FINAL (todo vídeo)

~4s no fim de todo vídeo, 100% animado:

- Foto redonda com anel na cor de destaque, `perfil.nome`, pílula preta com o @ (`perfil.redes[perfil.handle_no_card]`), texto `perfil.cta_final` palavra por palavra e só os **ícones** das redes preenchidas em `perfil.redes` (sem nome escrito).
- Animação: wipe circular amarelo, losangos flutuando, foto com pop, nome sobe, @ dá pop, palavras entram em sequência, ícones sobem um a um e depois pulsam.
- Áudio: whoosh em 0s e pin em 2.0 / 2.18 / 2.36 / 2.54s (um por ícone).

Pronto em `assets/endcard/endcard.html` (`setup(perfil, foto)` + `renderAt(t)`). Pra renderizar e colar no fim do vídeo:

```bash
python scripts/render_endcard.py --anexar video_sem_card.mp4 --saida final.mp4
```

Abrir `endcard.html` direto no navegador toca uma prévia com dados de exemplo.

## Trocar só a voz de um vídeo já pronto

Se a pessoa quiser outra voz num vídeo já renderizado (e o projeto não existir mais): gere as falas novas, ache onde cada fala antiga começa e termina (`silencedetect`) e, pra cada trecho, desacelere o vídeo (`setpts`) só o bastante pra fala nova caber. A legenda karaokê acompanha porque estica junto. O card final fica intacto com o áudio dele. Confira a sincronia como na seção 8.

## O que NUNCA fazer

Inventar dado ou recurso, usar logo de marca real nas cenas, gastar crédito pago sem aprovação, passar de 50MB, dizer que está pronto sem olhar os quadros, desligar verificação de TLS, gravar chave de API em arquivo, publicar.

## Limites (seja honesto)

- Voz de IA é boa pra informar, mas não é a voz da pessoa. Pra mais naturalidade, ela grava e usa a skill `reels-edicao`.
- Tudo é código: o 3D tem cara de ilustração geométrica, não de filme.
- O primeiro vídeo precisa de ajuste fino (tempos, câmera). Peça opinião e anote aqui o que a pessoa aprovar.
