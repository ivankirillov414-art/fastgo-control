package ru.fastgo.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** Only an APK signed by the installed app's key may reach the system installer. */
final class PhoneUpdates {
 static final String ROOT="https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/";
 static final String FEED=ROOT+"warehouse-android/phone/update.json";
 private final Activity activity;private final WebView web;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private boolean resumed,busy,closed,prompting;private int offered=-1;private long lastCheck;
 private JSONObject ready;private final File apk;
 PhoneUpdates(Activity a,WebView w){activity=a;web=w;apk=new File(a.getCacheDir(),"phone-update/update.apk");}
 private final Runnable tick=new Runnable(){public void run(){if(!resumed||closed)return;check(false);handler.postDelayed(this,60000);}};
 void resume(){resumed=true;handler.removeCallbacks(tick);handler.post(tick);}
 void pause(){resumed=false;handler.removeCallbacks(tick);}
 void close(){closed=true;pause();worker.shutdownNow();}
 private void notice(String text){if(!closed)Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
 void check(boolean manual){
  if(closed)return;if(ready!=null){offer(manual);return;}if(busy){if(manual)notice("Обновление проверяется или загружается…");return;}
  if(!manual&&System.currentTimeMillis()-lastCheck<300000)return;
  busy=true;lastCheck=System.currentTimeMillis();if(manual)notice("Проверяем обновление FastGo…");
  worker.execute(()->{try{
   JSONObject meta=new JSONObject(new String(read(FEED+"?t="+System.currentTimeMillis(),16384),"UTF-8"));
   PackageInfo own=activity.getPackageManager().getPackageInfo(activity.getPackageName(),0);
   if(!activity.getPackageName().equals(meta.getString("package")))throw new IOException("Неверный канал обновлений");
   if(meta.getInt("versionCode")<=own.versionCode){handler.post(()->{if(manual)notice("Установлена актуальная версия "+own.versionName);});return;}
   String url=meta.getString("url");if(!url.startsWith(ROOT+"warehouse-android/phone/release/")||!url.endsWith(".apk"))throw new IOException("Неверный адрес APK");
   if(!apk.isFile()||!valid(apk,meta)){
    if(!apk.getParentFile().isDirectory()&&!apk.getParentFile().mkdirs())throw new IOException("Не удалось создать папку обновления");
    File part=new File(apk.getParentFile(),"download.part");
    try{download(url,part);verify(part,meta);if(apk.exists()&&!apk.delete())throw new IOException("Не удалось заменить обновление");if(!part.renameTo(apk))throw new IOException("Не удалось сохранить обновление");}finally{part.delete();}
   }
   handler.post(()->{if(closed)return;ready=meta;offer(manual);});
  }catch(Exception e){handler.post(()->{if(manual)notice("Не удалось обновить: "+e.getMessage()+". Повторите при наличии сети.");});}
  finally{handler.post(()->busy=false);}});
 }
 private HttpURLConnection connection(String url)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Cache-Control","no-cache");if(c.getResponseCode()!=200){c.disconnect();throw new IOException("Сервер обновлений недоступен");}return c;}
 private byte[] read(String url,int limit)throws Exception{HttpURLConnection c=connection(url);try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Ответ слишком большой");out.write(b,0,n);}return out.toByteArray();}finally{c.disconnect();}}
 private void download(String url,File file)throws Exception{HttpURLConnection c=connection(url);try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(file)){byte[] b=new byte[32768];int n,total=0;while((n=in.read(b))!=-1){if(Thread.currentThread().isInterrupted())throw new IOException("Загрузка остановлена");total+=n;if(total>50000000)throw new IOException("APK слишком большой");out.write(b,0,n);}out.getFD().sync();}finally{c.disconnect();}}
 private boolean valid(File f,JSONObject m){try{verify(f,m);return true;}catch(Exception e){return false;}}
 void verify(File file,JSONObject meta)throws Exception{
  MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}
  StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(Locale.ROOT,"%02x",b&255));if(!hash.toString().equals(meta.getString("sha256")))throw new IOException("Контрольная сумма APK не совпала");
  PackageManager pm=activity.getPackageManager();PackageInfo own=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNATURES),next=pm.getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNATURES);
  if(next==null||!own.packageName.equals(next.packageName)||next.versionCode!=meta.getInt("versionCode")||next.versionCode<=own.versionCode||!next.versionName.equals(meta.getString("versionName"))||next.signatures==null||own.signatures==null||next.signatures.length!=1||own.signatures.length!=1||!own.signatures[0].equals(next.signatures[0]))throw new IOException("Подпись или версия APK не совпала");
 }
 private void safe(Runnable action,boolean manual){if(!resumed||closed)return;web.evaluateJavascript("(()=>{try{return !!(window.fastgoHasUnsavedChanges? !window.fastgoHasUnsavedChanges():window.warehouseUpdateSafe?window.warehouseUpdateSafe(true):false)&&!document.querySelector('dialog[open]');}catch(e){return false;}})()",value->{if(closed||!resumed)return;if("true".equals(value))action.run();else if(manual)notice("Обновление загружено. Сохраните приёмку и закройте открытые окна.");});}
 private void offer(boolean manual){if(ready==null||prompting||(!manual&&offered==ready.optInt("versionCode")))return;safe(()->{if(prompting||ready==null)return;prompting=true;offered=ready.optInt("versionCode");new AlertDialog.Builder(activity).setTitle("Обновление FastGo "+ready.optString("versionName")).setMessage("Обновление уже загружено. Установить сейчас? Данные приложения сохранятся.").setPositiveButton("Обновить",(d,w)->{prompting=false;safe(this::install,true);}).setNegativeButton("Позже",(d,w)->prompting=false).setOnCancelListener(d->prompting=false).show();},manual);}
 private void install(){try{verify(apk,ready);if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){offered=-1;notice("Разрешите FastGo устанавливать обновления и вернитесь в приложение");activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));return;}Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".files",apk);activity.startActivity(new Intent(Intent.ACTION_INSTALL_PACKAGE).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));}catch(Exception e){notice("Установка не началась: "+e.getMessage());}}
}
