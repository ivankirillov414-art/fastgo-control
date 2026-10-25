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
$originalAction=[pscustomobject]@{Execute=(Join-Path $testRoot 'SYNC_TELEMETRY_AUTO.bat');Arguments=''}
$global:jarvisQuietTestState=@{changes=0;reject=$false;task=[pscustomobject]@{TaskName='JARVIS_Bybit_Telemetry';TaskPath='\';Actions=@($originalAction)}}
function Get-ScheduledTask {param($TaskName,$TaskPath,$ErrorAction) $global:jarvisQuietTestState.task}
function Export-ScheduledTask {param($TaskName,$TaskPath) '<Task><Triggers>unchanged</Triggers></Task>'}
function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory) [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
function Set-ScheduledTask {param($TaskName,$TaskPath,$Action) if($global:jarvisQuietTestState.reject){throw 'fixture task denied'};$global:jarvisQuietTestState.changes++;$global:jarvisQuietTestState.task.Actions=@($Action);$global:jarvisQuietTestState.task}
try{
 $inspect=& $repair -BotRoot $testRoot -StartupDirectory $testStartup|ConvertFrom-Json
 Assert ($inspect.changes_made -eq $false -and $global:jarvisQuietTestState.changes -eq 0) 'Inspect must not modify the task'
 $resultFile=Join-Path $testRoot 'result.json'
 $receipt=& $repair -BotRoot $testRoot -StartupDirectory $testStartup -ResultFile $resultFile -Apply|ConvertFrom-Json
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
 $global:jarvisQuietTestState.reject=$true;$caught=$false
 try{& $repair -BotRoot $testRoot -StartupDirectory $testStartup -Apply|Out-Null}catch{$caught=$true}
 Assert $caught 'Denied task changes must be reported'
 Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($wrapper)) -eq [Convert]::ToBase64String($old)) 'Task failure must restore the original wrapper'
 Write-Output 'PASS: task/startup discovery, actual WScript hidden launch with spaces, inspection without changes, same-task migration, configuration preservation, no bot restart, rollback on failure'
}finally{
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($testRoot)) -ne $temporary){throw 'Invalid cleanup target'}
 Remove-Item -LiteralPath $testRoot -Recurse -Force
 Remove-Variable -Name jarvisQuietTestState -Scope Global -ErrorAction SilentlyContinue
}
