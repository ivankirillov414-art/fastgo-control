$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true'){throw 'This installation test requires a disposable CI runner.'}
$probeDir=Join-Path $env:RUNNER_TEMP 'fastgo-pc365-driver-test'
node -e "require('./warehouse-desktop/pc365-setup.cjs').materialize(process.argv[1])" $probeDir
$signature=Get-AuthenticodeSignature -LiteralPath (Join-Path $probeDir 'driver/4barcode.cat')
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne '0ECA937423F01F974CA582BCFC417550BE20B95E'){throw 'Unexpected PC365 publisher'}
$publisher=Join-Path $probeDir 'ci-approved-publisher.cer'
[IO.File]::WriteAllBytes($publisher,$signature.SignerCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
$null=Import-Certificate -FilePath $publisher -CertStoreLocation Cert:\LocalMachine\TrustedPublisher
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PSScriptRoot/../pc365-setup.ps1" -Directory $probeDir -Stage
if($LASTEXITCODE -ne 0){throw 'PC365 signed driver stage failed'}
if(!(Get-PrinterDriver -Name '4BARCODE 3B-365B' -ErrorAction Stop)){throw 'PC365 driver missing from the spooler'}
Write-Output 'PASS: exact PC365 hardware driver is signed and registers through Windows native tools'
