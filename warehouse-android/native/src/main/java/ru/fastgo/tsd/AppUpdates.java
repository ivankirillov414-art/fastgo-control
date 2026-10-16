package ru.fastgo.tsd;
import android.content.*;import android.content.pm.*;import android.net.Uri;import org.json.*;import java.io.*;import java.net.*;import java.security.*;import java.util.*;
public final class AppUpdates {
 private final Context context;private final LocalStore store;
 private static final String MANIFEST="https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/native-update.json";
 public AppUpdates(Context c,LocalStore s){context=c;store=s;}
 private byte[] get(String url,int limit)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(25000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Cache-Control","no-cache");try{if(c.getResponseCode()!=200)throw new IOException("Канал обновлений недоступен");try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Размер обновления превышен");out.write(b,0,n);}return out.toByteArray();}}finally{c.disconnect();}}
 public String check(boolean manual)throws Exception{
  Calendar local=Calendar.getInstance(TimeZone.getTimeZone("GMT+05:00"));String day=String.format(Locale.ROOT,"%04d-%02d-%02d",local.get(Calendar.YEAR),local.get(Calendar.MONTH)+1,local.get(Calendar.DAY_OF_MONTH));
  if(!manual&&(local.get(Calendar.HOUR_OF_DAY)<18||day.equals(store.get("update_day"))))return "";
  store.put("update_day",day);JSONObject meta=new JSONObject(new String(get(MANIFEST+"?t="+System.currentTimeMillis(),16000),"UTF-8"));PackageManager pm=context.getPackageManager();PackageInfo own=pm.getPackageInfo(context.getPackageName(),PackageManager.GET_SIGNATURES);
  if(meta.getInt("versionCode")<=own.versionCode)return "Установлена актуальная версия "+own.versionName;
  String url=meta.getString("url");if(!url.startsWith("https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/native/")||!url.endsWith(".apk"))throw new IOException("Недопустимый адрес обновления");
  byte[] data=get(url,20000000);StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(data))hash.append(String.format(Locale.ROOT,"%02x",b&255));if(!hash.toString().equals(meta.getString("sha256")))throw new IOException("Контрольная сумма APK не совпала");
  File temp=new File(context.getCacheDir(),"update-download.apk");try(FileOutputStream out=new FileOutputStream(temp)){out.write(data);out.getFD().sync();}
  PackageInfo next=pm.getPackageArchiveInfo(temp.getAbsolutePath(),PackageManager.GET_SIGNATURES);
  if(next==null||!own.packageName.equals(next.packageName)||next.versionCode!=meta.getInt("versionCode")||next.signatures==null||next.signatures.length!=1||own.signatures==null||own.signatures.length!=1||!own.signatures[0].equals(next.signatures[0])){temp.delete();throw new IOException("Подпись или версия APK не совпала");}
  File target=new File(context.getCacheDir(),"update.apk");if(target.exists()&&!target.delete())throw new IOException("Не удалось заменить APK");if(!temp.renameTo(target))throw new IOException("Не удалось сохранить APK");return "Готово обновление "+next.versionName;
 }
 public boolean ready(){return new File(context.getCacheDir(),"update.apk").isFile();}
 public void install(){Uri uri=Uri.parse("content://"+context.getPackageName()+".updates/update.apk");Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(intent);}
}
