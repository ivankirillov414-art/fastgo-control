[CmdletBinding()]
param([string]$BotRoot,[switch]$Apply,[switch]$LibraryOnly,[string]$StartupDirectory,[string]$ResultFile)
$ErrorActionPreference='Stop'
try{[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)}catch{}

function Get-JarvisRoot([object[]]$Actions,[string]$StartupText){
 foreach($action in $Actions){
  $text=([string]$action.Execute)+' '+([string]$action.Arguments)
  $match=[regex]::Match($text,'(?i)([a-z]:\\[^"\r\n]*\\)(?:SYNC_TELEMETRY_AUTO\.bat|SYNC_TELEMETRY_HIDDEN\.vbs)')
  if($match.Success){return $match.Groups[1].Value.TrimEnd('\')}
 }
 $match=[regex]::Match($StartupText,'(?i)"([a-z]:\\[^"\r\n]+)\\RUN_JARVIS_TRADER_FOREVER\.bat"')
 if($match.Success){return $match.Groups[1].Value}
 throw 'JARVIS task/startup was not found. No changes made. Run this file on the cash laptop where JARVIS is installed.'
}
function New-HiddenWrapper([string]$Root,[string]$Batch,[bool]$Wait){
 $directory=$Root.Replace('"','""');$batchName=$Batch.Replace('"','""');$waitText=if($Wait){'True'}else{'False'}
 return @"
Option Explicit
' JARVIS quiet-launch repair: launcher only, no trading configuration changes.
Dim sh, command, result
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$directory"
command = Chr(34) & sh.ExpandEnvironmentStrings("%ComSpec%") & Chr(34) & " /d /s /c " & Chr(34) & Chr(34) & "$directory\$batchName" & Chr(34) & Chr(34)
result = sh.Run(command, 0, $waitText)
WScript.Quit result
"@
}
if($LibraryOnly){return}

$task=Get-ScheduledTask -TaskName 'JARVIS_Bybit_Telemetry' -TaskPath '\' -ErrorAction SilentlyContinue
if(!$StartupDirectory){$StartupDirectory=[Environment]::GetFolderPath('Startup')}
$startup=Join-Path $StartupDirectory 'JARVIS_Bybit_Trader_Autostart.cmd'
$startupVbs=[IO.Path]::ChangeExtension($startup,'.vbs')
$startupText=if(Test-Path -LiteralPath $startup){[IO.File]::ReadAllText($startup)}else{''}
if(!$task -and !$startupText){throw 'No JARVIS scheduled task or legacy startup entry found. No changes made.'}
$originalTaskActions=@($task.Actions)
if(!$BotRoot){$BotRoot=Get-JarvisRoot -Actions @($task.Actions) -StartupText $startupText}
$BotRoot=(Resolve-Path -LiteralPath $BotRoot).Path
if(!(Test-Path -LiteralPath (Join-Path $BotRoot 'src\main.py') -PathType Leaf)){throw 'The detected folder does not contain the installed JARVIS bot. No changes made.'}
$telemetry=Join-Path $BotRoot 'SYNC_TELEMETRY_AUTO.bat'
$runner=Join-Path $BotRoot 'RUN_JARVIS_TRADER_FOREVER.bat'
$wrapper=Join-Path $BotRoot 'SYNC_TELEMETRY_HIDDEN.vbs'
if($task -and !(Test-Path -LiteralPath $telemetry -PathType Leaf)){throw 'Telemetry launcher is missing. No changes made.'}
if($startupText -and !(Test-Path -LiteralPath $runner -PathType Leaf)){throw 'Existing bot watchdog is missing. No changes made.'}
$wscript=Join-Path $env:WINDIR 'System32\wscript.exe'
if(!(Test-Path -LiteralPath $wscript -PathType Leaf)){throw 'Windows Script Host is unavailable. No changes made.'}
if(!$Apply){
 $inspection=[pscustomobject]@{mode='inspect';bot_root=$BotRoot;telemetry_task_found=[bool]$task;legacy_startup_found=[bool]$startupText;changes_made=$false}|ConvertTo-Json
 if($ResultFile){[IO.File]::WriteAllText($ResultFile,$inspection,[Text.UTF8Encoding]::new($false))}
 $inspection;return
}

$backup=Join-Path $BotRoot ('.quiet-launch-backup\'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backup -Force|Out-Null
$saved=@{};$files=@($wrapper,$startup,$startupVbs)
foreach($file in $files){$saved[$file]=if(Test-Path -LiteralPath $file){[IO.File]::ReadAllBytes($file)}else{$null}}
if($task){Export-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath|Set-Content -LiteralPath (Join-Path $backup 'telemetry-task.xml') -Encoding Unicode}
foreach($file in $files){if($null -ne $saved[$file]){[IO.File]::WriteAllBytes((Join-Path $backup ([IO.Path]::GetFileName($file))),$saved[$file])}}
$taskChanged=$false
try{
 if($task){
  [IO.File]::WriteAllText($wrapper,(New-HiddenWrapper $BotRoot 'SYNC_TELEMETRY_AUTO.bat' $true),[Text.Encoding]::Unicode)
  $action=New-ScheduledTaskAction -Execute $wscript -Argument ('//B //Nologo "'+$wrapper+'"') -WorkingDirectory $BotRoot
  Set-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Action $action|Out-Null
  $taskChanged=$true
  $verified=Get-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath
  if($verified.Actions.Count -ne 1 -or $verified.Actions[0].Execute -ne $wscript -or $verified.Actions[0].Arguments -ne $action.Arguments){throw 'The scheduled-task update did not verify.'}
 }
 if($startupText){
  # Only remove this exact old startup entry after its bytes are backed up.
  [IO.File]::WriteAllText($startupVbs,(New-HiddenWrapper $BotRoot 'RUN_JARVIS_TRADER_FOREVER.bat' $false),[Text.Encoding]::Unicode)
  Remove-Item -LiteralPath $startup
 }
 $receipt=[pscustomobject]@{fixed_at=(Get-Date).ToUniversalTime().ToString('o');bot_root=$BotRoot;telemetry_hidden=[bool]$task;startup_hidden=[bool]$startupText;backup=$backup;bot_restarted=$false;trading_configuration_changed=$false}
 $receipt|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $backup 'repair-receipt.json') -Encoding utf8
 if($ResultFile){[IO.File]::WriteAllText($ResultFile,($receipt|ConvertTo-Json),[Text.UTF8Encoding]::new($false))}
 $receipt|ConvertTo-Json
}catch{
 $failure=$_
 if($taskChanged){Set-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Action $originalTaskActions|Out-Null}
 foreach($file in $files){if($null -ne $saved[$file]){[IO.File]::WriteAllBytes($file,$saved[$file])}elseif(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file}}
 throw $failure
}
