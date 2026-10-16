"""Gera um kit mínimo de efeitos (whoosh.wav e pin.wav) quando não há kit próprio.

Uso:  python gerar_sfx.py <pasta-destino>

São sons simples, sintetizados. Funcionam em volume baixo; um kit gravado soa melhor.
"""
import sys, wave
from pathlib import Path
import numpy as np

SR = 48000


def salvar(caminho, x):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.9, -1, 1)
    with wave.open(str(caminho), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def whoosh(d=0.45, seed=7):
    n = int(d * SR)
    ruido = np.random.default_rng(seed).standard_normal(n).astype(np.float32)
    out = np.zeros(n, np.float32); acc = 0.0
    for j in range(n):  # passa-baixa que abre ao longo do som: dá a sensação de passagem de ar
        alpha = 0.02 + 0.25 * (j / n)
        acc += alpha * (ruido[j] - acc); out[j] = acc
    return out * np.sin(np.linspace(0, np.pi, n)) ** 2


def pin(d=0.35, f=1760.0):
    t = np.arange(int(d * SR)) / SR
    tom = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t)
    env = np.minimum(t / 0.004, 1) * np.exp(-t * 14)
    return tom * env


if __name__ == "__main__":
    destino = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    destino.mkdir(parents=True, exist_ok=True)
    salvar(destino / "whoosh.wav", whoosh())
    salvar(destino / "pin.wav", pin())
    print("ok:", destino / "whoosh.wav", destino / "pin.wav")
