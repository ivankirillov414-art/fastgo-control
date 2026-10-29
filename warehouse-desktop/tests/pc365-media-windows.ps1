param([string]$Helper=(Join-Path $PSScriptRoot '../pc365-media.ps1'))
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'public static class FastGoPC365Media { public static string Last;public static int Calls;public static int Send(string name,byte[] data){Last=System.Text.Encoding.ASCII.GetString(data);Calls++;return 17;} }'
$global:MediaQueue=@([pscustomobject]@{Name='4BARCODE 3B-365B';DriverName='4BARCODE 3B-365B'})
$global:MediaJobs=@()
function global:Get-Printer { return $global:MediaQueue }
function global:Get-PrintJob { param([string]$PrinterName) return $global:MediaJobs }
function global:Add-Type { param([string]$TypeDefinition) $global:MediaType=$TypeDefinition }
$r=(& $Helper -PrinterName '4BARCODE 3B-365B' -WidthMm 58 -HeightMm 27) | ConvertFrom-Json
if($r.status -ne 'submitted' -or $r.job_id -ne 17){throw 'Valid media command was not submitted'}
if([FastGoPC365Media]::Last -cne "SIZE 58.0 mm,27.0 mm`r`nGAPDETECT`r`nREFERENCE 0,0`r`nOFFSET 0 mm`r`n"){throw 'Wrong media frame'}
if([FastGoPC365Media]::Last -match 'PRINT|INITIALIZE|KILL|RESET'){throw 'Unexpected print or reset command'}
# Compile the actual P/Invoke implementation without opening a printer.
Microsoft.PowerShell.Utility\Add-Type -TypeDefinition ($global:MediaType.Replace('class FastGoPC365Media','class FastGoPC365MediaSyntax'))
$global:MediaJobs=@([pscustomobject]@{JobStatus='Printing'})
$r=(& $Helper -PrinterName '4BARCODE 3B-365B' -WidthMm 58 -HeightMm 27) | ConvertFrom-Json
if($r.status -ne 'error' -or [FastGoPC365Media]::Calls -ne 1){throw 'Busy queue received a media command'}
$global:MediaJobs=@();$global:MediaQueue[0].DriverName='Laser'
$r=(& $Helper -PrinterName '4BARCODE 3B-365B' -WidthMm 58 -HeightMm 27) | ConvertFrom-Json
if($r.status -ne 'error' -or [FastGoPC365Media]::Calls -ne 1){throw 'Unrelated driver received a command'}
$r=(& $Helper -PrinterName 'P2 Label Printer' -WidthMm 58 -HeightMm 27) | ConvertFrom-Json
if($r.status -ne 'error' -or [FastGoPC365Media]::Calls -ne 1){throw 'P2 received a media command'}
Write-Output 'PASS: PowerShell media frame, C# Winspool compilation, busy queue and driver isolation; no hardware accessed'
exit 0
