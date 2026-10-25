[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ResultFile,[switch]$Apply,[string]$StartupDirectory)
$ErrorActionPreference='Stop'

function Write-RepairResult($Value){
 [IO.File]::WriteAllText($ResultFile,($Value|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
}
function Get-RepairError($Failure){
 $exception=$Failure.Exception
 $permission=($Failure.CategoryInfo.Category -eq [Management.Automation.ErrorCategory]::PermissionDenied)
 $hresult=''
 for($current=$exception;$null -ne $current;$current=$current.InnerException){
  $code=[BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$current.HResult),0)
  if(!$hresult){$hresult=('0x{0:X8}' -f $code)}
  if($current -is [UnauthorizedAccessException] -or $code -eq 2147942405){$permission=$true}
 }
 $message=[string]$exception.Message
 $fqid=[string]$Failure.FullyQualifiedErrorId
 if($fqid -match '(?i)80070005' -or $message -match '(?i)0x80070005'){$permission=$true}
 $errorCode=if($message -match 'Rollback incomplete'){'rollback_incomplete'}elseif($permission){'requires_admin'}elseif($message -match 'No JARVIS|JARVIS task/startup was not found'){'not_found'}elseif($message -match 'Windows Script Host'){'script_host_unavailable'}elseif($message -match 'does not contain|launcher is missing|watchdog is missing'){'installation_incomplete'}elseif($message -match 'did not verify'){'verification_failed'}else{'repair_failed'}
 [ordered]@{status='error';error_code=$errorCode;message=$message;exception_type=$exception.GetType().FullName;hresult=$hresult;fully_qualified_error_id=$fqid;category=[string]$Failure.CategoryInfo.Category;script_line=$Failure.InvocationInfo.ScriptLineNumber}
}
try{
 $repair=Join-Path $PSScriptRoot 'FIX_JARVIS_CONSOLE.ps1'
 $parameters=@{ResultFile=$ResultFile}
 if($Apply){$parameters.Apply=$true}
 if($StartupDirectory){$parameters.StartupDirectory=$StartupDirectory}
 & $repair @parameters | Out-Null
 if(!(Test-Path -LiteralPath $ResultFile -PathType Leaf)){throw 'JARVIS repair did not produce a result file.'}
 $receipt=[IO.File]::ReadAllText($ResultFile,[Text.Encoding]::UTF8)|ConvertFrom-Json
 $receipt|Add-Member -NotePropertyName status -NotePropertyValue 'ok' -Force
 Write-RepairResult $receipt
 exit 0
}catch{
 try{Write-RepairResult (Get-RepairError $_)}catch{}
 exit 1
}
