# Runs on a disposable GitHub Windows runner, never on a user's laptop.
$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true'){throw 'This driver installation test requires a disposable CI runner.'}
$probeDir=Join-Path $env:RUNNER_TEMP 'fastgo-p2-driver-test'
node -e "require('./warehouse-desktop/label-printer-setup.cjs').materialize(process.argv[1])" $probeDir
# The disposable runner models Windows' explicit approval of this pinned publisher.
# This test-only certificate import is never shipped to or run on user devices.
$catalogSignature=Get-AuthenticodeSignature -LiteralPath (Join-Path $probeDir 'driver/P2.cat')
if($catalogSignature.Status -ne 'Valid' -or $catalogSignature.SignerCertificate.Thumbprint -ne '52DE7654F62FB78407724FB3E1A76FB4DF0F3E58'){throw 'Unexpected P2 publisher'}
$publisherFile=Join-Path $probeDir 'ci-approved-publisher.cer'
[IO.File]::WriteAllBytes($publisherFile,$catalogSignature.SignerCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
$null=Import-Certificate -FilePath $publisherFile -CertStoreLocation Cert:\LocalMachine\TrustedPublisher
$probeOutput=& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PSScriptRoot/../label-printer-setup.ps1" -Directory $probeDir -Install
if($LASTEXITCODE -ne 0){throw 'P2 helper failed'}
$result=$probeOutput | ConvertFrom-Json
if($result.status -notin @('ready','driver_installed')){throw ('Official P2 silent installation failed: '+$probeOutput)}
if(!(Get-PrinterDriver -Name 'P2 Label Printer' -ErrorAction Stop)){throw 'The Windows spooler did not register the P2 driver'}
$result | ConvertTo-Json | Write-Output
Write-Output 'PASS: the signed P2 INF registers its actual Windows driver through native Windows tools'
