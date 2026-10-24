package ru.fastgo.tsd;
import android.app.Activity;import android.content.*;import android.content.pm.PackageInstaller;import android.os.Bundle;
/** The system sends this PendingIntent through both confirmation and replacement. */
public final class InstallResultActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);handle(getIntent());}
 @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
 private void handle(Intent intent){
  int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  try(LocalStore store=new LocalStore(this)){
   if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){Intent confirmation=intent.getParcelableExtra(Intent.EXTRA_INTENT);if(confirmation==null)throw new IllegalStateException("Android не передал подтверждение установки");startActivity(confirmation);finish();return;}
   if(status==PackageInstaller.STATUS_SUCCESS){String version=getPackageManager().getPackageInfo(getPackageName(),0).versionName;store.put("update_installed_version",version);store.put("update_installed_at",Long.toString(System.currentTimeMillis()));store.put("update_check_error","");UpdateJob.schedule(this,true);}
   else store.put("update_check_error",status==PackageInstaller.STATUS_FAILURE_ABORTED?"Установка отложена пользователем":"Android не установил обновление ("+status+")");
  }catch(Exception error){try(LocalStore store=new LocalStore(this)){store.put("update_check_error",error.getMessage()==null?"Ошибка установки APK":error.getMessage());}}
  startActivity(new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP));finish();
 }
}
