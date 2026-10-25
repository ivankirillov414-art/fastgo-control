$ErrorActionPreference='Stop'
$repair=Join-Path $PSScriptRoot 'FIX_JARVIS_CONSOLE.ps1'
$tokens=$null;$errors=$null
[Management.Automation.Language.Parser]::ParseFile($repair,[ref]$tokens,[ref]$errors)|Out-Null
if($errors.Count){throw ($errors|Out-String)}
. $repair -LibraryOnly
function Assert($condition,$message){if(!$condition){throw $message}}
$root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute='C:\Test folder\SYNC_TELEMETRY_AUTO.bat';Arguments=''}) -StartupText ''
Assert ($root -eq 'C:\Test folder') 'Legacy scheduled-task path must be detected'
$root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute='C:\Windows\System32\wscript.exe';Arguments='//B //Nologo "C:\Test folder\SYNC_TELEMETRY_HIDDEN.vbs"'}) -StartupText ''
Assert ($root -eq 'C:\Test folder') 'Reapplying the fix must detect the hidden wrapper'
$root=Get-JarvisRoot -Actions @() -StartupText 'start "" /min "C:\Test folder\RUN_JARVIS_TRADER_FOREVER.bat"'
Assert ($root -eq 'C:\Test folder') 'Existing startup entry must detect the bot folder'
foreach($hostName in @('cmd.exe','wscript.exe')){
 foreach($drive in @('C:','D:')){
  foreach($quoted in @($false,$true)){
   $batch=if($hostName -eq 'cmd.exe'){'SYNC_TELEMETRY_AUTO.bat'}else{'SYNC_TELEMETRY_HIDDEN.vbs'}
   $prefix=if($hostName -eq 'cmd.exe'){'/d /c '}else{'//B //Nologo '}
   $target=$drive+'\Test folder\'+$batch
   $argument=$prefix+$(if($quoted){'"'+$target+'"'}else{$target})
   $root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute=('C:\Windows\System32\'+$hostName);Arguments=$argument}) -StartupText ''
   Assert ($root -eq ($drive+'\Test folder')) ('Host executable must not be captured: '+$hostName+' '+$argument)
  }
 }
}
foreach($relative in @('SYNC_TELEMETRY_AUTO.bat','.\SYNC_TELEMETRY_AUTO.bat','Sub folder\SYNC_TELEMETRY_AUTO.bat')){
 $root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute=$relative;Arguments='';WorkingDirectory='C:\Test folder'}) -StartupText ''
 $expected=[IO.Path]::GetDirectoryName([IO.Path]::GetFullPath((Join-Path 'C:\Test folder' $relative)))
 Assert ($root -eq $expected) 'Relative task actions must use their WorkingDirectory'
 $root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute='cmd.exe';Arguments=('/c "'+$relative+'"');WorkingDirectory='C:\Test folder'}) -StartupText ''
 Assert ($root -eq $expected) 'Relative task arguments must use their WorkingDirectory'
}
$root=Get-JarvisRoot -Actions @([pscustomobject]@{Execute='%SystemRoot%\System32\cmd.exe';Arguments='/c "%USERPROFILE%\Test folder\SYNC_TELEMETRY_AUTO.bat"'}) -StartupText ''
Assert ($root -eq (Join-Path $env:USERPROFILE 'Test folder')) 'Task paths must expand Windows environment variables'
# Use an actual CIM action as well as the simple PSCustomObject fixtures.
$cimAction=New-ScheduledTaskAction -Execute 'C:\Windows\System32\cmd.exe' -Argument '/c C:\Test folder\SYNC_TELEMETRY_AUTO.bat'
Assert ((Get-JarvisRoot -Actions @($cimAction) -StartupText '') -eq 'C:\Test folder') 'CIM task actions must support unquoted arguments'
Assert ((New-HiddenWrapper $root 'SYNC_TELEMETRY_AUTO.bat' $true) -match 'sh.Run\(command, 0, True\)') 'Telemetry must wait without displaying a console'
Assert ((New-HiddenWrapper $root 'RUN_JARVIS_TRADER_FOREVER.bat' $false) -match 'sh.Run\(command, 0, False\)') 'Startup wrapper must launch invisibly without waiting forever'

$temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$testRoot=Join-Path $temporary ('JarvisQuietFixTest space-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $testRoot 'src') -Force|Out-Null
$testStartup=Join-Path $testRoot 'Startup'
New-Item -ItemType Directory -Path $testStartup -Force|Out-Null
[IO.File]::WriteAllText((Join-Path $testRoot 'src\main.py'),'# fixture only')
[IO.File]::WriteAllText((Join-Path $testRoot 'SYNC_TELEMETRY_AUTO.bat'),"@echo off`r`necho fixture-ok> `"%~dp0quiet-marker.txt`"`r`n")
[IO.File]::WriteAllText((Join-Path $testRoot '.env'),'UNCHANGED_TEST_MARKER=1')
[IO.File]::WriteAllText((Join-Path $testRoot 'RUN_JARVIS_TRADER_FOREVER.bat'),"@echo off`r`nexit /b 0`r`n")
$legacyStartup=Join-Path $testStartup 'JARVIS_Bybit_Trader_Autostart.cmd'
[IO.File]::WriteAllText($legacyStartup,('start "" /min "'+$testRoot+'\RUN_JARVIS_TRADER_FOREVER.bat"'))
$originalAction=[pscustomobject]@{Execute=(Join-Path $env:WINDIR 'System32\cmd.exe');Arguments=('/c '+(Join-Path $testRoot 'SYNC_TELEMETRY_AUTO.bat'))}
$global:jarvisQuietTestState=@{changes=0;reject=$false;readFailure=$null;verifyFailure=$false;rollbackDenied=$false;updatesSinceReset=0;task=[pscustomobject]@{TaskName='JARVIS_Bybit_Telemetry';TaskPath='\';Actions=@($originalAction)}}
function Get-ScheduledTask {
 param($TaskName,$TaskPath,$ErrorAction)
 if($global:jarvisQuietTestState.readFailure){throw $global:jarvisQuietTestState.readFailure}
 if($global:jarvisQuietTestState.verifyFailure -and $global:jarvisQuietTestState.updatesSinceReset -gt 0){
  return [pscustomobject]@{TaskName='JARVIS_Bybit_Telemetry';TaskPath='\';Actions=@([pscustomobject]@{Execute='fixture-verification-mismatch.exe';Arguments=''})}
 }
 $global:jarvisQuietTestState.task
}
function Export-ScheduledTask {param($TaskName,$TaskPath) '<Task><Triggers>unchanged</Triggers></Task>'}
function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory) [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
function Set-ScheduledTask {
 param($TaskName,$TaskPath,$Action)
 if($global:jarvisQuietTestState.reject){throw 'fixture task denied'}
 if($global:jarvisQuietTestState.rollbackDenied -and $global:jarvisQuietTestState.updatesSinceReset -gt 0){throw 'fixture rollback task denied'}
 $global:jarvisQuietTestState.changes++;$global:jarvisQuietTestState.updatesSinceReset++
 $global:jarvisQuietTestState.task.Actions=@($Action);$global:jarvisQuietTestState.task
}
try{
 $inspect=& $repair -StartupDirectory $testStartup|ConvertFrom-Json
 Assert ($inspect.changes_made -eq $false -and $global:jarvisQuietTestState.changes -eq 0) 'Inspect must not modify the task'
 Assert ($inspect.bot_root -eq $testRoot) 'Full integration must discover an unquoted cmd task without an explicit BotRoot'
 $resultFile=Join-Path $testRoot 'result.json'
 $receipt=& $repair -StartupDirectory $testStartup -ResultFile $resultFile -Apply|ConvertFrom-Json
 Assert ($global:jarvisQuietTestState.changes -eq 1) ('Repair must update the existing task once; calls='+$global:jarvisQuietTestState.changes+'; receipt='+($receipt|ConvertTo-Json -Compress))
 Assert ($global:jarvisQuietTestState.task.Actions[0].Execute -like '*\wscript.exe') 'Task must execute the hidden wrapper'
 Assert ([IO.File]::ReadAllText((Join-Path $testRoot '.env')) -eq 'UNCHANGED_TEST_MARKER=1') 'Trading configuration must remain unchanged'
 Assert ($receipt.bot_restarted -eq $false) 'Repair must not restart the trading bot'
 Assert ($receipt.startup_hidden -eq $true -and !(Test-Path -LiteralPath $legacyStartup)) 'Old startup entry must be migrated'
 Assert (Test-Path -LiteralPath ([IO.Path]::ChangeExtension($legacyStartup,'.vbs'))) 'Hidden startup wrapper must exist'
 Assert (Test-Path -LiteralPath (Join-Path $receipt.backup 'JARVIS_Bybit_Trader_Autostart.cmd')) 'Original startup bytes must be backed up'
 Assert (((Get-Content -LiteralPath $resultFile -Raw|ConvertFrom-Json).bot_root) -eq $testRoot) 'Machine-readable result must retain the exact bot root'
 $wrapper=Join-Path $testRoot 'SYNC_TELEMETRY_HIDDEN.vbs';$old=[IO.File]::ReadAllBytes($wrapper)
 $probe=Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList @('//B','//Nologo',('"'+$wrapper+'"')) -PassThru -WindowStyle Hidden
 if(!$probe.WaitForExit(10000)){$probe.Kill();throw 'Hidden fixture launcher did not exit'}
 Assert (Test-Path -LiteralPath (Join-Path $testRoot 'quiet-marker.txt')) 'The hidden launcher must execute a harmless fixture batch in a path containing spaces'
 # Legacy Windows CMD files can contain an OEM or ANSI encoded Cyrillic path.
 $cyrillicName=-join ([char[]]@(0x421,0x43A,0x43B,0x430,0x434,0x20,0x414,0x436,0x430,0x440,0x432,0x438,0x441))
 $encodingRoot=Join-Path $testRoot $cyrillicName
 New-Item -ItemType Directory -Path (Join-Path $encodingRoot 'src') -Force|Out-Null
 [IO.File]::WriteAllText((Join-Path $encodingRoot 'src\main.py'),'# encoding fixture only')
 [IO.File]::WriteAllText((Join-Path $encodingRoot 'RUN_JARVIS_TRADER_FOREVER.bat'),'@exit /b 0')
 $encodingStartup=Join-Path $testRoot 'encoded-startup.cmd'
 $encodingText='start "" /min "'+$encodingRoot+'\RUN_JARVIS_TRADER_FOREVER.bat"'
 foreach($encoding in @([Text.Encoding]::GetEncoding(866),[Text.Encoding]::GetEncoding(1251),[Text.UTF8Encoding]::new($false),[Text.Encoding]::Unicode)){
  [IO.File]::WriteAllText($encodingStartup,$encodingText,$encoding)
  $detected=Get-JarvisRoot -Actions @() -StartupText (Read-JarvisStartup $encodingStartup)
  Assert ($detected -eq $encodingRoot) ('Startup encoding must retain the installed Cyrillic path: '+$encoding.WebName)
 }
 # Only a genuine task-not-found error may be treated as an absent task.
 $global:jarvisQuietTestState.readFailure=[Management.Automation.ErrorRecord]::new([Exception]::new('fixture missing task'),'CmdletizationQuery_NotFound',[Management.Automation.ErrorCategory]::ObjectNotFound,$null)
 Assert ($null -eq (Get-JarvisTask)) 'Missing task must allow startup discovery'
 $global:jarvisQuietTestState.readFailure=[UnauthorizedAccessException]::new('fixture access denied')
 $readCaught=$false;try{Get-JarvisTask|Out-Null}catch{$readCaught=$_.Exception.Message -like '*fixture access denied*'}
 Assert $readCaught 'Task discovery must propagate access errors'
 $global:jarvisQuietTestState.readFailure=$null
 $global:jarvisQuietTestState.reject=$true;$caught=$false
 try{& $repair -BotRoot $testRoot -StartupDirectory $testStartup -Apply|Out-Null}catch{$caught=$true}
 Assert $caught 'Denied task changes must be reported'
 Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($wrapper)) -eq [Convert]::ToBase64String($old)) 'Task failure must restore the original wrapper'
 # A denied task rollback must still attempt every file restore and report the
 # incomplete recovery, retaining the original failure and backup location.
 $startupVbs=[IO.Path]::ChangeExtension($legacyStartup,'.vbs')
 $priorStartupVbs=[IO.File]::ReadAllBytes($startupVbs)
 [IO.File]::WriteAllText($wrapper,'fixture original telemetry wrapper')
 [IO.File]::WriteAllText($legacyStartup,('start "" /min "'+$testRoot+'\RUN_JARVIS_TRADER_FOREVER.bat"'))
 [IO.File]::WriteAllText($startupVbs,'fixture original startup wrapper')
 $originalFiles=@{};foreach($file in @($wrapper,$legacyStartup,$startupVbs)){$originalFiles[$file]=[Convert]::ToBase64String([IO.File]::ReadAllBytes($file))}
 $global:jarvisQuietTestState.reject=$false;$global:jarvisQuietTestState.updatesSinceReset=0
 $global:jarvisQuietTestState.task.Actions=@($originalAction)
 $global:jarvisQuietTestState.verifyFailure=$true;$global:jarvisQuietTestState.rollbackDenied=$true
 $rollbackResult=Join-Path $testRoot 'rollback-result.json';$rollbackError=$null
 try{& $repair -StartupDirectory $testStartup -ResultFile $rollbackResult -Apply|Out-Null}catch{$rollbackError=$_}
 Assert ($null -ne $rollbackError -and $rollbackError.Exception.Message -like '*Rollback incomplete*') 'An incomplete task rollback must be reported as a failure'
 Assert ($rollbackError.Exception.Message -like '*scheduled-task update did not verify*' -and $rollbackError.Exception.Message -like '*fixture rollback task denied*' -and $rollbackError.Exception.Message.Contains((Join-Path $testRoot '.quiet-launch-backup'))) 'Incomplete rollback must retain the original error, restore error and backup path'
 foreach($file in @($wrapper,$legacyStartup,$startupVbs)){
  Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) -eq $originalFiles[$file]) ('A denied task restore must not prevent file restoration: '+$file)
 }
 Assert ($global:jarvisQuietTestState.task.Actions[0].Execute -like '*\wscript.exe') 'Only the fake task must remain changed when its rollback is denied'
 Assert (!(Test-Path -LiteralPath $rollbackResult)) 'An incomplete rollback must not produce a success receipt'
 Assert ([IO.File]::ReadAllText((Join-Path $testRoot '.env')) -eq 'UNCHANGED_TEST_MARKER=1') 'Incomplete rollback must not touch trading configuration'
 $global:jarvisQuietTestState.verifyFailure=$false;$global:jarvisQuietTestState.rollbackDenied=$false
 [IO.File]::WriteAllBytes($wrapper,$old);[IO.File]::WriteAllBytes($startupVbs,$priorStartupVbs)
 Remove-Item -LiteralPath $legacyStartup
 $global:jarvisQuietTestState.reject=$false;$global:jarvisQuietTestState.task=$null
 $hiddenOnly=& $repair -StartupDirectory $testStartup -Apply|ConvertFrom-Json
 Assert ($hiddenOnly.startup_hidden -and !$hiddenOnly.telemetry_hidden -and $hiddenOnly.bot_root -eq $testRoot) 'Reapplying a startup-only hidden launcher must succeed without a task or legacy CMD'
 Write-Output 'PASS: WinPS/CIM discovery, quoted/unquoted cmd and wscript on both drives, relative/environment paths, no-BotRoot integration, OEM/ANSI/UTF8/UTF16 Cyrillic startup, access errors, startup-only reapply, actual WScript fixture launch, configuration preservation, no bot restart, normal rollback and denied task rollback with every file restored'
}catch{
 Write-Output ('FIXTURE TEST FAILURE: '+($_|Out-String));throw
}finally{
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($testRoot)) -ne $temporary){throw 'Invalid cleanup target'}
 Remove-Item -LiteralPath $testRoot -Recurse -Force
 Remove-Variable -Name jarvisQuietTestState -Scope Global -ErrorAction SilentlyContinue
}
