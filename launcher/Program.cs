using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: AssemblyTitle("FastGo Склад · Лаунчер")]
[assembly: AssemblyDescription("Обновления FastGo Склад с докачкой и диагностикой сети")]
[assembly: AssemblyCompany("FastGo")]
[assembly: AssemblyProduct("FastGo Warehouse Launcher")]
[assembly: AssemblyVersion("1.0.2.0")]
[assembly: AssemblyFileVersion("1.0.2.0")]
namespace FastGoLauncher {
 static class Program {
  [STAThread] static int Main(string[] args) {
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12; ServicePointManager.DefaultConnectionLimit=8;
   if(args.Length>0 && new[] { "--check","--diagnose","--download","--jarvis-inspect","--printer-inspect" }.Contains(args[0])) {
    try { Console.OutputEncoding=new UTF8Encoding(false); } catch(IOException) { }
    try { return Headless(args).GetAwaiter().GetResult(); } catch(Exception e) { Console.Error.WriteLine(Format.Error(e)); return 1; }
   }
   Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
   Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
   Application.ThreadException+=(s,e)=>{ Log.Write(e.Exception.ToString()); MessageBox.Show(Format.Error(e.Exception),"FastGo Склад",MessageBoxButtons.OK,MessageBoxIcon.Error); };
   bool created; using(var mutex=new Mutex(true,@"Local\FastGoWarehouseLauncher",out created)) {
    if(!created) { MessageBox.Show("Лаунчер уже открыт. Переключитесь в его окно.","FastGo Склад"); return 0; }
    string smoke=args.Length==2&&args[0]=="--ui-smoke"?Path.GetFullPath(args[1]):null;
    Log.Write("Лаунчер "+Settings.LauncherVersion+" запущен");
    Application.Run(new MainForm(smoke));
   }
   return 0;
  }
  static async Task<int> Headless(string[] args) {
   var network=new Network(); var updater=new Updater(network); var token=CancellationToken.None;
   if(args[0]=="--jarvis-inspect") { Console.WriteLine(await JarvisRepair.Run(false)); return 0; }
   if(args[0]=="--printer-inspect") { var result=await ThermalPrinter.Run(false); Console.WriteLine(new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(result)); return result.Status=="error"?1:0; }
   var json=new System.Web.Script.Serialization.JavaScriptSerializer();
   if(args[0]=="--diagnose") { var result=await new Diagnostics(network,updater).Run(p=>Console.WriteLine((p.Ok?"OK ":"FAIL ")+p.Name+": "+p.Detail),token); return result.All(p=>p.Ok)?0:1; }
   var release=await updater.Latest(token); Console.WriteLine(json.Serialize(release));
   if(args[0]=="--download") {
    string directory=args.Length>1?Path.GetFullPath(args[1]):Settings.Downloads;
    var file=await updater.Download(release,directory,new Progress<Transfer>(p=>Console.WriteLine(p.Percent+"% "+p.Message+" "+Format.Bytes(p.BytesPerSecond)+"/s")),token);
    Console.WriteLine(json.Serialize(new { file=file,size=new FileInfo(file).Length,sha512_verified=Updater.Verify(file,release),installer_started=false }));
   }
   return 0;
  }
 }
}
