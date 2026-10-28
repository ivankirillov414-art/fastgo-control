package ru.fastgo.mobile;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;
import java.io.*;

/** Uses Android's package session API; system verification and consent remain authoritative. */
final class PhoneInstaller {
 static SharedPreferences state(Context c){return c.getSharedPreferences("phone-updates",Context.MODE_PRIVATE);}
 static PackageInstaller.SessionParams parameters(Context context,long size){
  PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
  params.setAppPackageName(context.getPackageName());params.setSize(size);
  if(Build.VERSION.SDK_INT>=26)params.setInstallReason(android.content.pm.PackageManager.INSTALL_REASON_USER);
  // Android permits a signed self-update without another confirmation only when its own rules allow it.
  if(Build.VERSION.SDK_INT>=31)params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
  return params;
 }
 static void install(Context context,File verifiedApk,String version)throws Exception{
  PackageInstaller installer=context.getPackageManager().getPackageInstaller();
  int previous=state(context).getInt("session",-1);
  if(previous!=-1&&installer.getSessionInfo(previous)!=null)throw new IOException("Android уже обрабатывает обновление");
  int id=installer.createSession(parameters(context,verifiedApk.length()));boolean committed=false;
  try(PackageInstaller.Session session=installer.openSession(id)){
   try(InputStream in=new FileInputStream(verifiedApk);OutputStream out=session.openWrite("base.apk",0,verifiedApk.length())){
    byte[] buffer=new byte[32768];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);session.fsync(out);
   }
   Intent result=new Intent(context,PhoneInstallReceiver.class);
   int flags=PendingIntent.FLAG_UPDATE_CURRENT;if(Build.VERSION.SDK_INT>=31)flags|=PendingIntent.FLAG_MUTABLE;
   PendingIntent callback=PendingIntent.getBroadcast(context,id,result,flags);
   if(!state(context).edit().putInt("session",id).putString("install_version",version).commit())throw new IOException("Не удалось сохранить состояние установки");
   session.commit(callback.getIntentSender());committed=true;
  }finally{if(!committed){installer.abandonSession(id);state(context).edit().remove("session").apply();}}
 }
}
