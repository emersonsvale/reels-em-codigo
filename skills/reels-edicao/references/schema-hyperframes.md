# Contrato do HTML do HyperFrames

O que o `build-composition.mjs` gera, e por que cada atributo está lá. Leia antes de editar o `index.html` na mão.

## Raiz da composição

```html
<div id="root"
     data-composition-id="reel"
     data-start="0"
     data-duration="28.4"
     data-width="1080"
     data-height="1920"
     data-fps="30">
```

`data-duration` na raiz **é** a duração do render. O compilador lê antes de qualquer script rodar, então nenhuma variável ou script consegue mudar isso no mesmo render.

## Clipes temporizados

| Atributo | Obrigatório | Significado |
|---|---|---|
| `id` | sim | identificador estável pra timing e animação |
| `data-start` | sim | início em segundos na timeline |
| `data-duration` | sim (DOM, imagem, composição aninhada) | quanto tempo fica visível |
| `data-media-start` | vídeo/áudio | **in-point dentro do arquivo fonte** |
| `data-track-index` | não | só uma faixa de exibição do Studio. **Não controla ordem de pintura** |
| `class="clip"` | recomendado | convenção de layout |

Ordem de empilhamento é `z-index` do CSS, **não** `data-track-index`. Dois clipes na mesma track podem se sobrepor no tempo à vontade.

## As armadilhas

### 1. `data-media-start` vs `data-playback-start` — a que mais dói

Em `<video>` e `<audio>`, use **`data-media-start`**. Nunca `data-playback-start`.

Os dois nomes existem e leitores diferentes leem nomes diferentes. O mixer de áudio (que alimenta o `-ss` do FFmpeg) lê **só** `data-media-start`. Um `<video>` escrito só com `data-playback-start` renderiza **imagem cortada sobre áudio inteiro** — e não dá erro, só sai errado.

(`data-playback-start` é o nome certo em *composição aninhada*, que não usamos aqui.)

### 2. Vídeo tem que ser `muted`

O HyperFrames é dono do playback e do seek. O som sai dos elementos `<audio>`, que é o que nos deixa fazer J-cut de graça.

### 3. Transcrição em inglês por padrão

`transcribe` usa `small.en` se você não disser nada. Para português: `--model small --language pt`.

### 4. Duração inferida

A raiz só pode omitir `data-duration` se der pra inferir de mídia temporizada. Com GSAP, Three.js ou animação sem fim, é obrigatório declarar. Nós sempre declaramos.

## Timeline GSAP

```html
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  /* tweens */
  window.__timelines.reel = tl;
</script>
```

A chave em `window.__timelines` tem que bater com o `data-composition-id`. A timeline entra **pausada** — quem dá seek é o renderer, frame a frame. É isso que torna o render determinístico.

## Render

```bash
npx hyperframes render --output final.mp4              # mp4
npx hyperframes render --format webm --output ov.webm  # webm com alpha
npx hyperframes render --quality draft|standard|high
npx hyperframes render --fps 60
```

Formatos: **MP4** (entrega), **WebM/MOV** (transparência), **GIF** (preview), **sequência PNG** (compositing externo). Para saída transparente, deixe o fundo da composição sem pintar.
