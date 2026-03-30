param(
    [string]$Channel = "8.0"
)

$ErrorActionPreference = "Stop"

$installRoot = Join-Path $PSScriptRoot ".dotnet"
$installScript = Join-Path $PSScriptRoot ".dotnet-install.ps1"

if (-not (Test-Path $installScript)) {
    Invoke-WebRequest "https://dot.net/v1/dotnet-install.ps1" -OutFile $installScript
}

New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

& powershell -ExecutionPolicy Bypass -File $installScript -Channel $Channel -InstallDir $installRoot -NoPath

$dotnet = Join-Path $installRoot "dotnet.exe"
if (-not (Test-Path $dotnet)) {
    throw "Falha ao instalar o .NET SDK local em $installRoot"
}

Write-Host "dotnet local disponivel em: $dotnet"
& $dotnet --list-sdks
