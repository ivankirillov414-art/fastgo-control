$ErrorActionPreference='Stop'
$temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$testRoot=Join-Path $temporary ('FastGo Jarvis transport-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot|Out-Null
$wrapper=Join-Path $testRoot 'Invoke-JarvisRepair.ps1'
$fixture=Join-Path $testRoot 'FIX_JARVIS_CONSOLE.ps1'
$result=Join-Path $testRoot 'result.json'
$powershell=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Invoke-JarvisRepair.ps1') -Destination $wrapper
$checks=0
function Assert($condition,$name){if(!$condition){throw $name};$script:checks++;Write-Output ('PASS: '+$name)}
function Run-Fixture([string]$Body){
 [IO.File]::WriteAllText($fixture,('param([string]$ResultFile,[switch]$Apply,[string]$StartupDirectory)'+[Environment]::NewLine+$Body),[Text.UTF8Encoding]::new($true))
 if(Test-Path -LiteralPath $result){Remove-Item -LiteralPath $result}
 $start=[Diagnostics.ProcessStartInfo]::new($powershell,('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$wrapper+'" -ResultFile "'+$result+'" -Apply'))
 $start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $process=[Diagnostics.Process]::Start($start)
 $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
 if(!$process.WaitForExit(20000)){$process.Kill();throw 'Fixture child process timed out'}
 $stdout.GetAwaiter().GetResult()|Out-Null;$stderr.GetAwaiter().GetResult()|Out-Null
 $script:lastExitCode=$process.ExitCode;$process.Dispose()
 if(!(Test-Path -LiteralPath $result)){throw 'Missing UTF8 result from hidden child'}
 [IO.File]::ReadAllText($result,[Text.Encoding]::UTF8)|ConvertFrom-Json
}
try{
 $actual=Run-Fixture "throw [UnauthorizedAccessException]::new('Отказано в доступе к задаче')"
 Assert ($actual.error_code -eq 'requires_admin' -and $lastExitCode -ne 0) 'Typed access-denied survives hidden redirected PowerShell'
 Assert ($actual.message -eq 'Отказано в доступе к задаче') 'Cyrillic error text survives file transport exactly'
 Assert ($actual.hresult -eq '0x80070005') 'Native permission HRESULT is retained'
 $actual=Run-Fixture "throw 'No JARVIS scheduled task or legacy startup entry found. No changes made.'"
 Assert ($actual.error_code -eq 'not_found') 'Missing bot is distinguished from permission failure'
 $actual=Run-Fixture "throw 'Папка C:\Касса\Джарвис отсутствует'"
 Assert ($actual.error_code -eq 'repair_failed' -and $actual.message -eq 'Папка C:\Касса\Джарвис отсутствует') 'Detailed unknown failures remain readable'
 $actual=Run-Fixture "throw 'Rollback incomplete. Task returned 0x80070005. Backup: C:\backup'"
 Assert ($actual.error_code -eq 'rollback_incomplete') 'Incomplete rollback is never retried as a fresh permission request'
 $body='[IO.File]::WriteAllText($ResultFile,''{"bot_root":"C:\\Касса\\Джарвис","bot_restarted":false,"trading_configuration_changed":false,"backup":"C:\\Касса\\backup"}'',[Text.UTF8Encoding]::new($false))'
 $actual=Run-Fixture $body
 Assert ($actual.status -eq 'ok' -and $lastExitCode -eq 0 -and $actual.bot_root -eq 'C:\Касса\Джарвис') 'Successful hidden child returns an exact UTF8 receipt'
 $actual=Run-Fixture 'Write-Output "no receipt"'
 Assert ($actual.status -eq 'error' -and $lastExitCode -ne 0) 'Missing receipt never reports success'
 Write-Output ('ALL '+$checks+' TRANSPORT CHECKS PASSED')
}finally{
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($testRoot)) -ne $temporary){throw 'Invalid transport cleanup target'}
 Remove-Item -LiteralPath $testRoot -Recurse -Force
}
