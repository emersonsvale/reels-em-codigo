#!/usr/bin/env node
/**
 * plan-cuts.mjs — transcript.json (+ roteiro.md) -> plan.json
 *
 * Le a transcricao palavra-a-palavra do `npx hyperframes transcribe`,
 * detecta os silencios, e monta o plano de cortes do Reel:
 *   - segmentos (cortes) com in-point no arquivo fonte
 *   - zoom alternado entre cortes
 *   - lead de J-cut por corte (limitado pelo silencio disponivel)
 *   - esqueleto de titulo, CTA, graficos, split screen e SFX
 *
 * Uso: node scripts/plan-cuts.mjs <pasta-do-projeto> [--silence 0.35] [--jcut 0.18]
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const projectDir = args.find((a) => !a.startsWith("--"));
if (!projectDir) {
  console.error("uso: node scripts/plan-cuts.mjs <pasta-do-projeto>");
  process.exit(1);
}

const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return fallback;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};

// --- parametros de edicao -------------------------------------------------
const SILENCE_MIN = flag("silence", 0.35); // silencio a partir do qual corta
const PAD = flag("pad", 0.08);             // respiro mantido nas pontas do corte
const MIN_SEG = flag("min-seg", 0.7);      // segmento menor que isso funde no anterior
const JCUT_LEAD = flag("jcut", 0.18);      // quanto o audio antecede a imagem
const ZOOM_BASE = 1.0;
const ZOOM_IN = flag("zoom", 1.08);        // o "pouco de zoom" alternado
const FPS = 30;

// --- entrada --------------------------------------------------------------
const transcriptPath = path.join(projectDir, "transcript.json");
if (!fs.existsSync(transcriptPath)) {
  console.error(`nao achei ${transcriptPath}`);
  console.error("rode antes: npx hyperframes transcribe source.mp4 --model small --language pt");
  process.exit(1);
}

// --- descobre o video da pasta (nao assume "source.mp4") -----------------
const VIDEO_EXT = [".mp4", ".mov", ".webm", ".mkv", ".m4v"];
const candidatos = fs
  .readdirSync(projectDir, { withFileTypes: true })
  .filter((d) => d.isFile() && VIDEO_EXT.includes(path.extname(d.name).toLowerCase()))
  .map((d) => ({ nome: d.name, bytes: fs.statSync(path.join(projectDir, d.name)).size }))
  .sort((a, b) => b.bytes - a.bytes); // o bruto e sempre o maior

if (!candidatos.length) {
  console.error(`nenhum video encontrado em ${projectDir}`);
  console.error(`extensoes aceitas: ${VIDEO_EXT.join(", ")}`);
  process.exit(1);
}
const VIDEO = candidatos[0].nome;
if (candidatos.length > 1) {
  console.warn(`aviso: ${candidatos.length} videos na pasta, usando o maior: ${VIDEO}`);
}

const raw = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));
// o transcribe normaliza tudo para [{text,start,end}]; aceitamos variantes por seguranca
const words = (Array.isArray(raw) ? raw : raw.words || raw.segments || [])
  .map((w) => ({
    text: String(w.text ?? w.word ?? "").trim(),
    start: Number(w.start),
    end: Number(w.end),
  }))
  .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
  .sort((a, b) => a.start - b.start);

if (!words.length) {
  console.error("transcript.json sem palavras utilizaveis");
  process.exit(1);
}

// --- 1. agrupar palavras em segmentos, cortando os silencios --------------
const groups = [];
let current = [words[0]];
for (let i = 1; i < words.length; i++) {
  const gap = words[i].start - words[i - 1].end;
  if (gap >= SILENCE_MIN) {
    groups.push({ words: current, gapAfter: gap });
    current = [words[i]];
  } else {
    current.push(words[i]);
  }
}
groups.push({ words: current, gapAfter: 0 });

// --- 2. virar segmentos com in/out no arquivo fonte -----------------------
let segments = groups.map((g) => {
  const first = g.words[0];
  const last = g.words[g.words.length - 1];
  const mediaStart = Math.max(0, first.start - PAD);
  const mediaEnd = last.end + Math.min(PAD, g.gapAfter || PAD);
  return {
    mediaStart: round(mediaStart),
    duration: round(mediaEnd - mediaStart),
    gapAfter: round(g.gapAfter),
    text: g.words.map((w) => w.text).join(" "),
  };
});

// funde segmentos curtos demais no anterior (respiracao, nao corte)
segments = segments.reduce((acc, seg) => {
  const prev = acc[acc.length - 1];
  if (prev && seg.duration < MIN_SEG) {
    prev.duration = round(seg.mediaStart + seg.duration - prev.mediaStart);
    prev.gapAfter = seg.gapAfter;
    prev.text = `${prev.text} ${seg.text}`;
    return acc;
  }
  acc.push(seg);
  return acc;
}, []);

// --- 3. zoom alternado + lead de J-cut ------------------------------------
let timeline = 0;
segments = segments.map((seg, i) => {
  const prevGap = i === 0 ? 0 : segments[i - 1].gapAfter;
  // o video anterior precisa estender por `lead` segundos alem do audio dele:
  // essa sobra so existe dentro do silencio que acabamos de cortar.
  const lead = i === 0 ? 0 : round(Math.min(JCUT_LEAD, prevGap * 0.9));
  const out = {
    id: `seg-${String(i).padStart(2, "0")}`,
    index: i,
    mediaStart: seg.mediaStart,
    duration: seg.duration,
    timelineStart: round(timeline),
    jcutLead: lead,
    zoom: i % 2 === 0 ? ZOOM_BASE : ZOOM_IN,
    text: seg.text,
  };
  timeline = round(timeline + seg.duration);
  return out;
});

const total = round(timeline);

// --- 4. esqueleto criativo a partir do roteiro ----------------------------
const roteiroPath = ["roteiro.md", "roteiro.txt", "BRIEF.md"]
  .map((f) => path.join(projectDir, f))
  .find((f) => fs.existsSync(f));
const roteiro = roteiroPath ? fs.readFileSync(roteiroPath, "utf8") : "";

const plan = {
  meta: {
    width: 1080,
    height: 1920,
    fps: FPS,
    duration: total,
    source: VIDEO,
    roteiro: roteiroPath ? path.basename(roteiroPath) : null,
    geradoPor: "plan-cuts.mjs",
    parametros: { SILENCE_MIN, PAD, MIN_SEG, JCUT_LEAD, ZOOM_IN },
  },
  // preencher na passada criativa (ver SKILL.md)
  titulo: { texto: "", inicio: 0, duracao: 2.4 },
  cta: { linhas: [], inicio: round(Math.max(0, total - 3.5)), duracao: 3.5 },
  graficos: [],   // { id, inicio, duracao, tipo: "card"|"lista"|"numero", conteudo: {...} }
  split: [],      // { inicio, duracao, graficoId }  -> animacao em cima, voce embaixo
  soVoz: [],      // { inicio, duracao, graficoId }  -> so animacao, sua voz por cima
  sfx: [],        // { som: "pin"|"rise"|"boom"|"whoosh"|"pop", em: 0, volume: 0.6 }
  segmentos: segments,
};

fs.writeFileSync(path.join(projectDir, "plan.json"), JSON.stringify(plan, null, 2));

const cortados = round(
  segments.reduce((s, x) => s + x.duration, 0) - total,
);
console.log(`plan.json escrito em ${projectDir}`);
console.log(`  video: ${VIDEO}`);
console.log(`  ${segments.length} cortes | duracao final ${total}s`);
console.log(`  zoom alternando entre ${ZOOM_BASE}x e ${ZOOM_IN}x`);
console.log(`  J-cut medio ${round(avg(segments.slice(1).map((s) => s.jcutLead)))}s`);
if (roteiroPath) console.log(`  roteiro lido: ${path.basename(roteiroPath)}`);
console.log("\nproximo passo: preencher titulo/cta/graficos/split/sfx no plan.json");

function round(n) { return Math.round(n * 1000) / 1000; }
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
