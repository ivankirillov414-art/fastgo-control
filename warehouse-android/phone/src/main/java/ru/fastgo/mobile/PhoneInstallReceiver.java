package ru.fastgo.mobile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
/** Explicit system callback, independent of background Activity launch restrictions. */
public final class PhoneInstallReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  try{
   if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){
    Intent confirmation=intent.getParcelableExtra(Intent.EXTRA_INTENT);
    if(confirmation==null)throw new IllegalStateException("Android не передал подтверждение установки");
    context.startActivity(confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));return;
   }
   String message=status==PackageInstaller.STATUS_SUCCESS?"FastGo обновлён до версии "+context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionName:status==PackageInstaller.STATUS_FAILURE_ABORTED?"Установка отложена. Можно повторить через «Обновить приложение».":"Android не установил обновление (код "+status+"). Можно повторить через «Обновить приложение».";
   PhoneInstaller.state(context).edit().remove("session").putString("install_result",message).commit();
  }catch(Exception error){PhoneInstaller.state(context).edit().remove("session").putString("install_result","Не удалось завершить установку: "+error.getMessage()).commit();}
 }
}
