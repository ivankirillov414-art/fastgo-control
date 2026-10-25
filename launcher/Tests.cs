using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FastGoLauncher;

sealed class FixtureServer : IDisposable {
 readonly TcpListener listener; readonly CancellationTokenSource stop=new CancellationTokenSource();
 readonly byte[] payload; readonly string mode; int calls;
 public long LastOffset; public int Calls { get { return calls; } }
 public string Url { get; private set; }
 public FixtureServer(byte[] bytes,string mode) {
  payload=bytes; this.mode=mode; listener=new TcpListener(IPAddress.Loopback,0); listener.Start();
  Url="http://127.0.0.1:"+((IPEndPoint)listener.LocalEndpoint).Port+"/update.exe";
  Task.Run(async()=> { while(!stop.IsCancellationRequested) { TcpClient client; try { client=await listener.AcceptTcpClientAsync(); } catch { break; } ThreadPool.QueueUserWorkItem(s=>Serve((TcpClient)s),client); } });
 }
 void Serve(TcpClient client) {
  using(client) try {
   var stream=client.GetStream(); var reader=new StreamReader(stream,Encoding.ASCII,false,1024,true); string line=reader.ReadLine(); if(line==null) return;
   long offset=0; while(!String.IsNullOrEmpty(line=reader.ReadLine())) if(line.StartsWith("Range: bytes=")) offset=Int64.Parse(line.Substring(13).TrimEnd('-'));
   LastOffset=offset; int call=Interlocked.Increment(ref calls);
   if(mode=="ignore") offset=0;
   if(mode=="redirect") { byte[] redirect=Encoding.ASCII.GetBytes("HTTP/1.1 302 Found\r\nLocation: http://example.com/untrusted.exe\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); stream.Write(redirect,0,redirect.Length); return; }
   string header="HTTP/1.1 "+(offset>0?"206 Partial Content":"200 OK")+"\r\nContent-Length: "+(payload.Length-offset)+"\r\nConnection: close\r\n";
   if(offset>0) header+="Content-Range: bytes "+(mode=="bad-range"?offset+1:offset)+"-"+(payload.Length-1)+"/"+payload.Length+"\r\n";
   byte[] headers=Encoding.ASCII.GetBytes(header+"\r\n"); stream.Write(headers,0,headers.Length);
   int end=mode=="disconnect"&&call==1?200000:payload.Length;
   for(int pos=(int)offset;pos<end;pos+=16384) { int count=Math.Min(16384,end-pos); stream.Write(payload,pos,count); if(mode=="slow") Thread.Sleep(8); }
  } catch { }
 }
 public void Dispose() { stop.Cancel(); listener.Stop(); stop.Dispose(); }
}
sealed class Sink : IProgress<Transfer> { public void Report(Transfer value) { } }
static class Tests {
 static int count; static string root;
 static void Assert(bool ok,string name) { if(!ok) throw new Exception("FAIL: "+name); Console.WriteLine("PASS: "+name); count++; }
 static void Reject(Action action,string name) { bool rejected=false; try { action(); } catch(InvalidDataException) { rejected=true; } Assert(rejected,name); }
 static string Manifest(string version,string url,string hash,string size) { return "version: "+version+"\nfiles:\n  - url: "+url+"\n    sha512: "+hash+"\n    size: "+size+"\n"; }
 static string Hash(byte[] bytes) { using(var hash=SHA512.Create()) return Convert.ToBase64String(hash.ComputeHash(bytes)); }
 static string Dir(string name) { var dir=Path.Combine(root,name); Directory.CreateDirectory(dir); return dir; }
 static Release Release(byte[] bytes,string url) { return new Release { Version="1.2.3",Url=url,Sha512=Hash(bytes),Size=bytes.Length }; }
 static int Main(string[] args) {
  if(args.Length==1 && args[0]=="--process-fixture") { Thread.Sleep(30000); return 0; }
  root=Path.Combine(Path.GetTempPath(),"fastgo-launcher-tests-"+Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
  try { Run().GetAwaiter().GetResult(); Console.WriteLine("ALL "+count+" CHECKS PASSED"); return 0; }
  catch(Exception e) { Console.Error.WriteLine(e); return 1; }
  finally { string temporary=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar); if(Path.GetDirectoryName(Path.GetFullPath(root))!=temporary) throw new IOException("Unsafe test cleanup path"); if(Directory.Exists(root)) Directory.Delete(root,true); }
 }
 static async Task Run() {
  TestInstallation();
  byte[] bytes=new byte[1200000]; new Random(31).NextBytes(bytes); bytes[0]=(byte)'M';bytes[1]=(byte)'Z';
  string url="https://github.com/"+Settings.Repo+"/releases/download/fastgo-warehouse-v1.2.3/FastGo-Warehouse-Setup-1.2.3-Windows-x64.exe";
  string valid=Manifest("1.2.3",url,Hash(bytes),bytes.Length.ToString());
  Assert(Updater.Parse(valid,"test").Size==bytes.Length,"Parse genuine warehouse manifest");
  Reject(()=>Updater.Parse(valid.Replace("1.2.3","../evil"),"test"),"Reject version path traversal");
  Reject(()=>Updater.Parse(valid.Replace("github.com/","github.com.evil.test/"),"test"),"Reject lookalike host");
  Reject(()=>Updater.Parse(valid.Replace("https://","http://"),"test"),"Reject HTTP installer");
  Reject(()=>Updater.Parse(valid.Replace("fastgo-warehouse-v1.2.3/","fastgo-v1.2.3/"),"test"),"Reject service channel installer");
  Reject(()=>Updater.Parse(valid.Replace(Hash(bytes),"abcd"),"test"),"Reject missing SHA-512");
  Reject(()=>Updater.Parse(valid.Replace(bytes.Length.ToString(),"0"),"test"),"Reject zero-byte installer");
  Reject(()=>Updater.Parse(valid.Replace(bytes.Length.ToString(),"9999999999"),"test"),"Reject oversized installer");
  Reject(()=>Updater.Parse(valid.Replace("    size:","    no_size:"),"test"),"Reject missing manifest size");
  var production=new Network();
  Assert(!production.Allowed(new Uri("http://127.0.0.1/update.exe")),"Production rejects local/HTTP download");
  Assert(!production.Allowed(new Uri("https://user:password@github.com/file")),"Reject credentials in URLs");
  Assert(!production.Allowed(new Uri("https://github.com:444/file")),"Reject unexpected TLS ports");
  Assert(production.Allowed(new Uri("https://release-assets.githubusercontent.com/file")),"Allow official release CDN");
  var updater=new Updater(new Network(true));
  using(var server=new FixtureServer(bytes,"normal")) {
   var release=Release(bytes,server.Url); string dir=Dir("normal"); string path=await updater.Download(release,dir,new Sink(),CancellationToken.None);
   Assert(Updater.Verify(path,release),"Download and verify final SHA-512"); Assert(!File.Exists(path+".partial"),"Promote partial file only after verification");
   await updater.Download(release,dir,new Sink(),CancellationToken.None); Assert(server.Calls==1,"Reuse verified download without another request");
  }
  using(var server=new FixtureServer(bytes,"normal")) {
   var release=Release(bytes,server.Url); string dir=Dir("resume"); File.WriteAllBytes(Path.Combine(dir,release.FileName)+".partial",bytes.Take(240000).ToArray());
   string path=await updater.Download(release,dir,new Sink(),CancellationToken.None);
   Assert(server.LastOffset==240000 && Updater.Verify(path,release),"Resume existing partial with correct Range");
  }
  using(var server=new FixtureServer(bytes,"ignore")) {
   var release=Release(bytes,server.Url); string dir=Dir("ignore"); File.WriteAllBytes(Path.Combine(dir,release.FileName)+".partial",bytes.Take(100000).ToArray());
   string path=await updater.Download(release,dir,new Sink(),CancellationToken.None); Assert(Updater.Verify(path,release),"Restart safely when server ignores Range");
  }
  using(var server=new FixtureServer(bytes,"disconnect")) {
   var release=Release(bytes,server.Url); string path=await updater.Download(release,Dir("disconnect"),new Sink(),CancellationToken.None);
   Assert(server.Calls==2 && server.LastOffset==200000 && Updater.Verify(path,release),"Retry broken connection and preserve downloaded bytes");
  }
  using(var server=new FixtureServer(bytes,"bad-range")) {
   var release=Release(bytes,server.Url); string dir=Dir("bad-range"); File.WriteAllBytes(Path.Combine(dir,release.FileName)+".partial",bytes.Take(100000).ToArray());
   string path=await updater.Download(release,dir,new Sink(),CancellationToken.None); Assert(server.Calls==2 && Updater.Verify(path,release),"Reject wrong Content-Range before retrying cleanly");
  }
  using(var server=new FixtureServer(bytes,"normal")) {
   var release=Release(bytes,server.Url); release.Sha512=Hash(new byte[10]); string dir=Dir("corrupt"); bool failed=false;
   try { await updater.Download(release,dir,new Sink(),CancellationToken.None); } catch(InvalidDataException) { failed=true; }
   Assert(failed && !File.Exists(Path.Combine(dir,release.FileName)) && !File.Exists(Path.Combine(dir,release.FileName)+".partial"),"Corrupt payload is never promoted or executable");
  }
  using(var server=new FixtureServer(bytes,"slow")) using(var cancel=new CancellationTokenSource()) {
   var release=Release(bytes,server.Url); string dir=Dir("cancel"); cancel.CancelAfter(130); bool cancelled=false;
   try { await updater.Download(release,dir,new Sink(),cancel.Token); } catch(OperationCanceledException) { cancelled=true; }
   string partial=Path.Combine(dir,release.FileName)+".partial";
   Assert(cancelled && File.Exists(partial) && new FileInfo(partial).Length>0 && !File.Exists(Path.Combine(dir,release.FileName)),"Cancellation retains a partial, never a ready installer");
   string path=await updater.Download(release,dir,new Sink(),CancellationToken.None); Assert(Updater.Verify(path,release),"Cancelled download resumes to verified installer");
  }
  using(var server=new FixtureServer(bytes,"redirect")) {
   bool rejected=false; try { using(var response=await new Network(true).Open(server.Url,"GET",0,CancellationToken.None)) { } } catch(InvalidDataException) { rejected=true; }
   Assert(rejected,"Block untrusted redirects before fetching them");
  }
  string existing=Path.Combine(Dir("verify"),"tampered.exe"); File.WriteAllBytes(existing,bytes); var known=Release(bytes,url); Assert(Updater.Verify(existing,known),"Known file passes checksum");
  using(var stream=File.OpenWrite(existing)) stream.WriteByte(0); Assert(!Updater.Verify(existing,known),"Changed cached file fails revalidation");
 }
 static void TestInstallation() {
  Assert(Installation.MatchesDisplayName("FastGo Склад"),"Recognize legacy warehouse uninstall display name");
  Assert(Installation.MatchesDisplayName("FastGo Склад 1.0.25"),"Recognize default NSIS product and version display name");
  Assert(!Installation.MatchesDisplayName("FastGo 1.0.25"),"Do not identify the service application as warehouse");
  Assert(!Installation.MatchesDisplayName("FastGo Склад Companion"),"Reject unrelated product sharing the warehouse prefix");
  Assert(!Installation.MatchesDisplayName("FastGo Склад 1.0.25 malicious"),"Require a complete NSIS display name");
  string folder=Dir("installed warehouse with spaces"),exe=Path.Combine(folder,"FastGo Склад.exe");
  File.Copy(typeof(Tests).Assembly.Location,exe);
  Assert(Installation.DisplayIconPath("\""+exe+"\",0")==exe,"Parse quoted DisplayIcon with an index");
  Assert(Installation.DisplayIconPath(exe+",0")==exe,"Parse unquoted NSIS DisplayIcon with an index");
  Assert(Installation.DisplayIconPath("  \""+exe+"\", -1  ")==exe,"Parse signed icon index and surrounding whitespace");
  Assert(Installation.DisplayIconPath("\""+exe+"\" --background")=="","Reject command arguments in DisplayIcon");
  var known=Installation.FromRegistryValues("FastGo Склад 1.0.25",folder,"","1.0.25");
  Assert(known.Path==exe && known.Version=="1.0.25","Read a standard NSIS installation and its application version");
  var missing=Installation.FromRegistryValues("FastGo Склад",folder,"","");
  Assert(missing.Path==exe && missing.Version=="","Keep installed path when DisplayVersion is absent");
  var invalid=Installation.FromRegistryValues("FastGo Склад",folder,"","unknown");
  Assert(invalid.Path==exe && invalid.Version=="","Keep installed path when DisplayVersion is invalid");
  var icon=Installation.FromRegistryValues("FastGo Склад 1.0.25","","\""+exe+"\",0","1.0.25");
  Assert(icon.Path==exe && icon.Version=="1.0.25","Discover an installation from quoted DisplayIcon without InstallLocation");
  var absent=Installation.FromRegistryValues("FastGo Склад 1.0.25",Path.Combine(folder,"absent"),"","1.0.25");
  Assert(absent.Path=="" && absent.Version=="","Reject uninstall records whose executable is absent");
  var service=Installation.FromRegistryValues("FastGo 1.0.25",folder,"\""+exe+"\",0","1.0.25");
  Assert(service.Path=="","Do not discover warehouse through service uninstall records");
  var fallback=Installation.FromFolder(folder);
  Assert(fallback.Path==exe && fallback.Version=="","Folder discovery retains path without trusting EXE ProductVersion");
  Assert(!Installation.ProcessNames(new Installation()).Contains("FastGo",StringComparer.OrdinalIgnoreCase),"Process guard does not match the generic FastGo service name");
  Assert(!Installation.ProcessNames(new Installation()).Contains("FastGo-Warehouse-Launcher",StringComparer.OrdinalIgnoreCase),"Process guard does not match the launcher");
  TestWarehouseProcess(exe,"FastGo Склад");
  string renamed=Path.Combine(folder,"FastGo РЎРєР»Р°Рґ.exe"); File.Copy(typeof(Tests).Assembly.Location,renamed);
  TestWarehouseProcess(renamed,"FastGo РЎРєР»Р°Рґ");
 }
 static void TestWarehouseProcess(string exe,string name) {
  using(var fixture=Process.Start(new ProcessStartInfo(exe,"--process-fixture") { UseShellExecute=false,CreateNoWindow=true })) {
   try {
    bool found=false;
    for(int attempt=0;attempt<20 && !found;attempt++) {
     var processes=Process.GetProcessesByName(name);
     found=processes.Any(p=>p.Id==fixture.Id); foreach(var process in processes) process.Dispose();
     if(!found) Thread.Sleep(50);
    }
    Assert(found && !fixture.HasExited,"Start a controlled real process with warehouse name: "+name);
    Assert(Installation.Running(new Installation()),"Block installation while named warehouse runs even without discovery: "+name);
   } finally { if(!fixture.HasExited) fixture.Kill(); fixture.WaitForExit(5000); }
  }
 }
}
