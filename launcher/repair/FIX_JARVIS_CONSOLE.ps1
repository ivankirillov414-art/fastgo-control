[CmdletBinding()]
param([string]$BotRoot,[switch]$Apply,[switch]$LibraryOnly,[string]$StartupDirectory,[string]$ResultFile)
$ErrorActionPreference='Stop'
try{[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)}catch{}

function Get-JarvisLaunchRoots([string]$Text,[string]$WorkingDirectory){
 $text=[Environment]::ExpandEnvironmentVariables($Text)
 $working=[Environment]::ExpandEnvironmentVariables($WorkingDirectory).Trim().Trim('"')
 $names='(?:SYNC_TELEMETRY_AUTO\.bat|SYNC_TELEMETRY_HIDDEN\.vbs|RUN_JARVIS_TRADER_FOREVER\.bat)'
 # Inspect Execute and Arguments separately. A second drive colon or a command
 # switch cannot become part of the bot path (cmd.exe /c C:\Bot\...).
 $absolute='(?i)(?<file>(?:[a-z]:\\|\\\\[^\\\s"]+\\[^\\\s"]+\\)[^":\r\n<>|/]*'+$names+')(?=$|[\s"])'
 $matches=[regex]::Matches($text,$absolute)
 foreach($match in $matches){[IO.Path]::GetDirectoryName($match.Groups['file'].Value)}
 if($matches.Count -or !$working){return}
 $relative='(?i)(?:^|[\s"])(?<file>(?:\.\.?\\)?(?:[^\\":\r\n<>|/]+\\)*'+$names+')(?=$|[\s"])'
 foreach($match in [regex]::Matches($text,$relative)){
  $path=[IO.Path]::Combine($working,$match.Groups['file'].Value.Trim())
  [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($path))
 }
}
function Get-JarvisRoot([object[]]$Actions,[string]$StartupText){
 $candidates=@(foreach($action in $Actions){
  Get-JarvisLaunchRoots -Text ([string]$action.Execute) -WorkingDirectory ([string]$action.WorkingDirectory)
  Get-JarvisLaunchRoots -Text ([string]$action.Arguments) -WorkingDirectory ([string]$action.WorkingDirectory)
 }; Get-JarvisLaunchRoots -Text $StartupText -WorkingDirectory '')|Select-Object -Unique
 $installed=@($candidates|Where-Object {[IO.File]::Exists([IO.Path]::Combine($_,'src\main.py'))})
 if($installed.Count -gt 1){throw 'Multiple JARVIS installations were found in the task/startup entries. No changes made.'}
 if($installed.Count -eq 1){return $installed[0]}
 if($candidates.Count){return @($candidates)[0]}
 throw 'JARVIS task/startup was not found. No changes made. Run this file on the cash laptop where JARVIS is installed.'
}
function Read-JarvisStartup([string]$Path){
 $bytes=[IO.File]::ReadAllBytes($Path)
 if(($bytes.Length -ge 2 -and (($bytes[0] -eq 255 -and $bytes[1] -eq 254) -or ($bytes[0] -eq 254 -and $bytes[1] -eq 255))) -or
    ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) -or
    ($bytes.Length -ge 4 -and $bytes[0] -eq 0 -and $bytes[1] -eq 0 -and $bytes[2] -eq 254 -and $bytes[3] -eq 255)){
  return [IO.File]::ReadAllText($Path)
 }
 try{return [Text.UTF8Encoding]::new($false,$true).GetString($bytes)}catch [Text.DecoderFallbackException]{}
 $textInfo=[Globalization.CultureInfo]::CurrentCulture.TextInfo
 $uiTextInfo=[Globalization.CultureInfo]::CurrentUICulture.TextInfo
 # The UI is Russian; include its OEM/ANSI pages when Windows itself uses a
 # different display locale. Accept a legacy decoding only for a real bot path.
 $pages=@($textInfo.OEMCodePage,$textInfo.ANSICodePage,$uiTextInfo.OEMCodePage,$uiTextInfo.ANSICodePage,866,1251)|Select-Object -Unique
 $valid=@(foreach($page in $pages){
  $text=[Text.Encoding]::GetEncoding($page).GetString($bytes)
  foreach($root in @(Get-JarvisLaunchRoots -Text $text -WorkingDirectory '')){
   if([IO.File]::Exists([IO.Path]::Combine($root,'src\main.py')) -and
      [IO.File]::Exists([IO.Path]::Combine($root,'RUN_JARVIS_TRADER_FOREVER.bat'))){
    [pscustomobject]@{root=$root;text=$text};break
   }
  }
 })
 $roots=@($valid|ForEach-Object {$_.root}|Select-Object -Unique)
 if($roots.Count -eq 1){return $valid[0].text}
 throw 'The Windows encoding of the JARVIS startup entry could not be resolved to one installed bot folder. No changes made.'
}
function Get-JarvisTask{
 try{Get-ScheduledTask -TaskName 'JARVIS_Bybit_Telemetry' -TaskPath '\' -ErrorAction Stop}
 catch{if($_.FullyQualifiedErrorId -like 'CmdletizationQuery_NotFound*'){return};throw}
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

$task=Get-JarvisTask
if(!$StartupDirectory){$StartupDirectory=[Environment]::GetFolderPath('Startup')}
$startup=Join-Path $StartupDirectory 'JARVIS_Bybit_Trader_Autostart.cmd'
$startupVbs=[IO.Path]::ChangeExtension($startup,'.vbs')
$legacyStartupText=if(Test-Path -LiteralPath $startup){Read-JarvisStartup $startup}else{''}
$hiddenStartupText=if(Test-Path -LiteralPath $startupVbs){Read-JarvisStartup $startupVbs}else{''}
$startupText=$legacyStartupText+$hiddenStartupText
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
 if($legacyStartupText){
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
 $rollbackErrors=@()
 if($taskChanged){
  try{Set-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Action $originalTaskActions|Out-Null}
  catch{$rollbackErrors+=('Task restore: '+$_.Exception.Message)}
 }
 foreach($file in $files){
  try{
   if($null -ne $saved[$file]){[IO.File]::WriteAllBytes($file,$saved[$file])}
   elseif(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file}
  }catch{$rollbackErrors+=('File restore '+$file+': '+$_.Exception.Message)}
 }
 if($rollbackErrors.Count){
  throw [InvalidOperationException]::new(('Rollback incomplete. Original error: '+$failure.Exception.Message+' Backup: '+$backup+'. Restore errors: '+($rollbackErrors -join '; ')),$failure.Exception)
 }
 throw $failure
}
