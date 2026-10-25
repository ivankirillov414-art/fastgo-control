using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace FastGoLauncher {
 public sealed class PrinterSetupResult {
  public string Status, Message;
  public bool Ready, Connected;
 }
 public static class ThermalPrinter {
  static string Value(Dictionary<string,object> result,string key) {
   object value; return result.TryGetValue(key,out value)?Convert.ToString(value):"";
  }
  public static async Task<PrinterSetupResult> Run(bool install) {
   string runDirectory=Path.Combine(Settings.Root,"Repairs","P2-v1",Guid.NewGuid().ToString("N"));
   try {
    Directory.CreateDirectory(runDirectory);
    string script=Path.Combine(runDirectory,"Setup-DetongerP2.ps1"),resultFile=Path.Combine(runDirectory,"result.json");
    using(var source=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastGo.P2Setup")) {
     if(source==null) throw new InvalidDataException("В сборке отсутствует модуль настройки DETONGER P2.");
     using(var output=File.Create(script)) source.CopyTo(output);
    }
    string sharedDirectory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"FastGo","printer-setup","p2");
    string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
    string arguments="-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \""+script+"\" -Directory \""+sharedDirectory+"\" -ResultFile \""+resultFile+"\""+(install?" -Install":"");
    var start=new ProcessStartInfo(powershell,arguments) { UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=runDirectory };
    using(var process=new Process { StartInfo=start }) {
     process.Start(); var output=process.StandardOutput.ReadToEndAsync(); var error=process.StandardError.ReadToEndAsync();
     await Task.Run(()=>process.WaitForExit()); await output; string details=await error;
     if(!File.Exists(resultFile)) {
      Log.Write("P2: нет JSON результата, exit="+process.ExitCode+"; "+details);
      throw new InvalidDataException("Windows не вернула результат проверки DETONGER P2. Код завершения: "+process.ExitCode+". Подробности сохранены в журнале лаунчера.");
     }
     string json=File.ReadAllText(resultFile,Encoding.UTF8);
     var result=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);
     string status=Value(result,"status"),message=Value(result,"message");
     if(process.ExitCode!=0) throw new InvalidDataException("Модуль DETONGER P2 завершился с кодом "+process.ExitCode+". "+message);
     if(status!="ready" && status!="driver_installed" && status!="not_connected" && status!="permission_declined" && status!="download_error" && status!="error" && status!="busy") throw new InvalidDataException("Модуль DETONGER P2 вернул неизвестное состояние: "+status);
     object connected; bool isConnected=result.TryGetValue("connected",out connected) && connected is bool && (bool)connected;
     Log.Write("P2: "+json);
     return new PrinterSetupResult { Status=status,Message=message,Ready=status=="ready",Connected=isConnected };
    }
   } catch(Exception e) {
    Log.Write("P2: "+e);
    return new PrinterSetupResult { Status="error",Message="Не удалось настроить DETONGER P2. "+e.Message,Ready=false,Connected=false };
   }
  }
 }
}
