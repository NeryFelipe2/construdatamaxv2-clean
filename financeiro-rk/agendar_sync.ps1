$taskName = "ConstruDataMax_Sync_Motor_Financeiro"
$pythonExe = "python.exe" # Substitua pelo caminho completo se necessario
$scriptPath = "C:\Users\felip\Downloads\construdatamaxv2-clean\financeiro-rk\sync_bidirecional.py"
$workDir = "C:\Users\felip\Downloads\construdatamaxv2-clean\financeiro-rk"
$actionArgs = """$scriptPath"" full"

$action = New-ScheduledTaskAction -Execute $pythonExe -Argument $actionArgs -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Daily -At 11:30PM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -Action $action -Trigger $trigger -TaskName $taskName -Description "Sincroniza os dados locais RK Engenharia com o Supabase (ConstruDataMax Gestao 360) todo dia as 23:30h" -Settings $settings

Write-Host "✅ Tarefa $taskName agendada com sucesso no Task Scheduler (Toda noite 23:30)."
