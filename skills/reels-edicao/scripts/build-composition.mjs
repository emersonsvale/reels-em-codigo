#!/usr/bin/env node
/**
 * build-composition.mjs — plan.json -> index.html (composicao HyperFrames)
 *
 * Monta o Reel inteiro: cortes, J-cuts, zoom alternado, legendas sincronizadas,
 * titulo de abertura, graficos, split screen e CTA final.
 *
 * Uso: node scripts/build-composition.mjs <pasta-do-projeto>
 */
import fs from "node:fs";
import path from "node:path";

const projectDir = process.argv[2];
if (!projectDir) {
  console.error("uso: node scripts/build-composition.mjs <pasta-do-projeto>");
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(path.join(projectDir, "plan.json"), "utf8"));
const { width: W, height: H, fps: FPS } = plan.meta;
const segs = plan.segmentos;
const TOTAL = plan.meta.duration;

// audio separado se existir (mais previsivel que ler a trilha do mp4)
const AUDIO_SRC = fs.existsSync(path.join(projectDir, "source-audio.wav"))
  ? "source-audio.wav"
  : plan.meta.source;

// ---------------------------------------------------------------------------
// 1. TIMING DOS CORTES  (o coracao do J-cut)
// ---------------------------------------------------------------------------
// O audio corre continuo: segmento i ocupa [T_i, T_i + D_i).
// A IMAGEM entra `lead` segundos DEPOIS do audio -> voce ouve a proxima frase
// enquanto ainda ve o final do plano anterior. Isso e o J-cut.
// Para o lip sync nao quebrar, o in-point da midia anda o mesmo tanto.
const videoCuts = segs.map((seg, i) => {
  const next = segs[i + 1];
  const startsAt = round(seg.timelineStart + seg.jcutLead);
  const endsAt = next ? round(next.timelineStart + next.jcutLead) : TOTAL;
  return {
    id: seg.id,
    index: i,
    start: startsAt,
    duration: round(endsAt - startsAt),
    mediaStart: round(seg.mediaStart + seg.jcutLead),
    zoom: seg.zoom,
  };
});

// ---------------------------------------------------------------------------
// 2. MAPA tempo-no-arquivo -> tempo-na-timeline  (para as legendas)
// ---------------------------------------------------------------------------
function sourceToTimeline(t) {
  for (const s of segs) {
    if (t < s.mediaStart) return s.timelineStart;             // caiu num silencio cortado
    if (t <= s.mediaStart + s.duration)
      return round(s.timelineStart + (t - s.mediaStart));
  }
  const last = segs[segs.length - 1];
  return round(last.timelineStart + last.duration);
}

