package ru.fastgo.tsd;
import android.content.*;import android.content.pm.*;import android.net.Uri;import android.os.Build;import android.provider.Settings;import org.json.*;import java.io.*;import java.net.*;import java.security.*;import java.util.*;
public final class AppUpdates {
 private final Context context;private final LocalStore store;interface Source{byte[] read(String url,int limit)throws Exception;}private final Source source;
 private static final String MANIFEST="https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/native-update.json";
 public AppUpdates(Context c,LocalStore s){this(c,s,null);} AppUpdates(Context c,LocalStore s,Source transport){context=c;store=s;source=transport;}
 private byte[] get(String url,int limit)throws Exception{if(source!=null){byte[] bytes=source.read(url,limit);if(bytes.length>limit)throw new IOException("Update too large");return bytes;}HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(25000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Cache-Control","no-cache");try{if(c.getResponseCode()!=200)throw new IOException("Канал обновлений недоступен");try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Размер обновления превышен");out.write(b,0,n);}return out.toByteArray();}}finally{c.disconnect();}}
 private String blockers()throws Exception{int count=store.blockingDocuments();if(count>0)return "Завершите или отмените незакрытые документы: "+count;if(!store.get("active_document").isEmpty())return "Закройте экран сканирования кнопкой «Назад»";return "";}
 public boolean canInstall(){try{return blockers().isEmpty();}catch(Exception e){return false;}}
 private String notice()throws Exception{String version=store.get("update_pending_version");if(version.isEmpty())return "";String blocked=blockers();return blocked.isEmpty()?(ready()?"Загружено обновление "+version:""):"Доступно обновление "+version+". "+blocked;}
 private PackageInfo verify(File file,JSONObject meta)throws Exception{
  StringBuilder hash=new StringBuilder();try(InputStream in=new FileInputStream(file)){MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);for(byte value:digest.digest())hash.append(String.format(Locale.ROOT,"%02x",value&255));}
  if(!hash.toString().equals(meta.getString("sha256")))throw new IOException("Контрольная сумма APK не совпала");
  PackageManager pm=context.getPackageManager();PackageInfo own=pm.getPackageInfo(context.getPackageName(),PackageManager.GET_SIGNATURES),next=pm.getPackageArchiveInfo(file.getAbsolutePath(),PackageManager.GET_SIGNATURES);
  if(next==null||!own.packageName.equals(next.packageName)||next.versionCode!=meta.getInt("versionCode")||next.versionCode<=own.versionCode||next.signatures==null||next.signatures.length!=1||own.signatures==null||own.signatures.length!=1||!own.signatures[0].equals(next.signatures[0]))throw new IOException("Подпись или версия APK не совпала");return next;
 }
 public synchronized String check(boolean manual)throws Exception{
  long last=0;try{last=Long.parseLong(store.get("update_last_check"));}catch(NumberFormatException ignored){}
  if(!manual&&System.currentTimeMillis()-last<60000)return notice();
  JSONObject meta=new JSONObject(new String(get(MANIFEST+"?t="+System.currentTimeMillis(),16000),"UTF-8"));JSONObject channels=meta.optJSONObject("channels");if(channels!=null&&channels.optJSONObject(context.getPackageName())!=null)meta=channels.getJSONObject(context.getPackageName());PackageInfo own=context.getPackageManager().getPackageInfo(context.getPackageName(),0);
  if(!context.getPackageName().equals(meta.getString("package")))throw new IOException("Канал обновлений относится к другому приложению");
  store.put("update_last_check",Long.toString(System.currentTimeMillis()));
  if(meta.getInt("versionCode")<=own.versionCode){new File(context.getCacheDir(),"update.apk").delete();store.put("update_pending_version","");return manual?"Установлена актуальная версия "+own.versionName:"";}
  store.put("update_pending_version",meta.getString("versionName"));String blocked=blockers();if(!blocked.isEmpty())return notice();
  String url=meta.getString("url");if(!url.startsWith("https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/native/")||!url.endsWith(".apk"))throw new IOException("Недопустимый адрес обновления");
  File target=new File(context.getCacheDir(),"update.apk");if(target.isFile()){try{verify(target,meta);store.put("update_meta",meta.toString());return notice();}catch(Exception ignored){target.delete();}}
  byte[] data=get(url,20000000);File temp=new File(context.getCacheDir(),"update-download.apk");try(FileOutputStream out=new FileOutputStream(temp)){out.write(data);out.getFD().sync();}
  try{verify(temp,meta);}catch(Exception e){temp.delete();throw e;}
  if(target.exists()&&!target.delete())throw new IOException("Не удалось заменить APK");if(!temp.renameTo(target))throw new IOException("Не удалось сохранить APK");store.put("update_meta",meta.toString());return notice();
 }
 public boolean ready(){return new File(context.getCacheDir(),"update.apk").isFile();}
 public String readyVersion(){return store.get("update_pending_version");}
 public boolean installerAllowed(){return Build.VERSION.SDK_INT<26||context.getPackageManager().canRequestPackageInstalls();}
 public boolean install()throws Exception{
  String blocked=blockers();if(!blocked.isEmpty())throw new IOException(blocked);File apk=new File(context.getCacheDir(),"update.apk");verify(apk,new JSONObject(store.get("update_meta")));
  if(Build.VERSION.SDK_INT>=26&&!context.getPackageManager().canRequestPackageInstalls()){context.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));return false;}
  Uri uri=Uri.parse("content://"+context.getPackageName()+".updates/update.apk");context.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK));return true;
 }
}
