param([Parameter(Mandatory=$true)][ValidateSet('phone','tsd','tsd-tests','tsd-fixture','tsd-self-tests')][string]$App,[Parameter(Mandatory=$true)][string]$UnsignedPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$workspace=(Get-Location).Path;$scratch=Join-Path $workspace 'warehouse-android\phone\build\backup-release-local'
$targets=@{phone=(Join-Path $workspace 'warehouse-android\phone\release\FastGo-Android-1.0.17.apk');tsd=(Join-Path $workspace 'warehouse\native\FastGo-TSD-2.1.10.apk');'tsd-tests'=(Join-Path $workspace 'warehouse-android\native\release\FastGo-TSD-2.1.10-upgrade-tests.apk');'tsd-fixture'=(Join-Path $workspace 'warehouse-android\native\release\FastGo-TSD-2.1.10-self-update-fixture14.apk');'tsd-self-tests'=(Join-Path $workspace 'warehouse-android\native\release\FastGo-TSD-2.1.10-self-update-tests.apk')}
$certificates=@{phone='26f79b6746e6b6a93e5f4a8d6630cffb65332669e2c555b36e38f40a4f0ec1f3';tsd='72817ae5c97c8c60255ca3c029d4ecdd171ec0c33bc28a640e8c7ab0bdb637dd';'tsd-tests'='72817ae5c97c8c60255ca3c029d4ecdd171ec0c33bc28a640e8c7ab0bdb637dd'}
$certificates['tsd-fixture']=$certificates.tsd;$certificates['tsd-self-tests']=$certificates.tsd
$utility=Join-Path $env:USERPROFILE 'Documents\Codex\2026-10-19\new-chat\outputs\android-build-tools35\apksigner.jar'
if(-not(Test-Path -LiteralPath $utility)){throw 'Existing small apksigner utility unavailable; no SDK download is permitted'}
$inputFile=[IO.Path]::GetFullPath((Join-Path $workspace $UnsignedPath));if(-not $inputFile.StartsWith($scratch+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsigned file must be in owned candidate scratch'}
$target=$targets[$App];$partial=Join-Path $scratch ($App+'-signed.partial.apk');if((Test-Path -LiteralPath $target)-or(Test-Path -LiteralPath $partial)){throw 'Candidate output already exists; review it before signing again'}
function Usage{$used=0L;if(Test-Path -LiteralPath $scratch){$used+=[long](Get-ChildItem -LiteralPath $scratch -Recurse -File|Measure-Object Length -Sum).Sum};foreach($p in $targets.Values){if(Test-Path -LiteralPath $p){$used+=(Get-Item -LiteralPath $p).Length}};return $used}
$inputBytes=(Get-Item -LiteralPath $inputFile).Length;$maximumOutput=$inputBytes+131072;$before=Usage;$freeBefore=(Get-PSDrive C).Free
if($before+$maximumOutput -gt 64MB -or $freeBefore-$maximumOutput -lt 1GB){throw 'Signing would violate 64 MiB temporary budget or 1 GiB free-space floor'}
if(Test-Path Env:FASTGO_BACKUP_SIGN_PASSWORD){throw 'Task signing environment is already occupied'}
$plain=$null;$password=$null;$config=$null;$keystore=$null
try{
 if($App -eq 'phone'){$dir=Join-Path $env:USERPROFILE 'Documents\Codex\2026-10-27\new-chat\work\private-mobile-signing';$config=[IO.File]::ReadAllText((Join-Path $dir 'signing.json'))|ConvertFrom-Json;$password=$config.password;$keystore=Join-Path $dir 'fastgo-mobile.p12'}
 else{$dir=Join-Path $env:APPDATA 'FastGo\release-signing';$plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $dir 'password.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);$password=[Text.Encoding]::UTF8.GetString($plain);$keystore=Join-Path $dir 'FastGo-TSD-managed.p12'}
 if(-not $password){throw 'Existing protected signing password unavailable'}
 # No password in argv, stdout, files or repository; child process reads only
 # this transient environment value. Existing keystore is used in place.
 $env:FASTGO_BACKUP_SIGN_PASSWORD=$password
 & java -jar $utility sign --ks $keystore --ks-type PKCS12 --ks-pass env:FASTGO_BACKUP_SIGN_PASSWORD --key-pass env:FASTGO_BACKUP_SIGN_PASSWORD --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --min-sdk-version 23 --out $partial $inputFile
 if($LASTEXITCODE -ne 0){throw 'Existing-key APK signing failed'}
 Remove-Item Env:FASTGO_BACKUP_SIGN_PASSWORD
 if((Usage) -gt 64MB -or (Get-PSDrive C).Free -lt 1GB){throw 'Candidate storage bound was exceeded'}
 $verification=& java -jar $utility verify --verbose --print-certs $partial 2>&1
 if($LASTEXITCODE -ne 0){throw 'Signed APK verification failed'}
 $verifyText=$verification -join "`n";$match=[regex]::Match($verifyText,'certificate SHA-256 digest: ([a-f0-9]{64})');if(-not $match.Success -or $match.Groups[1].Value -ne $certificates[$App]){throw 'Candidate signer differs from the published application'}
 if($verifyText -notmatch 'Verified using v2 scheme.*true'){throw 'APK v2 signature is required'}
 $python=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
 if(-not(Test-Path -LiteralPath $python)){throw 'Approved local Python runtime unavailable'}
 $identityText=& $python scripts/check-phone-apk-identity.py $inputFile $partial
 if($LASTEXITCODE -ne 0){throw 'Signing changed unsigned APK contents'}
 $identity=$identityText -join "`n"|ConvertFrom-Json;if(-not $identity.all_apk_content_matches_source){throw 'Candidate source identity failed'}
 $unsignedSha=(Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash.ToLowerInvariant();$signedSha=(Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant();$peak=Usage
 New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target)|Out-Null
 [IO.File]::Move($partial,$target)
 Remove-Item -LiteralPath $inputFile -Force
 [pscustomobject]@{app=$App;file=$target;bytes=(Get-Item -LiteralPath $target).Length;sha256=$signedSha;unsigned_sha256=$unsignedSha;certificate_sha256=$match.Groups[1].Value;signature_verified=$true;all_apk_content_matches_source=$true;compared_entries=$identity.compared_entries;temporary_peak_bytes=$peak;temporary_bytes_after=Usage;free_before_bytes=$freeBefore;free_after_bytes=(Get-PSDrive C).Free;utility_downloaded=$false;secrets_written_or_printed=$false}|ConvertTo-Json
}finally{if(Test-Path Env:FASTGO_BACKUP_SIGN_PASSWORD){Remove-Item Env:FASTGO_BACKUP_SIGN_PASSWORD};if($plain){[Array]::Clear($plain,0,$plain.Length)};$password=$null;$config=$null;if(Test-Path -LiteralPath $partial){Remove-Item -LiteralPath $partial -Force}}
