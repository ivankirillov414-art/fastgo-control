$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP) { throw 'Run this installation check only on the isolated Windows CI runner' }
$temporaryRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
$installDir = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ('warehouse-upgrade-' + [guid]::NewGuid().ToString('N'))))
if (!$installDir.StartsWith($temporaryRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid CI installation folder' }
$pkg = Get-Content "$PSScriptRoot/../package.json" -Raw | ConvertFrom-Json
$newInstaller = (Resolve-Path "$PSScriptRoot/../dist/FastGo-Warehouse-Setup-$($pkg.version)-Windows-x64.exe").Path
$oldInstaller = Join-Path $temporaryRoot 'FastGo-Warehouse-Setup-1.0.18-Windows-x64.exe'
Invoke-WebRequest 'https://github.com/ivankirillov414-art/fastgo-control/releases/download/fastgo-warehouse-v1.0.18/FastGo-Warehouse-Setup-1.0.18-Windows-x64.exe' -OutFile $oldInstaller
if ((Get-FileHash -LiteralPath $oldInstaller -Algorithm SHA256).Hash.ToLowerInvariant() -ne '2c903cae9d8910ba3be3dd47e055e2e8b4092c58efaa22592167c07bf1d54a1b') { throw 'The legacy installer checksum does not match' }
function Install-TestPackage([string]$file,[string[]]$arguments) {
 $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru -WindowStyle Hidden
 if (!$process.WaitForExit(180000)) { throw 'CI test installation timed out' }
 if ($process.ExitCode -ne 0) { throw "CI test installation failed: $($process.ExitCode)" }
}
Install-TestPackage $oldInstaller @('/S','/currentuser',"/D=$installDir")
function Find-TestInstallation {
 foreach ($softwareRoot in @('HKCU:\Software','HKCU:\Software\WOW6432Node','HKLM:\Software','HKLM:\Software\WOW6432Node')) {
  foreach ($entry in @(Get-ItemProperty -Path "$softwareRoot\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'FastGo*' })) {
   # Older electron-builder installers keep the location under Software\<app GUID>.
   $location = $entry.InstallLocation
   if (!$location) { $location = (Get-ItemProperty -LiteralPath "$softwareRoot\$($entry.PSChildName)" -ErrorAction SilentlyContinue).InstallLocation }
   if ($location -and $location.TrimEnd('\') -eq $installDir) { $entry }
  }
 }
}
$before = @(Find-TestInstallation | Sort-Object -Property PSPath -Unique)
if ($before.Count -ne 1) { throw 'Legacy warehouse must have exactly one installation entry' }
$exe = Join-Path $installDir ($pkg.build.executableName + '.exe')
if (!(Test-Path -LiteralPath $exe)) { throw 'Executable name changed; existing Windows startup would break' }
$appData = Join-Path $env:APPDATA 'FastGo Склад'
New-Item -ItemType Directory -Path $appData -Force | Out-Null
$marker = Join-Path $appData 'ci-keep-documents.txt'
[IO.File]::WriteAllText($marker,'Keep drafts, settings and login')
# Let NSIS discover the installed folder, exactly as an automatic update does.
Install-TestPackage $newInstaller @('/S','/currentuser','--updated')
$after = @(Find-TestInstallation | Sort-Object -Property PSPath -Unique)
if ($after.Count -ne 1 -or $after[0].PSPath -ne $before[0].PSPath) { throw 'Upgrade created a second application instead of updating the existing entry' }
$expectedDisplayName = "FastGo Склад $($pkg.version)"
if ($after[0].DisplayName -ne $expectedDisplayName -or $after[0].DisplayVersion -ne $pkg.version) { throw "Installed application name or version is incorrect: $($after[0].DisplayName), $($after[0].DisplayVersion)" }
Write-Output "Verified installed display name: $($after[0].DisplayName)"
if (!$after[0].InstallLocation -or $after[0].InstallLocation.TrimEnd('\') -ne $installDir) { throw 'Background updater cannot discover the installed warehouse' }
if ([IO.File]::ReadAllText($marker) -ne 'Keep drafts, settings and login') { throw 'Upgrade changed existing application data' }
if (!(Test-Path -LiteralPath $exe)) { throw 'Upgrade broke the existing executable path' }
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = Join-Path $desktop 'FastGo Склад.lnk'
if (!(Test-Path -LiteralPath $shortcut)) { throw 'The corrected desktop shortcut was not created' }
$wsh = New-Object -ComObject WScript.Shell
$shortcutTarget = $wsh.CreateShortcut($shortcut).TargetPath
Write-Output "Shortcut target: $shortcutTarget; expected installed executable: $exe"
# Verify actual Windows shell activation, including links WScript cannot resolve.
try {
 Start-Process -FilePath $shortcut -WindowStyle Hidden
 $deadline = (Get-Date).AddSeconds(20)
 $launched = $false
 while ((Get-Date) -lt $deadline) {
  $started = @(Get-CimInstance Win32_Process -Filter "Name like 'FastGo%'" | Where-Object { $_.ExecutablePath -eq $exe })
  if ($started.Count) { $launched = $true; break }
  Start-Sleep -Milliseconds 300
 }
 if (!$launched) { throw 'The corrected shortcut did not launch the installed warehouse executable' }
} finally {
 # The installation directory was checked against RUNNER_TEMP above.
 Get-CimInstance Win32_Process -Filter "Name like 'FastGo%'" | Where-Object { $_.ExecutablePath -eq $exe } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
@{version=$pkg.version;display_name=$after[0].DisplayName;existing_installation_updated=$true;executable_path_preserved=$true;app_data_preserved=$true;shortcut_verified=$true;background_discovery_verified=$true} | ConvertTo-Json | Set-Content -Encoding utf8 "$PSScriptRoot/../dist/warehouse-upgrade-verification.json"
Write-Output 'PASS: real legacy warehouse installer upgrades in place; corrected Russian name and shortcut, one installation entry, preserved executable path and app data'
