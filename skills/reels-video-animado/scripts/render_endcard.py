"""Renderiza o card final (4s, 1080x1920, 30fps) com os dados do perfil e, se pedido, cola no fim de um vídeo.

Uso:
  python render_endcard.py --saida card.mp4
  python render_endcard.py --anexar meu_reel.mp4 --saida meu_reel_com_card.mp4

Lê nome, @, cor, texto do CTA e redes do perfil.json da skill (ou --perfil).
A foto vem de perfil.foto (caminho relativo ao perfil.json) ou de --foto. Use foto de pelo menos 640px:
ela aparece num círculo de 320px e foto pequena fica macia.

Áudio do card: whoosh em 0s e um pin por ícone (2.0, 2.18, 2.36, 2.54s). Sem kit de SFX,
gera sons simples com gerar_sfx.py.

Precisa: python -m pip install playwright numpy  e  python -m playwright install chromium
"""
import argparse, base64, json, mimetypes, shutil, subprocess, sys, tempfile, wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
SKILL = AQUI.parent
HTML = SKILL / "assets" / "endcard" / "endcard.html"
FPS, DUR, SR = 30, 4.0, 48000
ICONE_T = [2.0, 2.18, 2.36, 2.54]
LIMITE_MB = 50


def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]))


def ler_wav(f):
    tmp = Path(tempfile.mkdtemp()) / "x.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-ac", "1", "-ar", str(SR), str(tmp)], check=True)
    with wave.open(str(tmp)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def achar_sfx(nome, pastas):
    for p in pastas:
        if not p:
            continue
        for ext in (".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"):
            f = Path(p) / (nome + ext)
            if f.exists():
                return f
    return None


def audio_do_card(n_icones, pastas_sfx, destino):
    whoosh, pin = achar_sfx("whoosh", pastas_sfx), achar_sfx("pin", pastas_sfx)
    if not (whoosh and pin):
        kit = Path(tempfile.mkdtemp())
        subprocess.run([sys.executable, str(AQUI / "gerar_sfx.py"), str(kit)], check=True, stdout=subprocess.DEVNULL)
        whoosh, pin = whoosh or kit / "whoosh.wav", pin or kit / "pin.wav"
        print("aviso: sem kit de SFX, usando sons gerados")
    mix = np.zeros(int(DUR * SR), np.float32)
    w = ler_wav(whoosh)[: int(1.2 * SR)] * 0.35
    mix[: len(w)] += w[: len(mix)]
    p = ler_wav(pin)[: int(0.6 * SR)] * 0.45
    for t in ICONE_T[:n_icones]:
        i = int(t * SR); mix[i:i + len(p)] += p[: len(mix) - i]
    mix = np.clip(mix, -0.95, 0.95)
    with wave.open(str(destino), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((mix * 32767).astype(np.int16).tobytes())


def render_quadros(perfil, foto, pasta):
    from playwright.sync_api import sync_playwright
    foto_url = None
    if foto:
        mime = mimetypes.guess_type(str(foto))[0] or "image/jpeg"
        foto_url = f"data:{mime};base64," + base64.b64encode(Path(foto).read_bytes()).decode()
    with sync_playwright() as pw:
        nav = None
        for canal in (None, "chrome", "msedge"):  # Chromium do Playwright, senão Chrome ou Edge já instalados
            try:
                nav = pw.chromium.launch(channel=canal) if canal else pw.chromium.launch()
                break
            except Exception:
                continue
        if not nav:
            sys.exit("Nenhum navegador. Rode: python -m playwright install chromium")
        pg = nav.new_page(viewport={"width": 1080, "height": 1920})
        pg.add_init_script("window.__RENDER__ = true;")
        pg.goto(HTML.as_uri())
        pg.evaluate("document.fonts.ready")
        info = pg.evaluate("([p, f]) => setup(p, f)", [perfil, foto_url])
        pg.wait_for_timeout(300)  # foto decodificada
        for i in range(int(DUR * FPS)):
            pg.evaluate(f"renderAt({i / FPS})")
            pg.screenshot(path=str(pasta / f"f{i:04d}.png"))
        nav.close()
    return info


def encode_limite(entrada_args, filtro, mapas, saida, duracao):
    """Encoda com CRF 18; se passar de 50MB, refaz em 2 passes com bitrate pela duração."""
    base = ["ffmpeg", "-v", "error", "-y", *entrada_args]
    if filtro:
        base += ["-filter_complex", filtro]
    base += mapas
    subprocess.run(base + ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
                           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(saida)], check=True)
    if saida.stat().st_size <= LIMITE_MB * 1_000_000:
        return
    vb = int((46 * 8388608 / duracao - 192000) / 1000)
    log = str(Path(tempfile.mkdtemp()) / "p2")
    nulo = "NUL" if sys.platform.startswith("win") else "/dev/null"
    subprocess.run(base + ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{vb}k", "-pass", "1", "-passlogfile", log,
                           "-pix_fmt", "yuv420p", "-an", "-f", "mp4", nulo], check=True)
    subprocess.run(base + ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{vb}k", "-maxrate", f"{vb * 13 // 10}k",
                           "-bufsize", f"{vb * 2}k", "-pass", "2", "-passlogfile", log, "-pix_fmt", "yuv420p", "-r", str(FPS),
                           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(saida)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perfil", default=str(SKILL / "perfil.json"))
    ap.add_argument("--foto")
    ap.add_argument("--sfx", help="pasta com whoosh.* e pin.*")
    ap.add_argument("--anexar", help="vídeo que recebe o card no fim")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    pp = Path(a.perfil)
    if not pp.exists():
        sys.exit(f"sem perfil em {pp}. Copie perfil.example.json para perfil.json e preencha.")
    perfil = json.load(open(pp, encoding="utf-8"))
    foto = Path(a.foto) if a.foto else ((pp.parent / perfil["foto"]) if perfil.get("foto") else None)
    if foto and not foto.exists():
        print(f"aviso: foto {foto} não existe, card sai sem foto"); foto = None

    tmp = Path(tempfile.mkdtemp(prefix="card_"))
    info = render_quadros(perfil, foto, tmp)
    audio_do_card(info["icones"], [a.sfx, perfil.get("pasta_sfx"), SKILL / "assets" / "sfx"], tmp / "card.wav")
    saida = Path(a.saida)

    card = tmp / "card.mp4" if a.anexar else saida
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(tmp / "f%04d.png"), "-i", str(tmp / "card.wav"),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                    "-ar", str(SR), "-ac", "2", "-shortest", "-movflags", "+faststart", str(card)], check=True)

    if a.anexar:
        v = Path(a.anexar)
        entradas = ["-i", str(v), "-i", str(card)]
        tem_audio = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                                             "stream=index", "-of", "csv=p=0", str(v)]).strip()
        a0 = "0:a"
        if not tem_audio:  # vídeo mudo: completa com silêncio pra o concat funcionar
            entradas += ["-f", "lavfi", "-t", f"{dur(v):.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
            a0 = "2:a"
        filtro = ("[0:v]scale=1080:1920,fps=30,setsar=1[v0];[1:v]fps=30,setsar=1[v1];"
                  f"[{a0}]aresample=48000,aformat=channel_layouts=stereo[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo[a1];"
                  "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
        encode_limite(entradas, filtro, ["-map", "[v]", "-map", "[a]"], saida, dur(v) + DUR)

    shutil.rmtree(tmp, ignore_errors=True)
    mb = saida.stat().st_size / 1_000_000
    print(f"ok: {saida}  {dur(saida):.2f}s  {mb:.1f}MB")


if __name__ == "__main__":
    main()
