package ru.fastgo.tsd;

import android.content.*;

/** Android delivers this to the replacement APK, after the old process is gone. */
public final class UpdateReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  UpdateJob.schedule(context,true);
  if(!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))return;
  try(LocalStore store=new LocalStore(context)){
   String version=context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionName;
   store.put("update_installed_version",version);
   store.put("update_installed_at",Long.toString(System.currentTimeMillis()));
   UpdateNotifications.show(context,"FastGo обновлён", "Установлена версия "+version+". Нажмите, чтобы продолжить работу");
   // Some Android versions restrict background launches. The notification above
   // remains a working return path when the system does not resume this task.
   context.startActivity(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP));
  }catch(Exception ignored){/* The launcher and notification remain available. */}
 }
}
