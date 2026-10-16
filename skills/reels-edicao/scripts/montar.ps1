<#
  montar.ps1 - compila a composicao e abre o preview.
  Com -Render, renderiza o final em vez de abrir o preview.

  Uso:  .\montar.ps1 reel-01
        .\montar.ps1 reel-01 -Render
        .\montar.ps1 reel-01 -Render -Qualidade draft
#>
param(
  [Parameter(Mandatory = $true)][string]$Nome,
  [string]$Base = (Get-Location).Path,
  [switch]$Render,
  [ValidateSet("draft", "standard", "high")][string]$Qualidade = "high"
)

$ErrorActionPreference = "Stop"
# o script sabe onde ele mesmo esta - funciona de qualquer pasta
$SKILL = Split-Path -Parent $PSScriptRoot
$projeto = Join-Path $Base "$Nome\projeto"

if (-not (Test-Path (Join-Path $projeto "plan.json"))) {
  throw "sem plan.json em $projeto - rode antes: .\novo-reel.ps1 $Nome"
}

Write-Host "compilando a composicao..." -ForegroundColor Green
node "$SKILL\scripts\build-composition.mjs" $projeto

Push-Location $projeto
try {
  if ($Render) {
    $saida = Join-Path $projeto "final.mp4"
    Write-Host "`nrenderizando ($Qualidade)..." -ForegroundColor Green
    npx hyperframes render --quality $Qualidade --output $saida
    if (Test-Path $saida) {
      $mb = [math]::Round((Get-Item $saida).Length / 1MB, 1)
      Write-Host "`npronto: $saida ($mb MB)" -ForegroundColor Magenta
    }
  } else {
    Write-Host "`nabrindo o preview (Ctrl+C pra sair)..." -ForegroundColor Green
    npx hyperframes preview
  }
} finally {
  Pop-Location
}
