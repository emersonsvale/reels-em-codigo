# Sistema visual — clean minimal / editorial

Deliberadamente contido: papel claro, tinta quase preta, **um** acento. Passa autoridade e não compete com o rosto.

## Tokens

```css
--paper:  #faf8f4;   /* fundo dos cards */
--ink:    #16181c;   /* texto sobre papel */
--accent: #dc3b23;   /* vermelho editorial — kicker, réguas, CTA */
--muted:  #6b7280;   /* apoio, legenda de gráfico */
--fundo:  #0a0c12;   /* fundo da composição e painel do split */
```

Fonte do sistema, sem download, sem risco de render sem fonte:

```css
--sans:  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--serif: ui-serif, Georgia, "Times New Roman", serif;
```

**Serifada para display, sans para leitura.** Título e CTA em serifada (voz editorial, distinta); legenda, lista e detalhe em sans (legibilidade em tela pequena, em movimento).

## Regras

1. **Um acento, e escasso.** O vermelho é kicker, régua e o @ do CTA. Se ele aparece em três lugares no mesmo frame, tire de dois.
2. **Card é papel opaco.** Nada de card translúcido sobre o vídeo — vira sujeira. O contraste papel/vídeo é o que separa informação de rosto.
3. **Fundo nunca é preto puro.** É `#0a0c12`. Preto puro no meio de um vídeo lê como falha de render; o azul-escuro lê como escolha.
4. **Legenda tem scrim.** Texto branco 700 com fundo `rgba(12,14,18,.62)` e cantos arredondados. O vídeo varia de luz; sem scrim a legenda some.

## Safe zones do 9:16 (1080×1920)

| Região | Faixa | Por quê |
|---|---|---|
| Topo | 0–180px | relógio e UI do sistema |
| Base | 1700–1920px | @, legenda e botões do Instagram |
| Legenda | ~1430px | acima da UI, abaixo do rosto |
| Gráfico | 200–1100px | terço superior, longe da boca |

No **split**, o vídeo vai pra `top: 960, height: 960` — metade de baixo. A legenda em 1430px continua sobre o vídeo nos dois layouts, então não precisa mudar de lugar.

## Zoom

Alterna `1.0` e `1.08` entre cortes. `transform-origin: 50% 42%` — mira no rosto, não no centro geométrico do frame, senão o zoom "cai" pro peito.

Não passe de `1.12`: acima disso a perda de resolução aparece, e o corte vira efeito em vez de ritmo.