// ---------------------------------------------------------------------------
// 3. LEGENDAS — agrupa palavras em cues curtas e legiveis
// ---------------------------------------------------------------------------
const MAX_WORDS = 4;
const MAX_CUE = 2.2;
let cues = [];
const tPath = path.join(projectDir, "transcript.json");
if (fs.existsSync(tPath)) {
  const raw = JSON.parse(fs.readFileSync(tPath, "utf8"));
  const words = (Array.isArray(raw) ? raw : raw.words || [])
    .map((w) => ({
      text: String(w.text ?? w.word ?? "").trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
    .filter((w) => w.text && Number.isFinite(w.start));

  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const start = sourceToTimeline(buf[0].start);
    const end = sourceToTimeline(buf[buf.length - 1].end);
    if (end - start > 0.08) {
      cues.push({ text: buf.map((w) => w.text).join(" "), start, duration: round(end - start) });
    }
    buf = [];
  };
  for (const w of words) {
    buf.push(w);
    const dur = sourceToTimeline(w.end) - sourceToTimeline(buf[0].start);
    const puncEnd = /[.!?…]$/.test(w.text);
    if (puncEnd || buf.length >= MAX_WORDS || dur >= MAX_CUE) flush();
  }
  flush();
  // nunca deixa duas cues empilhadas
  cues = cues.filter((c, i) => !cues[i + 1] || c.start + c.duration <= cues[i + 1].start + 0.01);
}

// ---------------------------------------------------------------------------
// 4. HTML
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const videoEls = videoCuts
  .map(
    (c) => `      <video
        id="${c.id}"
        class="shot"
        src="${plan.meta.source}"
        data-start="${c.start}"
        data-duration="${c.duration}"
        data-media-start="${c.mediaStart}"
        data-track-index="0"
        style="--zoom: ${c.zoom}"
        muted
        playsinline
        preload="auto"
      ></video>`,
  )
  .join("\n");

// audio continuo, um elemento por segmento, colados sem buraco
const audioEls = segs
  .map(
    (s) => `    <audio
      id="au-${s.id}"
      src="${AUDIO_SRC}"
      data-start="${s.timelineStart}"
      data-duration="${s.duration}"
      data-media-start="${s.mediaStart}"
      data-audio-group="voz"
      data-volume="1"
    ></audio>`,
  )
  .join("\n");

// resolve a extensao real de cada SFX (wav, mp3, m4a, ogg...) em vez de fixar .wav
const sfxDir = path.join(projectDir, "assets", "sfx");
const sfxDisponiveis = fs.existsSync(sfxDir)
  ? fs.readdirSync(sfxDir).filter((f) => /\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(f))
  : [];
const acharSfx = (nome) =>
  sfxDisponiveis.find((f) => path.parse(f).name.toLowerCase() === String(nome).toLowerCase());

const sfxFaltando = [];
const sfxEls = (plan.sfx || [])
  .map((s, i) => {
    const arquivo = acharSfx(s.som);
    if (!arquivo) {
      sfxFaltando.push(s.som);
      return null; // nao emite audio quebrado
    }
    return `    <audio
      id="sfx-${i}"
      src="assets/sfx/${arquivo}"
      data-start="${s.em}"
      data-duration="${s.duracao ?? 1.2}"
      data-media-start="0"
      data-audio-group="sfx"
      data-volume="${s.volume ?? 0.55}"
    ></audio>`;
  })
  .filter(Boolean)
  .join("\n");

const cueEls = cues
  .map(
    (c, i) => `      <div class="clip cue" id="cue-${i}" data-start="${c.start}" data-duration="${c.duration}"><span>${esc(c.text)}</span></div>`,
  )
  .join("\n");

const idsEmSplit = new Set((plan.split || []).map((s) => s.graficoId).filter(Boolean));
const graficoEls = (plan.graficos || [])
  .map((g) => {
    const corpo =
      g.tipo === "lista"
        ? `<ul class="g-lista">${(g.conteudo?.itens || []).map((it) => `<li>${esc(it)}</li>`).join("")}</ul>`
        : g.tipo === "numero"
          ? `<div class="g-numero">${esc(g.conteudo?.valor)}</div><div class="g-legenda">${esc(g.conteudo?.legenda)}</div>`
          : `<div class="g-titulo">${esc(g.conteudo?.titulo)}</div>${g.conteudo?.detalhe ? `<div class="g-detalhe">${esc(g.conteudo.detalhe)}</div>` : ""}`;
    const cls = idsEmSplit.has(g.id) ? "clip grafico em-split" : "clip grafico";
    return `      <div class="${cls}" id="${g.id}" data-start="${g.inicio}" data-duration="${g.duracao}">
        <div class="g-caixa">${g.conteudo?.kicker ? `<div class="g-kicker">${esc(g.conteudo.kicker)}</div>` : ""}${corpo}</div>
      </div>`;
  })
  .join("\n");

const ctaLinhas = (plan.cta?.linhas || []).map((l) => `<div class="cta-linha">${esc(l)}</div>`).join("");

// GSAP: split screen move o #video-wrap para a metade de baixo
const splitTweens = (plan.split || [])
  .map(
    (s) => `  tl.to("#video-wrap", { top: ${Math.round(H / 2)}, height: ${Math.round(H / 2)}, duration: 0.55, ease: "power2.inOut" }, ${s.inicio});
  tl.to("#split-panel", { opacity: 1, duration: 0.3 }, ${s.inicio});
  tl.to("#video-wrap", { top: 0, height: ${H}, duration: 0.55, ease: "power2.inOut" }, ${round(s.inicio + s.duracao)});
  tl.to("#split-panel", { opacity: 0, duration: 0.3 }, ${round(s.inicio + s.duracao)});`,
  )
  .join("\n");

// "so animacao com a sua voz": esconde o video, mantem o audio
const soVozTweens = (plan.soVoz || [])
  .map(
    (s) => `  tl.to("#video-wrap", { opacity: 0, duration: 0.35 }, ${s.inicio});
  tl.to("#video-wrap", { opacity: 1, duration: 0.35 }, ${round(s.inicio + s.duracao)});`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>Reel</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root {
        --paper: #faf8f4;
        --ink: #16181c;
        --accent: #dc3b23;
        --muted: #6b7280;
        --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        --serif: ui-serif, Georgia, "Times New Roman", serif;
      }
      html, body { margin: 0; padding: 0; background: #0a0c12; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #0a0c12; }

      /* ---- video ---- */
      #video-wrap { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
      .shot {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover;
        transform: scale(var(--zoom, 1));
        transform-origin: 50% 42%;   /* mira no rosto, nao no centro geometrico */
      }

      .clip { position: absolute; }

      /* ---- painel do split screen (metade de cima) ---- */
      #split-panel {
        left: 0; top: 0; width: ${W}px; height: ${Math.round(H / 2)}px;
        background: #0a0c12; opacity: 0;
      }
      /* grafico que acompanha um split: centralizado no painel de cima */
      .grafico.em-split {
        top: 0; height: ${Math.round(H / 2)}px;
        display: flex; align-items: center;
      }
      .grafico.em-split .g-caixa { width: 100%; }

      /* ---- legendas (rail) ---- */
      .cue {
        left: 90px; width: ${W - 180}px; top: 1430px;
        display: flex; justify-content: center; text-align: center;
      }
      .cue span {
        font: 700 62px/1.22 var(--sans);
        letter-spacing: -0.015em;
        color: #fff;
        background: rgba(12, 14, 18, 0.62);
        padding: 14px 26px;
        border-radius: 14px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
      }

      /* ---- titulo de abertura ---- */
      #titulo {
        left: 90px; width: ${W - 180}px; top: 300px;
      }
      #titulo .t-caixa {
        background: var(--paper); color: var(--ink);
        padding: 54px 48px; border-radius: 4px;
        border-left: 10px solid var(--accent);
      }
      #titulo .t-texto {
        font: 700 84px/1.08 var(--serif);
        letter-spacing: -0.02em; margin: 0;
      }

      /* ---- graficos ---- */
      .grafico { left: 70px; width: ${W - 140}px; top: 200px; }
      .g-caixa {
        background: var(--paper); color: var(--ink);
        padding: 56px 52px; border-radius: 4px;
      }
      .g-kicker {
        font: 700 30px/1 var(--sans); letter-spacing: 0.16em;
        text-transform: uppercase; color: var(--accent); margin-bottom: 26px;
      }
      .g-titulo { font: 700 72px/1.1 var(--serif); letter-spacing: -0.02em; }
      .g-detalhe { font: 400 40px/1.4 var(--sans); color: var(--muted); margin-top: 22px; }
      .g-lista { margin: 0; padding: 0; list-style: none; }
      .g-lista li {
        font: 600 46px/1.35 var(--sans); padding: 20px 0 20px 46px;
        border-bottom: 2px solid rgba(22, 24, 28, 0.1); position: relative;
      }
      .g-lista li::before {
        content: ""; position: absolute; left: 0; top: 34px;
        width: 20px; height: 4px; background: var(--accent);
      }
      .g-lista li:last-child { border-bottom: none; }
      .g-numero { font: 700 190px/0.94 var(--serif); letter-spacing: -0.04em; color: var(--accent); }
      .g-legenda { font: 500 40px/1.35 var(--sans); color: var(--muted); margin-top: 16px; }

      /* ---- CTA final ---- */
      #cta {
        left: 90px; width: ${W - 180}px; top: 640px; text-align: center;
      }
      #cta::before {
        content: ""; display: block; width: 96px; height: 8px;
        background: var(--accent); margin: 0 auto 52px;
      }
      .cta-linha {
        font: 700 92px/1.14 var(--serif); color: var(--paper);
        letter-spacing: -0.025em; margin: 0 0 26px;
      }
      .cta-linha:last-child {
        font: 700 46px/1.2 var(--sans); color: var(--accent);
        letter-spacing: 0.04em; margin-top: 44px; text-transform: lowercase;
      }
      #cta-fundo { left: 0; top: 0; width: ${W}px; height: ${H}px; background: rgba(10, 11, 14, 0.88); }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="reel"
      data-start="0"
      data-duration="${TOTAL}"
      data-width="${W}"
      data-height="${H}"
      data-fps="${FPS}"
    >
      <div id="video-wrap">
