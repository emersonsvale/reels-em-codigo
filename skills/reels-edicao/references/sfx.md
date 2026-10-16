# Efeitos sonoros

## Nomes dos arquivos

Coloque em `assets/sfx/` com **exatamente** estes nomes (o `plan.json` referencia por nome):

| Arquivo | Som | Quando usar |
|---|---|---|
| `pin.wav` | pin de notificação, curto e seco | um dado aparecendo, item de lista entrando |
| `rise.wav` | subida de tensão, 0.6–1.2s | **antes** de uma revelação — antecipação |
| `boom.wav` | impacto grave | a revelação em si, ou a entrada do CTA |
| `whoosh.wav` | passagem de ar | troca de layout, entrada do split screen |
| `pop.wav` | pop leve | ênfase pequena, palavra-chave |

**A extensão não importa.** O `build-composition.mjs` procura por nome e aceita `.wav`, `.mp3`, `.m4a`, `.ogg`, `.flac` e `.aac`. No `plan.json` você escreve só `"som": "pin"` — ele acha o arquivo.

**Kit incompleto não quebra o render.** SFX que não existir na pasta é ignorado, com aviso na saída dizendo qual faltou e quais existem. Dá pra começar com dois sons e ir completando.

Onde achar os que faltam: o [Pixabay](https://pixabay.com/sound-effects/) tem busca por `riser`, `impact` e `notification` sob licença que permite uso comercial sem atribuição — confira a licença de cada arquivo antes de usar.

## Como declarar

```json
"sfx": [
  { "som": "rise", "em": 6.4, "duracao": 0.9, "volume": 0.45 },
  { "som": "boom", "em": 7.3, "volume": 0.6 }
]
```

`em` é o tempo **na timeline final** (depois dos cortes), não no arquivo bruto.

## Regras de uso

1. **O `rise` termina onde o `boom` começa.** Se sobrar buraco entre os dois, a antecipação morre. Se sobrepor, vira barulho.
2. **Volume baixo.** `0.4–0.6`. SFX que compete com a voz faz o espectador sair, não prestar atenção.
3. **Máximo 4 num Reel de 30s.** Som demais lê como template de banco de vídeo.
4. **Nada de música.** Escolha do padrão, e acertada pra conteúdo falado: a voz carrega, a música só disputa.
5. **Ducking.** O grupo `sfx` é separado do grupo `voz` no `data-audio-group`. Se algum efeito ainda encobrir a fala, baixe o `volume` dele antes de mexer em qualquer outra coisa.
