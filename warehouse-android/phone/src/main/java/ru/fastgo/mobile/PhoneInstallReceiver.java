package ru.fastgo.mobile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
/** System-only replacement signal plus explicit package-installer result callback. */
public final class PhoneInstallReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  boolean replaced=Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction());
  int status=replaced?PackageInstaller.STATUS_SUCCESS:intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  SharedPreferences prefs=PhoneInstaller.state(context);
  try{
   int saved=prefs.getInt("session",-1),result=intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID,saved);
   if(!replaced&&saved!=-1&&result!=saved)return;
   if(status==PackageInstaller.STATUS_SUCCESS){
    PackageInfo own=context.getPackageManager().getPackageInfo(context.getPackageName(),0);
    SharedPreferences.Editor edit=prefs.edit().remove("session").putString("install_completion_source",replaced?"package_replaced":"installer_result");
    if(prefs.getInt("install_success_code",-1)!=own.versionCode)edit.putInt("install_success_code",own.versionCode).putString("install_result","FastGo обновлён до версии "+own.versionName);
    edit.commit();return;
   }
   if(saved==-1)return;
   if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){
    Intent confirmation=intent.getParcelableExtra(Intent.EXTRA_INTENT);
    if(confirmation==null)throw new IllegalStateException("Android не передал подтверждение установки");
    context.startActivity(confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));return;
   }
   prefs.edit().remove("session").putString("install_result",status==PackageInstaller.STATUS_FAILURE_ABORTED?"Установка отложена. Можно повторить через «Обновить приложение».":"Android не установил обновление (код "+status+"). Можно повторить через «Обновить приложение».").commit();
  }catch(Exception error){prefs.edit().remove("session").putString("install_result","Не удалось завершить установку: "+error.getMessage()).commit();}
 }
}