${videoEls}
      </div>

      <div id="split-panel"></div>

${cueEls || "      <!-- sem legendas: transcript.json ausente -->"}

${graficoEls || "      <!-- sem graficos ainda -->"}

${
  plan.titulo?.texto
    ? `      <div class="clip" id="titulo" data-start="${plan.titulo.inicio}" data-duration="${plan.titulo.duracao}">
        <div class="t-caixa"><p class="t-texto">${esc(plan.titulo.texto)}</p></div>
      </div>`
    : "      <!-- sem titulo: preencha plan.titulo.texto -->"
}

${
  ctaLinhas
    ? `      <div class="clip" id="cta-fundo" data-start="${plan.cta.inicio}" data-duration="${plan.cta.duracao}"></div>
      <div class="clip" id="cta" data-start="${plan.cta.inicio}" data-duration="${plan.cta.duracao}">${ctaLinhas}</div>`
    : "      <!-- sem CTA: preencha plan.cta.linhas -->"
}

${audioEls}
${sfxEls}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // entrada do titulo
      if (document.querySelector("#titulo")) {
        tl.fromTo("#titulo .t-caixa", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, ${plan.titulo?.inicio ?? 0});
        tl.to("#titulo .t-caixa", { opacity: 0, duration: 0.3 }, ${round((plan.titulo?.inicio ?? 0) + (plan.titulo?.duracao ?? 2.4) - 0.3)});
      }

      // graficos entram por baixo
