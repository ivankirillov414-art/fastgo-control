param([Parameter(Mandatory=$true)][string]$PrinterName,[double]$WidthMm,[double]$HeightMm,[ValidateSet('Calibrate','Print')][string]$Mode='Calibrate',[string]$DataFile)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$mayHaveSubmitted=$false
try {
 if($PrinterName -notmatch '^(POScenter PC[- ]?365|4BARCODE 3B-365B)$' -or [double]::IsNaN($WidthMm) -or [double]::IsNaN($HeightMm) -or $WidthMm -lt 30 -or $WidthMm -gt 110 -or $HeightMm -lt 20 -or $HeightMm -gt 200){throw 'Invalid PC-365 media profile'}
 $queue=@(Get-Printer -ErrorAction Stop | Where-Object {$_.Name -ceq $PrinterName})
 if($queue.Count -ne 1 -or $queue[0].DriverName -notmatch '^(4BARCODE 3B-365B|POScenter PC[- ]?365)$'){throw 'Selected queue is not a PC-365'}
 if($Mode -eq 'Calibrate' -and @(Get-PrintJob -PrinterName $PrinterName -ErrorAction Stop).Count -gt 0){throw 'Дождитесь завершения заданий принтера и повторите выравнивание.'}
 $media=@{paper='unknown';widthMm=$null;heightMm=$null;sensor='unknown'}
 try {
  $config=Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop;$media.paper=[string]$config.PaperSize
  [xml]$ticket=$config.PrintTicketXML
  foreach($property in $ticket.SelectNodes("//*[local-name()='ScoredProperty']")){$key=([string]$property.GetAttribute('name')).Split(':')[-1];$value=$property.SelectSingleNode("*[local-name()='Value']");if($key -in @('MediaSizeWidth','MediaSizeHeight') -and $value.InnerText -match '^\d+$'){if($key -eq 'MediaSizeWidth'){$media.widthMm=[math]::Round(([double]$value.InnerText)/1000,2)}else{$media.heightMm=[math]::Round(([double]$value.InnerText)/1000,2)}}}
  foreach($feature in $ticket.SelectNodes("//*[local-name()='Feature']")){$key=([string]$feature.GetAttribute('name')).Split(':')[-1];if($key -match 'MediaType|MediaTracking|Sensor'){$option=$feature.SelectSingleNode("*[local-name()='Option']");$name=([string]$option.GetAttribute('name')).Split(':')[-1];if($name -match '^[a-zA-Z0-9_.-]{1,64}$'){$media.sensor=$name;break}}}
 }catch{}
 Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class FastGoPC365Media {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public class Doc { public string name="FastGo PC-365 media alignment";public string output=null;public string type="RAW"; }
 [DllImport("winspool.drv",EntryPoint="OpenPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool OpenPrinter(string name,out IntPtr handle,IntPtr defaults);
 [DllImport("winspool.drv",EntryPoint="StartDocPrinterW",CharSet=CharSet.Unicode,SetLastError=true)] static extern int StartDocPrinter(IntPtr handle,int level,[In]Doc doc);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool WritePrinter(IntPtr handle,byte[] data,int size,out int written);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
 [DllImport("winspool.drv",SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
 [DllImport("winspool.drv")] static extern bool AbortPrinter(IntPtr handle);
 [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr handle);
 static void Check(bool ok) { if(!ok)throw new Win32Exception(Marshal.GetLastWin32Error()); }
 public static int Send(string name,byte[] data) {
  IntPtr handle;Check(OpenPrinter(name,out handle,IntPtr.Zero));bool done=false,started=false;
  try {int job=StartDocPrinter(handle,1,new Doc());Check(job>0);started=true;Check(StartPagePrinter(handle));int written;Check(WritePrinter(handle,data,data.Length,out written));if(written!=data.Length)throw new Exception("Incomplete media command");Check(EndPagePrinter(handle));Check(EndDocPrinter(handle));done=true;return job;}
  finally {if(started&&!done)AbortPrinter(handle);ClosePrinter(handle);}
 }
}
'@
 $w=$WidthMm.ToString('0.0',[Globalization.CultureInfo]::InvariantCulture);$h=$HeightMm.ToString('0.0',[Globalization.CultureInfo]::InvariantCulture)
 # Detect the actual gap instead of guessing its length or using continuous feed.
 # Do not initialize firmware, erase memory, reprint a product or clear other jobs.
 $commands="SIZE $w mm,$h mm`r`nGAPDETECT`r`nREFERENCE 0,0`r`nOFFSET 0 mm`r`n"
 if($Mode -eq 'Print'){
  if(![IO.Path]::IsPathRooted($DataFile) -or [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($DataFile)) -ne [IO.Path]::GetFullPath($PSScriptRoot) -or [IO.Path]::GetFileName($DataFile) -notmatch '^label-[a-f0-9-]{36}\.bin$'){throw 'Invalid PC365 raster path'}
  $bytes=[IO.File]::ReadAllBytes($DataFile);if($bytes.Length -lt 100 -or $bytes.Length -gt 262144){throw 'Invalid PC365 raster length'}
 }else{$bytes=[Text.Encoding]::ASCII.GetBytes($commands)}
 $mayHaveSubmitted=$true;$job=[FastGoPC365Media]::Send($PrinterName,$bytes)
 @{status='submitted';job_id=$job;windows_media=$media;physical_result_verified=$false} | ConvertTo-Json -Compress -Depth 4
}catch { @{status='error';message=$_.Exception.Message;may_have_submitted=$mayHaveSubmitted} | ConvertTo-Json -Compress;exit 1 }
