$ErrorActionPreference = 'Stop'
$version = (Get-Content "$PSScriptRoot/../package.json" | ConvertFrom-Json).version
$installer = (Resolve-Path "$PSScriptRoot/../dist/FastGo-Setup-$version-Windows-x64.exe").Path
$installDir = Join-Path $env:RUNNER_TEMP ('FastGo-install-test-' + [guid]::NewGuid().ToString('N'))
$appData = Join-Path $env:APPDATA 'FastGo'
$marker = Join-Path $appData 'update-test-marker.txt'
New-Item -ItemType Directory -Path $appData -Force | Out-Null
Set-Content -Path $marker -Value 'Preserve existing application data'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FastGoInstallerUI {
 public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr param);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hwnd, EnumProc callback, IntPtr param);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder text, int count);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
 public static int FindProgress() {
  int position=-1;
  EnumWindows((window,param)=>{
   var title=new StringBuilder(512);GetWindowText(window,title,512);
   if(!IsWindowVisible(window)||title.ToString()!="Обновление FastGo")return true;
   EnumChildWindows(window,(child,p)=>{
    var name=new StringBuilder(128);GetClassName(child,name,128);
    if(name.ToString()=="msctls_progress32" && IsWindowVisible(child))position=SendMessage(child,0x0408,IntPtr.Zero,IntPtr.Zero).ToInt32();
    return true;
   },IntPtr.Zero);return true;
  },IntPtr.Zero);return position;
 }
}
'@
try {
 $first = Start-Process -FilePath $installer -ArgumentList @('/S','/currentuser',"/D=$installDir") -PassThru
 if (!$first.WaitForExit(120000)) { throw 'Initial test installation timed out' }
 if ($first.ExitCode -ne 0) { throw "Initial installer failed: $($first.ExitCode)" }
 $exe = Join-Path $installDir 'FastGo.exe'
 if (!(Test-Path $exe)) { throw 'Initial installer did not create FastGo.exe' }
 # Exercise the exact command used by older apps: /S is upgraded to visible progress,
 # while user/directory/finish pages are skipped and the new app starts itself.
 $update = Start-Process -FilePath $installer -ArgumentList @('/S','--updated','--force-run','/currentuser',"/D=$installDir") -PassThru
 $deadline = (Get-Date).AddSeconds(120);$seenProgress = $false
 while (!$update.HasExited -and (Get-Date) -lt $deadline) {
  if ([FastGoInstallerUI]::FindProgress() -ge 0) { $seenProgress = $true }
  Start-Sleep -Milliseconds 50
  $update.Refresh()
 }
 if (!$update.HasExited) { throw 'Update did not finish without user interaction' }
 $update.WaitForExit()
 if ($update.ExitCode -ne 0) { throw "Update installer failed: $($update.ExitCode)" }
 if (!$seenProgress) { throw 'No visible native installation progress bar was observed' }
 $deadline = (Get-Date).AddSeconds(30);$restarted = $false
 while ((Get-Date) -lt $deadline) {
  $processes = @(Get-CimInstance Win32_Process -Filter "Name='FastGo.exe'" | Where-Object { $_.ExecutablePath -eq $exe -and $_.CommandLine -match '--updated' })
  if ($processes.Count -gt 0) { $restarted = $true;break }
  Start-Sleep -Milliseconds 250
 }
 if (!$restarted) { throw 'FastGo did not restart automatically after installation' }
 if ((Get-Content $marker).Trim() -ne 'Preserve existing application data') { throw 'Existing app data was changed' }
 Write-Output 'PASS: real installer progress, no wizard clicks, automatic relaunch, preserved app data'
} finally {
 Get-CimInstance Win32_Process -Filter "Name='FastGo.exe'" | Where-Object { $_.ExecutablePath -like "$installDir*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
 $uninstaller = Join-Path $installDir 'Uninstall FastGo.exe'
 if (Test-Path $uninstaller) { $cleanup=Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru;$cleanup.WaitForExit(30000) | Out-Null }
 Remove-Item $marker -ErrorAction SilentlyContinue
}
