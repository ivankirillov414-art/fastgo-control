using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace FastGoLauncher {
 public sealed class Release {
  public string Version, Url, Sha512, Source;
  public long Size;
  public string FileName { get { return "FastGo-Warehouse-Setup-" + Version + "-Windows-x64.exe"; } }
 }
 public sealed class Transfer {
  public long Received, Total; public double BytesPerSecond; public string Message;
  public int Percent { get { return Total > 0 ? (int)Math.Min(100, Received * 100 / Total) : 0; } }
 }
 public sealed class Probe {
  public string Name, Detail; public bool Ok; public long Milliseconds;
 }
 public static class Settings {
  public const string LauncherVersion = "1.0.0";
  public const string Repo = "ivankirillov414-art/fastgo-control";
  public const string Feed = "https://raw.githubusercontent.com/" + Repo + "/main/warehouse/update/latest.yml";
  public const string ReleasesApi = "https://api.github.com/repos/" + Repo + "/releases?per_page=30";
  public static string Root { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FastGo Launcher"); } }
  public static string Downloads { get { return Path.Combine(Root, "Downloads"); } }
  public static string Logs { get { return Path.Combine(Root, "Logs"); } }
 }
 public static class Log {
  static readonly object Gate = new object();
  public static void Write(string message) {
   try { lock (Gate) { Directory.CreateDirectory(Settings.Logs); string path = Path.Combine(Settings.Logs, "launcher-" + DateTime.Now.ToString("yyyy-MM-dd") + ".log");
    File.AppendAllText(path, DateTime.Now.ToString("HH:mm:ss") + "  " + message + Environment.NewLine, Encoding.UTF8);
   } } catch { }
  }
 }
 public static class Format {
  public static string Bytes(double n) { string[] units = { "Б", "КБ", "МБ", "ГБ" }; int i=0; while(n>=1024 && i<3) { n/=1024; i++; } return n.ToString(i==0 ? "0" : "0.0", CultureInfo.CurrentCulture)+" "+units[i]; }
  public static string Error(Exception ex) {
   if(ex is OperationCanceledException) return "Операция отменена. Загрузку можно продолжить позже.";
   var web=ex as WebException;
   if(web!=null) {
    if(web.Status==WebExceptionStatus.NameResolutionFailure || web.Status==WebExceptionStatus.ProxyNameResolutionFailure) return "DNS не находит сервер. Проверьте подключение и настройки DNS.";
    if(web.Status==WebExceptionStatus.TrustFailure || web.Status==WebExceptionStatus.SecureChannelFailure) return "Не удалось установить защищённое соединение. Проверьте дату Windows и HTTPS-фильтрацию антивируса.";
    if(web.Status==WebExceptionStatus.Timeout) return "Сервер долго не отвечает. Повторите загрузку или запустите диагностику.";
    var response=web.Response as HttpWebResponse;
    if(response!=null) return "Сервер вернул HTTP "+(int)response.StatusCode+". Попробуйте повторить позже.";
    if(web.Status==WebExceptionStatus.ConnectFailure) return "Соединение с сервером недоступно. Проверьте интернет, VPN и прокси.";
   }
   return ex.Message;
  }
 }
 public sealed class Network {
  readonly bool testLocal;
  public Network() : this(false) { }
  internal Network(bool allowLocalTests) { testLocal=allowLocalTests; }
  public bool Allowed(Uri u) {
   if(testLocal && u.Scheme=="http" && u.IsLoopback) return true;
   if(u.Scheme!="https" || u.Port!=443 || !String.IsNullOrEmpty(u.UserInfo)) return false;
   return new[] { "github.com", "api.github.com", "raw.githubusercontent.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "github-releases.githubusercontent.com" }.Contains(u.Host.ToLowerInvariant());
  }
  public async Task<HttpWebResponse> Open(string url, string method, long offset, CancellationToken token) {
   var current=new Uri(url);
   for(int redirect=0; redirect<8; redirect++) {
    token.ThrowIfCancellationRequested();
    if(!Allowed(current)) throw new InvalidDataException("Источник загрузки не входит в доверенный канал FastGo.");
    var req=(HttpWebRequest)WebRequest.Create(current);
    req.Method=method; req.AllowAutoRedirect=false; req.UserAgent="FastGo-Warehouse-Launcher/"+Settings.LauncherVersion;
    req.Accept="*/*"; req.Timeout=15000; req.ReadWriteTimeout=20000; req.AutomaticDecompression=DecompressionMethods.None;
    if(offset>0) req.AddRange(offset);
    using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token)) {
     deadline.CancelAfter(15000);
     using(deadline.Token.Register(req.Abort)) {
      HttpWebResponse response;
      try { response=(HttpWebResponse)await req.GetResponseAsync().ConfigureAwait(false); }
      catch(WebException) { token.ThrowIfCancellationRequested(); if(deadline.IsCancellationRequested) throw new WebException("Timeout",WebExceptionStatus.Timeout); throw; }
      int status=(int)response.StatusCode;
      if(status==301 || status==302 || status==303 || status==307 || status==308) {
       string location=response.Headers["Location"]; response.Dispose();
       if(String.IsNullOrEmpty(location)) throw new InvalidDataException("Сервер не указал адрес загрузки.");
       current=new Uri(current,location); continue;
      }
      if(status!=200 && status!=206) { response.Dispose(); throw new InvalidDataException("Неожиданный ответ сервера: HTTP "+status); }
      return response;
     }
    }
   }
   throw new InvalidDataException("Слишком много перенаправлений сервера.");
  }
  internal static async Task<int> Read(Stream stream, byte[] buffer, int count, CancellationToken token) {
   var read=stream.ReadAsync(buffer,0,count,token);
   if(await Task.WhenAny(read,Task.Delay(20000,token)).ConfigureAwait(false)!=read) { token.ThrowIfCancellationRequested(); throw new WebException("Загрузка не передаёт данные более 20 секунд.",WebExceptionStatus.Timeout); }
   return await read.ConfigureAwait(false);
  }
  public async Task<string> Text(string url,CancellationToken token) {
   using(var response=await Open(url,"GET",0,token).ConfigureAwait(false))
   using(var registration=token.Register(response.Close))
   using(var stream=response.GetResponseStream())
   using(var data=new MemoryStream()) {
    byte[] buffer=new byte[16384]; int read;
    while((read=await Read(stream,buffer,buffer.Length,token).ConfigureAwait(false))>0) { data.Write(buffer,0,read); if(data.Length>1048576) throw new InvalidDataException("Слишком большой ответ сервера обновлений."); }
    return Encoding.UTF8.GetString(data.ToArray());
   }
  }
 }
 public sealed class Updater {
  readonly Network network;
  public Updater(Network network) { this.network=network; }
  static string Field(string text,string name) {
   var m=Regex.Match(text,@"(?m)^\s*(?:-\s*)?"+Regex.Escape(name)+@":\s*([^\r\n]+)");
   if(!m.Success) throw new InvalidDataException("В списке обновлений отсутствует "+name+".");
   return m.Groups[1].Value.Trim().Trim('\'', '"');
  }
  public static Release Parse(string text,string source) {
   var r=new Release { Version=Field(text,"version"), Url=Field(text,"url"), Sha512=Field(text,"sha512"), Source=source };
   if(!Regex.IsMatch(r.Version,@"^\d+\.\d+\.\d+$") || r.Version.Length>30) throw new InvalidDataException("Неверная версия обновления.");
   long size; if(!Int64.TryParse(Field(text,"size"),NumberStyles.None,CultureInfo.InvariantCulture,out size) || size<1048576 || size>1073741824) throw new InvalidDataException("Неверный размер установщика."); r.Size=size;
   byte[] hash; try { hash=Convert.FromBase64String(r.Sha512); } catch { throw new InvalidDataException("Неверная контрольная сумма обновления."); }
   if(hash.Length!=64) throw new InvalidDataException("Неверная контрольная сумма обновления.");
   string expected="https://github.com/"+Settings.Repo+"/releases/download/fastgo-warehouse-v"+r.Version+"/"+r.FileName;
   if(r.Url!=expected) throw new InvalidDataException("Список обновлений содержит посторонний установщик.");
   return r;
  }
  public async Task<Release> Latest(CancellationToken token) {
   try { return Parse(await network.Text(Settings.Feed+"?t="+DateTimeOffset.UtcNow.ToUnixTimeSeconds(),token).ConfigureAwait(false),"Основной канал"); }
   catch(Exception e) { token.ThrowIfCancellationRequested(); Log.Write("Основной канал: "+Format.Error(e)); }
   var json=new JavaScriptSerializer();
   var list=json.DeserializeObject(await network.Text(Settings.ReleasesApi,token).ConfigureAwait(false)) as object[];
   if(list==null) throw new InvalidDataException("Не удалось прочитать резервный канал обновлений.");
   var releases=list.OfType<Dictionary<string,object>>().Where(x=>x.ContainsKey("tag_name") && Regex.IsMatch((string)x["tag_name"],@"^fastgo-warehouse-v\d+\.\d+\.\d+$") && !(bool)x["draft"] && !(bool)x["prerelease"]).OrderByDescending(x=>new Version(((string)x["tag_name"]).Substring("fastgo-warehouse-v".Length)));
   foreach(var release in releases) {
    var assets=release["assets"] as object[];
    if(assets==null) continue;
    var asset=assets.OfType<Dictionary<string,object>>().FirstOrDefault(x=>(string)x["name"]=="latest.yml");
    if(asset!=null) {
     string url=(string)asset["browser_download_url"];
     string prefix="https://github.com/"+Settings.Repo+"/releases/download/"+(string)release["tag_name"]+"/";
     if(url!=prefix+"latest.yml") throw new InvalidDataException("Посторонний резервный канал.");
     var found=Parse(await network.Text(url,token).ConfigureAwait(false),"Резервный канал GitHub");
     if((string)release["tag_name"]!="fastgo-warehouse-v"+found.Version) throw new InvalidDataException("Версия резервного канала не совпадает с выпуском.");
     return found;
    }
   }
   throw new InvalidDataException("В резервном канале нет проверенного выпуска FastGo Склад.");
  }
  public static bool Verify(string path,Release release) {
   if(!File.Exists(path) || new FileInfo(path).Length!=release.Size) return false;
   using(var hash=SHA512.Create()) using(var stream=File.OpenRead(path)) return Convert.ToBase64String(hash.ComputeHash(stream))==release.Sha512;
  }
  public async Task<string> Download(Release release,string directory,IProgress<Transfer> progress,CancellationToken token) {
   Directory.CreateDirectory(directory); string final=Path.Combine(directory,release.FileName),part=final+".partial";
   if(await Task.Run(()=>Verify(final,release),token).ConfigureAwait(false)) return final;
   var watch=Stopwatch.StartNew(); long startBytes=File.Exists(part)?new FileInfo(part).Length:0;
   for(int attempt=0; attempt<3; attempt++) {
    token.ThrowIfCancellationRequested();
    try {
     long offset=File.Exists(part)?new FileInfo(part).Length:0;
     if(offset>release.Size) { File.Delete(part); offset=0; }
     if(offset<release.Size) {
      using(var response=await network.Open(release.Url,"GET",offset,token).ConfigureAwait(false))
      using(var registration=token.Register(response.Close)) {
       if(response.StatusCode==HttpStatusCode.PartialContent) {
        var range=Regex.Match(response.Headers["Content-Range"]??"",@"^bytes (\d+)-(\d+)/(\d+)$");
        if(!range.Success || Int64.Parse(range.Groups[1].Value)!=offset || Int64.Parse(range.Groups[2].Value)!=release.Size-1 || Int64.Parse(range.Groups[3].Value)!=release.Size) throw new InvalidDataException("Сервер вернул неверный диапазон загрузки.");
       } else offset=0;
       if(response.ContentLength>=0 && response.ContentLength!=release.Size-offset) throw new InvalidDataException("Размер файла на сервере отличается от списка обновлений.");
       var drive=new DriveInfo(Path.GetPathRoot(Path.GetFullPath(directory)));
       if(drive.AvailableFreeSpace<release.Size-offset+32*1024*1024) throw new IOException("Недостаточно места на диске для загрузки обновления.");
       using(var input=response.GetResponseStream()) using(var output=new FileStream(part,offset>0?FileMode.Append:FileMode.Create,FileAccess.Write,FileShare.Read,65536,true)) {
        byte[] buffer=new byte[65536]; long received=offset; long last=0; int read;
        while((read=await Network.Read(input,buffer,buffer.Length,token).ConfigureAwait(false))>0) {
         if(received+read>release.Size) throw new InvalidDataException("Сервер передал лишние данные.");
         await output.WriteAsync(buffer,0,read,token).ConfigureAwait(false); received+=read;
         if(watch.ElapsedMilliseconds-last>120) { last=watch.ElapsedMilliseconds; progress.Report(new Transfer { Received=received,Total=release.Size,BytesPerSecond=Math.Max(0,received-startBytes)/Math.Max(0.1,watch.Elapsed.TotalSeconds),Message="Скачивание обновления" }); }
        }
        if(received!=release.Size) throw new IOException("Соединение прервано. Повторная попытка продолжит загрузку.");
       }
      }
     }
     progress.Report(new Transfer { Received=release.Size,Total=release.Size,Message="Проверка целостности SHA-512…" });
     if(!await Task.Run(()=>Verify(part,release),token).ConfigureAwait(false)) { File.Delete(part); throw new InvalidDataException("Контрольная сумма не совпала. Повреждённый файл удалён, загрузка повторится."); }
     token.ThrowIfCancellationRequested();
     if(File.Exists(final)) File.Delete(final); File.Move(part,final); Log.Write("Проверен установщик "+release.Version+" ("+release.Size+" байт)"); return final;
    } catch(Exception e) {
     token.ThrowIfCancellationRequested(); Log.Write("Загрузка, попытка "+(attempt+1)+": "+Format.Error(e));
     if(e is InvalidDataException && File.Exists(part)) File.Delete(part);
     if(attempt==2 || (e is IOException && !(e is InvalidDataException) && !(e is EndOfStreamException) && new DriveInfo(Path.GetPathRoot(Path.GetFullPath(directory))).AvailableFreeSpace<release.Size+32*1024*1024)) throw;
     progress.Report(new Transfer { Total=release.Size,Received=File.Exists(part)?new FileInfo(part).Length:0,Message="Связь прервалась. Повторная попытка "+(attempt+2)+" из 3…" });
    }
    await Task.Delay(1000*(attempt+1),token).ConfigureAwait(false);
   }
   throw new IOException("Загрузка не завершена.");
  }
 }
 public sealed class Installation {
  public string Version="",Path="";
  public static Installation Find() {
   var result=new Installation();
   foreach(var hive in new[] { RegistryHive.CurrentUser,RegistryHive.LocalMachine }) foreach(var view in new[] { RegistryView.Registry64,RegistryView.Registry32 }) {
    try { using(var root=RegistryKey.OpenBaseKey(hive,view)) using(var uninstall=root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall")) {
     if(uninstall==null) continue;
     foreach(var name in uninstall.GetSubKeyNames()) using(var key=uninstall.OpenSubKey(name)) {
      if(key==null || !String.Equals(Convert.ToString(key.GetValue("DisplayName")),"FastGo Склад",StringComparison.OrdinalIgnoreCase)) continue;
      string location=Convert.ToString(key.GetValue("InstallLocation")),icon=Convert.ToString(key.GetValue("DisplayIcon")).Trim('"');
      var match=Regex.Match(icon,@"^(.*?\.exe)(?:""?,\d+)?$",RegexOptions.IgnoreCase); if(match.Success) icon=match.Groups[1].Value.Trim('"');
      string exe=FindExecutable(location); if(exe=="") exe=File.Exists(icon)?icon:"";
      Version version; string text=Convert.ToString(key.GetValue("DisplayVersion"));
      if(exe!="" && System.Version.TryParse(text,out version) && (result.Version=="" || version>new Version(result.Version))) result=new Installation { Version=text,Path=exe };
     }
    } } catch { }
   }
   if(result.Path=="") foreach(string folder in new[] { "fastgo-warehouse-desktop", "FastGo Склад" }) {
    string path=FindExecutable(System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs",folder));
    if(path!="") { result.Path=path; Version v; string text=FileVersionInfo.GetVersionInfo(path).ProductVersion; if(System.Version.TryParse(text,out v)) result.Version=text; break; }
   }
   return result;
  }
  static string FindExecutable(string folder) {
   if(String.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder)) return "";
   try { return Directory.GetFiles(folder,"*.exe").FirstOrDefault(x=>!System.IO.Path.GetFileName(x).StartsWith("Uninstall",StringComparison.OrdinalIgnoreCase) && System.IO.Path.GetFileName(x).StartsWith("FastGo",StringComparison.OrdinalIgnoreCase))??""; } catch { return ""; }
  }
  public static bool Running(Installation installed) {
   if(installed.Path=="") return false;
   string name=System.IO.Path.GetFileNameWithoutExtension(installed.Path);
   var processes=Process.GetProcessesByName(name); bool any=processes.Length>0; foreach(var p in processes) p.Dispose(); return any;
  }
 }
 public sealed class Diagnostics {
  readonly Updater updater; readonly Network network;
  public Diagnostics(Network network,Updater updater) { this.network=network; this.updater=updater; }
  public async Task<List<Probe>> Run(Action<Probe> report,CancellationToken token) {
   var result=new List<Probe>();
   Action<Probe> add=p=>{result.Add(p); report(p);};
   add(new Probe { Name="Подключение Windows",Ok=NetworkInterface.GetIsNetworkAvailable(),Detail=NetworkInterface.GetIsNetworkAvailable()?"Сетевой интерфейс подключён":"Нет активного сетевого подключения" });
   var adapters=NetworkInterface.GetAllNetworkInterfaces().Where(x=>x.OperationalStatus==OperationalStatus.Up && x.NetworkInterfaceType!=NetworkInterfaceType.Loopback).Select(x=>x.NetworkInterfaceType.ToString()).Distinct();
   Log.Write("Интерфейсы: "+String.Join(", ",adapters));
   foreach(string host in new[] { "raw.githubusercontent.com","github.com" }) {
    token.ThrowIfCancellationRequested(); var watch=Stopwatch.StartNew();
    try { var dns=Dns.GetHostAddressesAsync(host); if(await Task.WhenAny(dns,Task.Delay(7000,token)).ConfigureAwait(false)!=dns) { token.ThrowIfCancellationRequested(); throw new TimeoutException("DNS не ответил за 7 секунд"); } await dns.ConfigureAwait(false); add(new Probe { Name="DNS · "+host,Ok=true,Detail="Имя сервера найдено",Milliseconds=watch.ElapsedMilliseconds }); }
    catch(Exception e) { token.ThrowIfCancellationRequested(); add(new Probe { Name="DNS · "+host,Detail=Format.Error(e),Milliseconds=watch.ElapsedMilliseconds }); }
   }
   var tcpWatch=Stopwatch.StartNew();
   try { using(var tcp=new TcpClient()) { var connect=tcp.ConnectAsync("github.com",443); if(await Task.WhenAny(connect,Task.Delay(7000,token)).ConfigureAwait(false)!=connect) { token.ThrowIfCancellationRequested(); throw new TimeoutException("Порт 443 не ответил за 7 секунд"); } await connect.ConfigureAwait(false); } add(new Probe { Name="HTTPS · порт 443",Ok=true,Detail="Соединение с GitHub установлено",Milliseconds=tcpWatch.ElapsedMilliseconds }); }
   catch(Exception e) { token.ThrowIfCancellationRequested(); add(new Probe { Name="HTTPS · порт 443",Detail=Format.Error(e),Milliseconds=tcpWatch.ElapsedMilliseconds }); }
   var feedWatch=Stopwatch.StartNew(); Release release=null;
   try { release=await updater.Latest(token).ConfigureAwait(false); add(new Probe { Name="Канал обновлений",Ok=true,Detail="Версия "+release.Version+" · "+release.Source,Milliseconds=feedWatch.ElapsedMilliseconds }); }
   catch(Exception e) { token.ThrowIfCancellationRequested(); add(new Probe { Name="Канал обновлений",Detail=Format.Error(e),Milliseconds=feedWatch.ElapsedMilliseconds }); }
   if(release!=null) {
    var watch=Stopwatch.StartNew();
    try { using(var response=await network.Open(release.Url,"GET",0,token).ConfigureAwait(false)) using(var stream=response.GetResponseStream()) using(var registration=token.Register(response.Close)) { byte[] b=new byte[16384]; if(await Network.Read(stream,b,b.Length,token).ConfigureAwait(false)<2 || b[0]!='M' || b[1]!='Z') throw new InvalidDataException("Сервер не передал Windows-установщик."); } add(new Probe { Name="Сервер загрузки",Ok=true,Detail="Установщик доступен · "+Format.Bytes(release.Size),Milliseconds=watch.ElapsedMilliseconds }); }
    catch(Exception e) { token.ThrowIfCancellationRequested(); add(new Probe { Name="Сервер загрузки",Detail=Format.Error(e),Milliseconds=watch.ElapsedMilliseconds }); }
   }
   var drive=new DriveInfo(Path.GetPathRoot(Settings.Root)); long needed=(release==null?150*1024*1024:release.Size)+32*1024*1024;
   add(new Probe { Name="Место для загрузки",Ok=drive.AvailableFreeSpace>needed,Detail="Свободно "+Format.Bytes(drive.AvailableFreeSpace) });
   var proxy=WebRequest.DefaultWebProxy; bool proxyUsed=proxy!=null && !proxy.IsBypassed(new Uri(Settings.Feed));
   add(new Probe { Name="Системный прокси",Ok=true,Detail=proxyUsed?"Используется прокси Windows":"Прямое подключение" });
   return result;
  }
  public static string Report(IEnumerable<Probe> probes) {
   var text=new StringBuilder("FastGo Склад · диагностика лаунчера "+Settings.LauncherVersion+Environment.NewLine+DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")+Environment.NewLine+"Windows: "+Environment.OSVersion+Environment.NewLine+Environment.NewLine);
   foreach(var p in probes) text.AppendLine((p.Ok?"[OK] ":"[ОШИБКА] ")+p.Name+": "+p.Detail+(p.Milliseconds>0?" ("+p.Milliseconds+" мс)":""));
   text.AppendLine(); text.AppendLine("Скорость отображается во время полной загрузки. Проверка доступности не измеряет скорость канала.");
   return text.ToString();
  }
 }
}
