<#
  novo-reel.ps1 - prepara um Reel a partir da pasta do video bruto.

  Estrutura esperada:
    <pasta-de-trabalho>\     <- padrao: a pasta atual (-Base muda)
      sfx\                     <- kit mestre (pin.wav, rise.wav, boom.wav, ...)
      reel-01\                 <- uma pasta por video
        gravacao.mp4           <- o bruto (qualquer nome)
        roteiro.md             <- o roteiro que voce gravou

  Uso:  .\novo-reel.ps1 reel-01
#>
param(
  [Parameter(Mandatory = $true)][string]$Nome,
  [string]$Base = (Get-Location).Path,
  [string]$Modelo = "small"
)

$ErrorActionPreference = "Stop"
# o script sabe onde ele mesmo esta - funciona de qualquer pasta
$SKILL = Split-Path -Parent $PSScriptRoot
$origem = Join-Path $Base $Nome
$projeto = Join-Path $origem "projeto"

if (-not (Test-Path $origem)) { throw "pasta nao encontrada: $origem" }

# --- acha o video bruto (o maior arquivo de video da pasta) ---------------
$video = Get-ChildItem -Path $origem -File |
  Where-Object { $_.Extension -match '^\.(mp4|mov|webm|mkv|m4v)$' } |
  Sort-Object Length -Descending | Select-Object -First 1
if (-not $video) { throw "nenhum video em $origem" }

$roteiro = Get-ChildItem -Path $origem -File |
  Where-Object { $_.Name -match '^roteiro\.(md|txt)$' } | Select-Object -First 1
if (-not $roteiro) { Write-Warning "sem roteiro.md em $origem - a passada criativa vai ficar as cegas" }

Write-Host "video   : $($video.Name) ($([math]::Round($video.Length/1MB,1)) MB)" -ForegroundColor Cyan
Write-Host "roteiro : $(if ($roteiro) { $roteiro.Name } else { '(nenhum)' })" -ForegroundColor Cyan

# --- 1. scaffold do projeto (nao toca no seu bruto) ----------------------
if (Test-Path $projeto) {
  Write-Host "projeto ja existe, reaproveitando: $projeto" -ForegroundColor Yellow
} else {
  Write-Host "`n[1/5] criando o projeto..." -ForegroundColor Green
  Push-Location $origem
  try {
    npx hyperframes init projeto --example blank --resolution portrait `
      --video $video.FullName --non-interactive --skip-transcribe
  } finally { Pop-Location }
  if (-not (Test-Path $projeto)) { throw "o init nao criou $projeto" }
}

# --- 2. roteiro e SFX entram no projeto ----------------------------------
Write-Host "`n[2/5] copiando roteiro e SFX..." -ForegroundColor Green
if ($roteiro) { Copy-Item $roteiro.FullName (Join-Path $projeto "roteiro.md") -Force }

$sfxOrigem = Join-Path $Base "sfx"
$sfxDestino = Join-Path $projeto "assets\sfx"
New-Item -ItemType Directory -Force -Path $sfxDestino | Out-Null
if (Test-Path $sfxOrigem) {
  Copy-Item "$sfxOrigem\*" $sfxDestino -Force -Recurse
  Write-Host "  SFX: $((Get-ChildItem $sfxDestino -File).Count) arquivos"
} else {
  Write-Warning "  sem kit de SFX em $sfxOrigem - o plan.json vai sair sem som de efeito"
}

# --- 3. audio separado (mixer deterministico) ----------------------------
Write-Host "`n[3/5] extraindo o audio..." -ForegroundColor Green
$videoNoProjeto = Get-ChildItem -Path $projeto -File |
  Where-Object { $_.Extension -match '^\.(mp4|mov|webm|mkv|m4v)$' } |
  Sort-Object Length -Descending | Select-Object -First 1
$wav = Join-Path $projeto "source-audio.wav"
ffmpeg -y -loglevel error -i $videoNoProjeto.FullName -vn -c:a pcm_s16le -ar 48000 $wav
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $wav)) {
  Write-Warning "ffmpeg nao gerou o wav (codigo $LASTEXITCODE) - o build vai usar o audio do proprio video"
}

# --- 4. transcricao em portugues -----------------------------------------
Write-Host "`n[4/5] transcrevendo em portugues (a 1a vez baixa o modelo, demora)..." -ForegroundColor Green
Push-Location $projeto
try {
  npx hyperframes transcribe $videoNoProjeto.Name --model $Modelo --language pt --engine whisper
} finally { Pop-Location }

if (-not (Test-Path (Join-Path $projeto "transcript.json"))) {
  throw "transcript.json nao foi gerado - confira a saida do transcribe acima"
}

# --- 5. plano de cortes ---------------------------------------------------
Write-Host "`n[5/5] planejando os cortes..." -ForegroundColor Green
node "$SKILL\scripts\plan-cuts.mjs" $projeto

Write-Host "`n=== pronto pra passada criativa ===" -ForegroundColor Magenta
Write-Host "abra: $projeto\plan.json"
Write-Host "preencha titulo, graficos, split, sfx e cta lendo o roteiro."
Write-Host "depois rode:  .\montar.ps1 $Nome"
