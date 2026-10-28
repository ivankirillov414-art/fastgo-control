package ru.fastgo.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Bundle;

/** Explicit, non-exported callback used by Android for package installation results. */
public final class PhoneInstallResultActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);handle(getIntent());}
 @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
 private void handle(Intent intent){
  int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  try{
   if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){
    Intent confirmation=intent.getParcelableExtra(Intent.EXTRA_INTENT);
    if(confirmation==null)throw new IllegalStateException("Android не передал подтверждение установки");
    startActivity(confirmation);finish();return;
   }
   String message=status==PackageInstaller.STATUS_SUCCESS?"FastGo обновлён до версии "+getPackageManager().getPackageInfo(getPackageName(),0).versionName:status==PackageInstaller.STATUS_FAILURE_ABORTED?"Установка отложена. Можно повторить через «Обновить приложение».":"Android не установил обновление (код "+status+"). Можно повторить через «Обновить приложение».";
   PhoneInstaller.state(this).edit().remove("session").putString("install_result",message).apply();
  }catch(Exception error){PhoneInstaller.state(this).edit().remove("session").putString("install_result","Не удалось завершить установку: "+error.getMessage()).apply();}
  startActivity(new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP));finish();
 }
}
