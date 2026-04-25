$ErrorActionPreference = 'Stop'

$instanceName = 'construdata-felipe'
$apiKey = $env:EVOLUTION_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  $apiKey = 'construdata2026'
}
$evolutionUrl = $env:EVOLUTION_API_URL
if ([string]::IsNullOrWhiteSpace($evolutionUrl)) {
  $running = docker ps --format '{{.Names}}'
  if ($running -contains 'obras-rk-codex2-evolution') {
    $evolutionUrl = 'http://localhost:8081'
  } else {
    $evolutionUrl = 'http://localhost:8080'
  }
}
$evolutionUrl = $evolutionUrl.TrimEnd('/')

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

function Ensure-WebhookDatabaseRow {
  $postgresContainer = Resolve-Container 'POSTGRES_CONTAINER' @(
    'obras-rk-codex2-postgres',
    'rk-postgres',
    'obras-rk-postgres-1'
  )

  @'
with target_instance as (
  select "id" from evolution."Instance" where "name" = 'construdata-felipe' limit 1
), updated as (
  update evolution."Webhook"
  set "url" = 'http://n8n:5678/webhook/codex2Master0422/webhook/codex2-whatsapp-master',
      "enabled" = true,
      "events" = '["QRCODE_UPDATED","CONNECTION_UPDATE","MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","SEND_MESSAGE"]'::jsonb,
      "webhookByEvents" = false,
      "webhookBase64" = true,
      "updatedAt" = now()
  where "instanceId" in (select "id" from target_instance)
  returning "id"
)
insert into evolution."Webhook" ("id","url","enabled","events","webhookByEvents","webhookBase64","createdAt","updatedAt","instanceId")
select 'codex2-webhook-construdata-felipe',
       'http://n8n:5678/webhook/codex2Master0422/webhook/codex2-whatsapp-master',
       true,
       '["QRCODE_UPDATED","CONNECTION_UPDATE","MESSAGES_UPSERT","MESSAGES_UPDATE","MESSAGES_DELETE","SEND_MESSAGE"]'::jsonb,
       false,
       true,
       now(),
       now(),
       "id"
from target_instance
where not exists (select 1 from updated);
'@ | docker exec -i $postgresContainer psql -U rk_admin -d rk_main
}

$body = @{
  webhook = @{
    enabled = $true
    url = 'http://n8n:5678/webhook/codex2Master0422/webhook/codex2-whatsapp-master'
    webhookByEvents = $false
    webhookBase64 = $true
    events = @(
      'QRCODE_UPDATED',
      'CONNECTION_UPDATE',
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'MESSAGES_DELETE',
      'SEND_MESSAGE'
    )
  }
} | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod -Method Post -Uri "$evolutionUrl/webhook/set/$instanceName" -Headers @{ apikey = $apiKey; 'Content-Type' = 'application/json' } -Body $body | Out-Host
  Write-Host 'Webhook updated through Evolution API.'
} catch {
  Write-Warning 'REST webhook update failed. Trying direct database update.'
}

try {
  Ensure-WebhookDatabaseRow | Out-Host
  Write-Host 'Webhook database row verified.'
} catch {
  Write-Warning 'Could not verify webhook in the local Evolution database.'
}
