$ErrorActionPreference = 'Stop'

$sourceVolume = 'construdatamaxv2-clean_evolution_instances'
$targetVolume = 'obras-rk-codex2_evolution_instances'

docker run --rm `
  -v "${sourceVolume}:/from" `
  -v "${targetVolume}:/to" `
  alpine sh -lc "cp -a /from/. /to/ && find /to -maxdepth 3 -type f | sed -n '1,50p'"

Write-Host 'Evolution session data copied from old stack volume to CODEX 2.0 volume.'
