param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$project = Join-Path $PSScriptRoot "PipeNetworkExporter.csproj"
$bundleRoot = Join-Path $PSScriptRoot "bundle\\PipeNetworkExporter.bundle\\Contents"
$localDotnet = Join-Path $PSScriptRoot ".dotnet\\dotnet.exe"
$setupScript = Join-Path $PSScriptRoot "setup-dotnet.ps1"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue) -and -not (Test-Path $localDotnet)) {
    & $setupScript
}

$sdkList = $null
if (Test-Path $localDotnet) {
    $sdkList = & $localDotnet --list-sdks
}
elseif (Get-Command dotnet -ErrorAction SilentlyContinue) {
    $sdkList = dotnet --list-sdks
}

if (-not $sdkList) {
    & $setupScript
}

if (Test-Path $localDotnet) {
    $dotnet = $localDotnet
}
else {
    $dotnet = "dotnet"
}

& $dotnet build $project -c $Configuration

$buildDir = Join-Path $PSScriptRoot ("bin\\" + $Configuration)
$dll = Join-Path $buildDir "PipeNetworkExporter.dll"
$pdb = Join-Path $buildDir "PipeNetworkExporter.pdb"

if (-not (Test-Path $dll)) {
    throw "DLL compilada nao encontrada em $dll"
}

New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
Copy-Item $dll $bundleRoot -Force
if (Test-Path $pdb) {
    Copy-Item $pdb $bundleRoot -Force
}

Write-Host "Bundle atualizado em: $bundleRoot"
