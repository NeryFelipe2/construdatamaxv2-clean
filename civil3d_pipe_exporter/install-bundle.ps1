param(
    [string]$DestinationRoot = "C:\ProgramData\Autodesk\ApplicationPlugins"
)

$ErrorActionPreference = "Stop"

$sourceBundle = Join-Path $PSScriptRoot "bundle\PipeNetworkExporter.bundle"
$destinationBundle = Join-Path $DestinationRoot "PipeNetworkExporter.bundle"

if (-not (Test-Path $sourceBundle)) {
    throw "Bundle local nao encontrado em $sourceBundle"
}

New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null

if (Test-Path $destinationBundle) {
    Remove-Item $destinationBundle -Recurse -Force
}

Copy-Item $sourceBundle $destinationBundle -Recurse -Force

Write-Host "Bundle instalado em: $destinationBundle"
