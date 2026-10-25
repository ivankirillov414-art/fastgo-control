# Runs on a disposable GitHub Windows runner, never on a user's laptop.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true'){throw 'This driver installation test requires a disposable CI runner.'}
$probeDir=Join-Path $env:RUNNER_TEMP 'fastgo-p2-driver-test'
$probeOutput=& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PSScriptRoot/../label-printer-setup.ps1" -Directory $probeDir -Install
if($LASTEXITCODE -ne 0){throw 'P2 helper failed'}
$result=$probeOutput | ConvertFrom-Json
if($result.status -notin @('ready','driver_installed')){throw ('Official P2 silent installation failed: '+$probeOutput)}
if(!(Get-PrinterDriver -Name 'P2 Label Printer' -ErrorAction Stop)){throw 'The Windows spooler did not register the P2 driver'}
$result | ConvertTo-Json | Write-Output
Write-Output 'PASS: the pinned official P2 installer registers its actual Windows driver in silent mode'
