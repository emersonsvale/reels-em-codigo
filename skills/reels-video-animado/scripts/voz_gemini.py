"""Narração com Gemini TTS, um arquivo por bloco do roteiro.

Uso:
  python voz_gemini.py falas.json --saida voz/ [--perfil ../perfil.json] [--so b01 b03]

falas.json:  [{"id": "b01", "text": "Primeira frase."}, ...]

Para cada bloco grava:
  voz/<id>_bruto.wav   resposta do Gemini
  voz/<id>.wav         sem silêncio nas pontas, acelerado (atempo), 48 kHz mono
e escreve voz/duracoes.json com a duração final de cada bloco (é ela que manda no tempo da cena).

Com --checar (padrão ligado), cada fala é transcrita pelo Gemini e comparada com o texto.
Se a fala sair diferente (palavra a mais no começo, frase cortada), gera de novo até 3 vezes.

Chave: variável de ambiente GEMINI_API_KEY (ou GOOGLE_API_KEY). Nunca grave a chave em arquivo.
"""
import argparse, base64, difflib, json, os, re, subprocess, sys, time, unicodedata, urllib.error, urllib.request, wave
from pathlib import Path

API = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
PADRAO = {"modelo": "gemini-3.8-flash-tts", "voz": "Sulafat", "tag": "[upbeat]", "velocidade": 1.12}
MODELO_CHECAGEM = "gemini-2.5-flash"


def chave():
    k = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not k:
        sys.exit("Falta a chave: defina GEMINI_API_KEY (crie em https://aistudio.google.com/apikey).")
    return k


def chamar(modelo, corpo, k):
    req = urllib.request.Request(API.format(modelo), data=json.dumps(corpo).encode(),
                                 headers={"x-goog-api-key": k, "Content-Type": "application/json"})
    for tentativa in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=180))
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode("utf-8", "replace")
            if e.code in (429, 500, 503) and tentativa < 3:
                time.sleep(4 * (tentativa + 1)); continue
            sys.exit(f"Gemini respondeu {e.code}: {msg}")


def tts(texto, cfg, k, destino):
    # O modelo lê em voz alta qualquer instrução escrita no texto e recusa systemInstruction.
    # O estilo vai só como tag de áudio no começo, ex.: "[upbeat] ".
    tag = (cfg["tag"].strip() + " ") if cfg.get("tag") else ""
    corpo = {"contents": [{"role": "user", "parts": [{"text": tag + texto}]}],
             "generationConfig": {"responseModalities": ["AUDIO"],
                                  "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": cfg["voz"]}}}}}
    r = chamar(cfg["modelo"], corpo, k)
    p = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    raw = base64.b64decode(p["data"])
    if p["mimeType"].startswith("audio/wav"):
        destino.write_bytes(raw)
    else:  # PCM cru (audio/L16;rate=24000)
        taxa = int(re.search(r"rate=(\d+)", p["mimeType"]).group(1)) if "rate=" in p["mimeType"] else 24000
        with wave.open(str(destino), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(taxa); w.writeframes(raw)


def transcrever(arquivo, k):
    b = base64.b64encode(Path(arquivo).read_bytes()).decode()
    corpo = {"contents": [{"parts": [
        {"text": "Transcreva exatamente o que é falado neste áudio, palavra por palavra. Responda só com a transcrição."},
        {"inlineData": {"mimeType": "audio/wav", "data": b}}]}]}
    r = chamar(MODELO_CHECAGEM, corpo, k)
    return r["candidates"][0]["content"]["parts"][0]["text"].strip()


def normal(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", s)


def parecido(a, b):
    return difflib.SequenceMatcher(None, normal(a), normal(b)).ratio()


def acabar(bruto, final, velocidade):
    filtro = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,"
              "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,"
              f"atempo={velocidade}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bruto), "-af", filtro, "-ar", "48000", "-ac", "1", str(final)], check=True)
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(final)]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("falas")
    ap.add_argument("--saida", default="voz")
    ap.add_argument("--perfil", default=str(Path(__file__).resolve().parent.parent / "perfil.json"))
    ap.add_argument("--so", nargs="*", help="gera só estes ids")
    ap.add_argument("--sem-checar", action="store_true")
    ap.add_argument("--limite", type=float, default=0.85, help="semelhança mínima entre texto e transcrição")
    a = ap.parse_args()

    cfg = dict(PADRAO)
    if Path(a.perfil).exists():
        cfg.update(json.load(open(a.perfil, encoding="utf-8")).get("voz", {}))
    k = chave()
    falas = json.load(open(a.falas, encoding="utf-8"))
    out = Path(a.saida); out.mkdir(parents=True, exist_ok=True)
    dur_path = out / "duracoes.json"
    duracoes = json.load(open(dur_path, encoding="utf-8")) if dur_path.exists() else {}

    print(f"voz {cfg['voz']} | modelo {cfg['modelo']} | tag {cfg.get('tag')!r} | velocidade {cfg['velocidade']}")
    for f in falas:
        if a.so and f["id"] not in a.so:
            continue
        bruto = out / f"{f['id']}_bruto.wav"
        melhor = (-1, "")
        for tentativa in range(3):
            tts(f["text"], cfg, k, bruto)
            if a.sem_checar:
                break
            ouvido = transcrever(bruto, k)
            nota = parecido(f["text"], ouvido)
            if nota > melhor[0]:
                melhor = (nota, ouvido)
                bruto.replace(out / f"{f['id']}_melhor.wav")
            if nota >= a.limite:
                break
            print(f"  {f['id']} tentativa {tentativa + 1}: saiu \"{ouvido}\" ({nota:.2f}), gerando de novo")
        if not a.sem_checar:
            (out / f"{f['id']}_melhor.wav").replace(bruto)
        d = acabar(bruto, out / f"{f['id']}.wav", cfg["velocidade"])
        duracoes[f["id"]] = round(d, 3)
        aviso = "" if a.sem_checar or melhor[0] >= a.limite else "  << CONFIRA: " + melhor[1]
        print(f"{f['id']}  {d:.2f}s{'' if a.sem_checar else f'  ({melhor[0]:.2f})'}{aviso}")
    json.dump(duracoes, open(dur_path, "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