${(plan.graficos || [])
  .map(
    (g) => `      tl.fromTo("#${g.id} .g-caixa", { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, ${g.inicio});
      tl.to("#${g.id} .g-caixa", { opacity: 0, duration: 0.28 }, ${round(g.inicio + g.duracao - 0.28)});`,
  )
  .join("\n")}

      // split screen: animacao em cima, voce embaixo
${splitTweens}

      // so animacao, com a sua voz por cima
${soVozTweens}

      // CTA
${
  ctaLinhas
    ? `      tl.fromTo("#cta .cta-linha", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.12, ease: "power3.out" }, ${plan.cta.inicio + 0.15});`
    : ""
}

      window.__timelines.reel = tl;
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(projectDir, "index.html"), html);
console.log(`index.html escrito em ${projectDir}`);
console.log(`  ${videoCuts.length} cortes | ${cues.length} legendas | ${(plan.graficos || []).length} graficos | ${(plan.sfx || []).length} SFX`);
console.log(`  duracao ${TOTAL}s @ ${W}x${H} ${FPS}fps | audio: ${AUDIO_SRC}`);
if (sfxFaltando.length) {
  console.warn(`  AVISO: SFX nao encontrados em assets/sfx e ignorados: ${[...new Set(sfxFaltando)].join(", ")}`);
  console.warn(`  disponiveis: ${sfxDisponiveis.join(", ") || "(nenhum)"}`);
}

function round(n) { return Math.round(n * 1000) / 1000; }
