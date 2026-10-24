package ru.fastgo.tsd;
import android.content.Context;
import android.content.pm.PackageInfo;
import org.json.JSONObject;

/** Installation receipts are sent by the installed APK, not inferred from publishing. */
public final class DeviceStatus {
 public static void send(Context context,LocalStore store,WarehouseApi api){
  try{
   if(api.device()==null)return;
   long last=0;try{last=Long.parseLong(store.get("status_last_attempt"));}catch(NumberFormatException ignored){}
   if(System.currentTimeMillis()-last<60000)return;
   store.put("status_last_attempt",Long.toString(System.currentTimeMillis()));
   PackageInfo own=context.getPackageManager().getPackageInfo(context.getPackageName(),0);
   int pending=store.blockingDocuments();String latest=store.get("update_pending_version");
   String state=new java.io.File(context.getCacheDir(),"update.apk").isFile()?"ready":latest.isEmpty()?"current":pending>0||!store.get("active_document").isEmpty()?"waiting_documents":"available";
   if(store.get("update_last_check").isEmpty())state="unknown";
   if(!store.get("update_check_error").isEmpty()||!store.get("update_background_error").isEmpty())state="error";
   api.call("device_status",new JSONObject().put("app","tsd").put("version",own.versionName).put("version_code",own.versionCode).put("pending_documents",pending).put("update_status",state).put("latest_version",latest.isEmpty()?own.versionName:latest).put("blocking_reason",pending>0?"Есть незавершённые документы":!store.get("active_document").isEmpty()?"Открыто сканирование":"").put("background",!"true".equals(store.get("activity_resumed"))));
   store.put("status_last_report",Long.toString(System.currentTimeMillis()));store.put("status_error","");
  }catch(Exception error){store.put("status_error",error.getMessage()==null?"network_error":error.getMessage());}
 }
}
