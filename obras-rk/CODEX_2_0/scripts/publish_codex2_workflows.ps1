$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent $root)
$artifacts = Join-Path $root 'artifacts'
$workflows = Join-Path $root 'workflows'

function Resolve-Container($envName, [string[]] $candidates) {
  $fromEnv = [Environment]::GetEnvironmentVariable($envName)
  if (-not [string]::IsNullOrWhiteSpace($fromEnv)) {
    return $fromEnv
  }
  $running = docker ps --format '{{.Names}}'
  foreach ($candidate in $candidates) {
    if ($running -contains $candidate) {
      return $candidate
    }
  }
  return $candidates[0]
}

$n8nContainer = Resolve-Container 'N8N_CONTAINER' @(
  'obras-rk-codex2-n8n',
  'rk-n8n',
  'obras-rk-n8n-1'
)
$postgresContainer = Resolve-Container 'POSTGRES_CONTAINER' @(
  'obras-rk-codex2-postgres',
  'rk-postgres',
  'obras-rk-postgres-1'
)

$files = @(
  'CONSTRUDATA_CODEX2_MASTER',
  'CONSTRUDATA_CODEX2_RDO',
  'CONSTRUDATA_CODEX2_FINANCEIRO',
  'CONSTRUDATA_CODEX2_TAREFA'
)

function Ensure-N8nWebhookRows {
  @'
insert into webhook_entity ("webhookPath", method, node, "workflowId")
values
('codex2Master0422/webhook/codex2-whatsapp-master', 'POST', 'Webhook', 'codex2Master0422'),
('codex2Rdo042226/webhook/codex2-sub-rdo', 'POST', 'Webhook', 'codex2Rdo042226'),
('codex2Fin042226/webhook/codex2-financeiro', 'POST', 'Webhook', 'codex2Fin042226'),
('codex2Task04226/webhook/codex2-sub-tarefa', 'POST', 'Webhook', 'codex2Task04226')
on conflict ("webhookPath", method) do update
set node = excluded.node,
    "workflowId" = excluded."workflowId";
'@ | docker exec -i $postgresContainer psql -U rk_admin -d rk_main | Out-Host
}

foreach ($name in $files) {
  $src = Join-Path $workflows "$name.workflow.ts"
  $out = Join-Path $artifacts "$name.json"
  npx --yes n8nac convert $src --output $out --force | Out-Host
  docker cp $out "${n8nContainer}:/tmp/$name.json" | Out-Host
  docker exec $n8nContainer n8n import:workflow --input="/tmp/$name.json" | Out-Host
}

@'
select id,name,active from workflow_entity
where name in (
  'CONSTRUDATA_CODEX2_MASTER',
  'CONSTRUDATA_CODEX2_RDO',
  'CONSTRUDATA_CODEX2_FINANCEIRO',
  'CONSTRUDATA_CODEX2_TAREFA'
)
order by name;
'@ | docker exec -i $postgresContainer psql -U rk_admin -d rk_main

foreach ($id in @('codex2Master0422','codex2Rdo042226','codex2Fin042226','codex2Task04226')) {
  docker exec $n8nContainer n8n publish:workflow --id=$id | Out-Host
}

docker restart $n8nContainer | Out-Host
Start-Sleep -Seconds 8
Ensure-N8nWebhookRows

@'
select "workflowId","webhookPath",method
from webhook_entity
where "workflowId" in ('codex2Master0422','codex2Rdo042226','codex2Fin042226','codex2Task04226')
order by "workflowId","webhookPath";
'@ | docker exec -i $postgresContainer psql -U rk_admin -d rk_main | Out-Host

Write-Host "CODEX 2.0 workflows published, restarted and webhook rows ensured on $n8nContainer."
