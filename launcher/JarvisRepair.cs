using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace FastGoLauncher {
 public static class JarvisRepair {
  static void Extract(string resource,string path) {
   using(var source=Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)) {
    if(source==null) throw new InvalidOperationException("В сборке отсутствует исправление JARVIS.");
    using(var output=File.Create(path)) source.CopyTo(output);
   }
  }
  static async Task<Dictionary<string,object>> Invoke(string directory,string script,string resultFile,bool apply,bool elevated) {
   string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
   string startup=Environment.GetFolderPath(Environment.SpecialFolder.Startup);
   string arguments="-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \""+script+"\" -ResultFile \""+resultFile+"\" -StartupDirectory \""+startup+"\""+(apply?" -Apply":"");
   var start=new ProcessStartInfo(powershell,arguments) { UseShellExecute=elevated,CreateNoWindow=!elevated,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=directory };
   if(elevated) start.Verb="runas";
   else { start.RedirectStandardOutput=true; start.RedirectStandardError=true; }
   using(var process=new Process { StartInfo=start }) {
    try { process.Start(); }
    catch(Win32Exception e) { if(e.NativeErrorCode==1223) throw new InvalidOperationException("Запрос прав администратора отменён. Исправление JARVIS не применено."); throw; }
    Task<string> output=null,error=null;
    if(!elevated) { output=process.StandardOutput.ReadToEndAsync(); error=process.StandardError.ReadToEndAsync(); }
    await Task.Run(()=>process.WaitForExit());
    string rawError=error==null?"":await error;
    if(output!=null) await output;
    if(!File.Exists(resultFile)) { Log.Write("JARVIS: процесс завершился без подтверждения, exit="+process.ExitCode+", "+rawError); throw new InvalidDataException("PowerShell не вернул результат исправления JARVIS. Код завершения: "+process.ExitCode+". Подробности — в журнале."); }
    string text=File.ReadAllText(resultFile,Encoding.UTF8); File.Delete(resultFile);
    Log.Write("JARVIS: "+text);
    var receipt=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(text);
    if(process.ExitCode!=0 && Text(receipt,"status")=="ok") throw new InvalidDataException("JARVIS завершился с ошибкой после записи результата. Откройте журнал.");
    return receipt;
   }
  }
  static string Text(Dictionary<string,object> receipt,string key) { object value; return receipt.TryGetValue(key,out value)?Convert.ToString(value):""; }
  static Exception Failure(Dictionary<string,object> result) {
   string code=Text(result,"error_code"),message=Text(result,"message"),summary;
   switch(code) {
    case "not_found": summary="JARVIS не найден на этом ноутбуке. Запустите исправление на кассовом ноутбуке, где установлен бот."; break;
    case "requires_admin": summary="Windows запретила изменение задачи или файлов JARVIS. Нужны права администратора на кассовом ноутбуке."; break;
    case "script_host_unavailable": summary="В Windows недоступен Windows Script Host, необходимый для скрытого запуска JARVIS."; break;
    case "installation_incomplete": summary="Найдена неполная установка JARVIS. Причина указана ниже."; break;
    case "rollback_incomplete": summary="Windows помешала полностью восстановить настройки запуска JARVIS после ошибки. Путь резервной копии указан ниже."; break;
    default: summary="Исправление запуска JARVIS не завершено."; break;
   }
   return new InvalidOperationException(summary+Environment.NewLine+Environment.NewLine+"Причина: "+message+Environment.NewLine+"Код: "+code+" · "+Text(result,"hresult")+" · строка "+Text(result,"script_line"));
  }
  public static async Task<string> Run(bool apply) {
   string directory=Path.Combine(Settings.Root,"Repairs","JARVIS-quiet-launch-v2",Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
   string fix=Path.Combine(directory,"FIX_JARVIS_CONSOLE.ps1"),wrapper=Path.Combine(directory,"Invoke-JarvisRepair.ps1"),resultFile=Path.Combine(directory,"result.json");
   Extract("FastGo.JarvisRepair",fix); Extract("FastGo.JarvisRunner",wrapper);
   var receipt=await Invoke(directory,wrapper,resultFile,apply,false);
   bool administrator=new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);
   if(apply && Text(receipt,"error_code")=="requires_admin" && !administrator) {
    Log.Write("JARVIS: запрашиваем повышение прав Windows для повторной попытки");
    receipt=await Invoke(directory,wrapper,resultFile,true,true);
   }
   if(Text(receipt,"status")!="ok") throw Failure(receipt);
   if(apply) {
    if(!receipt.ContainsKey("bot_restarted") || !receipt.ContainsKey("trading_configuration_changed") || (bool)receipt["bot_restarted"] || (bool)receipt["trading_configuration_changed"]) throw new InvalidDataException("Результат исправления требует проверки. Откройте журнал.");
    string text=new JavaScriptSerializer().Serialize(receipt);
    File.WriteAllText(Path.Combine(directory,"last-receipt.json"),text,Encoding.UTF8);
    return "Скрытый запуск JARVIS настроен."+Environment.NewLine+"Резервная копия: "+Text(receipt,"backup")+Environment.NewLine+Environment.NewLine+"Работающий бот не перезапускался. Уже открытое старое окно автоматически не закрывается.";
   }
   return "JARVIS найден. Исправление ещё не применено.";
  }
 }
}
