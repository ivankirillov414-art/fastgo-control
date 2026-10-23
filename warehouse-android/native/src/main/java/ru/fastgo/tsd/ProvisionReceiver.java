package ru.fastgo.tsd;
import android.content.*;
import android.util.Base64;
import org.json.*;

/** Initial setup over the already-authorized ADB connection. DUMP excludes ordinary apps. */
public final class ProvisionReceiver extends BroadcastReceiver {
 public static void configure(Context context, JSONObject payload)throws Exception{
  SecurePrefs prefs=new SecurePrefs(context);
  if(!prefs.get("auth").isEmpty()||!prefs.get("device").isEmpty())throw new IllegalStateException("already_configured");
  try(LocalStore store=new LocalStore(context)){
   if(store.blockingDocuments()>0)throw new IllegalStateException("documents_require_existing_account");
  }
  JSONObject auth=payload.getJSONObject("auth"),device=payload.getJSONObject("device");
  String user=auth.getJSONObject("user").getString("id");
  if(!user.matches("[a-fA-F0-9-]{36}")||auth.getString("access_token").length()<20||auth.getString("refresh_token").isEmpty()||auth.getLong("expires_at")<1)throw new IllegalArgumentException("invalid_account");
  if(!device.getString("id").matches("[a-fA-F0-9-]{36}")||!device.getString("station_id").matches("[a-fA-F0-9-]{36}")||!device.getString("token").matches("[a-f0-9-]{72}"))throw new IllegalArgumentException("invalid_connection");
  prefs.putConnection(auth.toString(),device.toString());
 }
 @Override public void onReceive(Context context,Intent intent){
  try{
   if("status".equals(intent.getStringExtra("operation"))){
    SecurePrefs prefs=new SecurePrefs(context);
    try(LocalStore store=new LocalStore(context)){
     setResultCode(0);setResultData(new JSONObject().put("version",context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionName).put("configured",!prefs.get("auth").isEmpty()&&!prefs.get("device").isEmpty()).put("blocking_documents",store.blockingDocuments()).put("active_screen",!store.get("active_document").isEmpty()).put("update_pending_version",store.get("update_pending_version")).put("update_ready",new AppUpdates(context,store).ready()).put("update_last_check",store.get("update_last_check")).put("update_download_url",store.get("update_download_url")).put("update_downloaded_at",store.get("update_downloaded_at")).put("update_install_started_at",store.get("update_install_started_at")).put("update_installed_at",store.get("update_installed_at")).put("update_background_checked_at",store.get("update_background_checked_at")).put("update_background_error",store.get("update_background_error")).toString());return;
    }
   }
   String encoded=intent.getStringExtra("payload");
   if(encoded==null||encoded.length()>20000)throw new IllegalArgumentException("invalid_payload");
   configure(context,new JSONObject(new String(Base64.decode(encoded,Base64.NO_WRAP),java.nio.charset.StandardCharsets.UTF_8)));
   setResultCode(0);setResultData("configured");
  }catch(Exception error){setResultCode(1);setResultData("already_configured".equals(error.getMessage())?"already_configured":"setup_failed");}
 }
}
