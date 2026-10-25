using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace FastGoLauncher {
 public static class JarvisRepair {
  public static async Task<string> Run(bool apply) {
   string directory=Path.Combine(Settings.Root,"Repairs","JARVIS-quiet-launch-v1"); Directory.CreateDirectory(directory);
   string script=Path.Combine(directory,"FIX_JARVIS_CONSOLE.ps1");
   string resultFile=Path.Combine(directory,"result-"+Guid.NewGuid().ToString("N")+".json");
   using(var source=Assembly.GetExecutingAssembly().GetManifestResourceStream("FastGo.JarvisRepair")) {
    if(source==null) throw new InvalidOperationException("В сборке отсутствует исправление JARVIS.");
    using(var output=File.Create(script)) source.CopyTo(output);
   }
   string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
   var start=new ProcessStartInfo(powershell,"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\" -ResultFile \""+resultFile+"\""+(apply?" -Apply":"")) { UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8,WorkingDirectory=directory };
   using(var process=new Process { StartInfo=start }) {
    process.Start(); var output=process.StandardOutput.ReadToEndAsync(); var error=process.StandardError.ReadToEndAsync();
    await Task.Run(()=>process.WaitForExit()); string text=await output,details=await error;
    if(process.ExitCode!=0) {
     Log.Write("JARVIS: "+details);
     if(details.Contains("No JARVIS") || details.Contains("JARVIS task/startup was not found")) throw new InvalidOperationException("JARVIS не найден на этом ноутбуке. Запустите исправление на кассовом ноутбуке, где установлен бот.");
     if(details.IndexOf("access",StringComparison.OrdinalIgnoreCase)>=0 || details.Contains("0x80070005") || details.IndexOf("доступ",StringComparison.OrdinalIgnoreCase)>=0) throw new InvalidOperationException("Windows не разрешила изменить задачу JARVIS. Запустите лаунчер от имени администратора на кассовом ноутбуке.");
     throw new InvalidOperationException("Не удалось исправить запуск JARVIS. Подробности сохранены в журнале лаунчера.");
    }
    if(!File.Exists(resultFile)) throw new InvalidDataException("JARVIS не сохранил подтверждение исправления. Откройте журнал.");
    text=File.ReadAllText(resultFile,Encoding.UTF8); File.Delete(resultFile);
    var receipt=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(text);
    if(apply) {
     if((bool)receipt["bot_restarted"] || (bool)receipt["trading_configuration_changed"]) throw new InvalidDataException("Результат исправления требует проверки. Откройте журнал.");
     File.WriteAllText(Path.Combine(directory,"last-receipt.json"),text,Encoding.UTF8); Log.Write("JARVIS: скрытый запуск исправлен. Резервная копия: "+receipt["backup"]);
     return "Скрытый запуск JARVIS настроен. Резервная копия сохранена в папке бота. Уже открытое старое окно автоматически не закрывается.";
    }
    return "JARVIS найден. Исправление ещё не применено.";
   }
  }
 }
}
