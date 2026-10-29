package ru.fastgo.mobile;

import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.*;
import android.util.Base64;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.UUID;
import java.util.concurrent.*;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Opaque device key only: this worker has no password or refresh token. */
final class TaskNotices {
 static final String BASE="https://oqgpjfikjpcplnxueoki.supabase.co",CHANNEL="fastgo_staff_tasks",PREFS="fastgo_task_notices",ALIAS="fastgo_task_device_v1";
 static final int JOB=47021,PERMISSION=44;
 private static final Object LOCK=new Object();
 private static long generation;
 private final Context context;
 private final Runnable requestPermission;
 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private volatile boolean busy;
 TaskNotices(Context context,Runnable requestPermission){this.context=context.getApplicationContext();this.requestPermission=requestPermission;channel(this.context);}
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
 static boolean uuid(String value){return value!=null&&value.matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}");}
 private static javax.crypto.SecretKey key() throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (javax.crypto.SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
 }
 private static void save(Context c,JSONObject value) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String encrypted=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
  synchronized(LOCK){if(!prefs(c).edit().putString("credential",encrypted).commit())throw new IOException("storage");}
 }
 private static JSONObject load(Context c){
  try{String encrypted=prefs(c).getString("credential",null);if(encrypted==null)return null;String[] parts=encrypted.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));}catch(Exception ignored){return null;}
 }
 static void channel(Context c){if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"Задачи FastGo",NotificationManager.IMPORTANCE_HIGH);channel.setDescription("Назначенные вам задачи");((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);}}
 static boolean allowed(Context c){if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return false;if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).getNotificationChannel(CHANNEL);if(channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}return true;}
 void configure(String raw){
  if(raw==null||raw.length()>20000||busy)return;busy=true;final long started;synchronized(LOCK){started=generation;}
  executor.execute(()->{try{
   JSONObject input=new JSONObject(raw);String actor=input.optString("actor_id");if(!uuid(actor)||!BASE.equals(input.optString("base")))return;
   JSONObject credential=load(context);
   if(credential==null||!actor.equals(credential.optString("actor"))){
    String device=prefs(context).getString("device_"+actor,null);if(!uuid(device)){device=UUID.randomUUID().toString();prefs(context).edit().putString("device_"+actor,device).commit();}
    byte[] random=new byte[32];new SecureRandom().nextBytes(random);String secret=Base64.encodeToString(random,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
    credential=new JSONObject().put("actor",actor).put("device_id",device).put("token",secret).put("apikey",input.getString("apikey")).put("registered",false);synchronized(LOCK){if(started!=generation)return;save(context,credential);}
   }
   if(!credential.optBoolean("registered")){
    JSONObject params=new JSONObject().put("device_id",credential.getString("device_id")).put("token",credential.getString("token"));
    request(BASE+"/functions/v1/fastgo-workshop-api",new JSONObject().put("action","staff_device_register").put("params",params),credential.getString("apikey"),input.getString("access_token"),null);
    // A logout may have cleared the credential while enrollment was in flight.
    synchronized(LOCK){JSONObject current=load(context);if(started!=generation||current==null||!current.optString("token").equals(credential.getString("token")))return;credential.put("registered",true);save(context,credential);}
   }
   synchronized(LOCK){if(started!=generation)return;schedule(context);}poll(requestPermission);
  }catch(Exception ignored){}finally{busy=false;}});
 }
 void check(){if(busy)return;busy=true;executor.execute(()->{try{poll(requestPermission);}finally{busy=false;}});}
 void background(Runnable complete){executor.execute(()->{try{poll(null);}finally{complete.run();executor.shutdown();}});}
 private void poll(Runnable ask){
  JSONObject c=load(context);if(c==null||!c.optBoolean("registered"))return;
  try{
   boolean permitted=allowed(context);JSONObject result=deviceRequest(c,new JSONObject().put("claim",permitted));JSONArray items=result.getJSONObject("data").getJSONArray("items");
   if(!permitted){if(items.length()>0&&ask!=null)ask.run();return;}
   for(int i=0;i<items.length();i++){JSONObject task=items.getJSONObject(i);if(post(context,c,task))deviceRequest(c,new JSONObject().put("ack",task.getString("id")));}
  }catch(Exception ignored){}
 }
 private static JSONObject deviceRequest(JSONObject c,JSONObject body) throws Exception {body.put("device_id",c.getString("device_id"));return request(BASE+"/functions/v1/fastgo-staff-notices",body,c.getString("apikey"),null,c.getString("token"));}
 static boolean post(Context context,JSONObject credential,JSONObject task) throws Exception {
  String id=task.getString("id"),actor=credential.getString("actor");if(!uuid(id)||!uuid(actor))return false;
  synchronized(LOCK){
   JSONObject current=load(context);if(current==null||!current.optString("token").equals(credential.optString("token"))||!allowed(context))return false;
   String seen="posted_"+actor+"_"+id;if(prefs(context).getBoolean(seen,false))return true;
   Intent open=new Intent(context,MainActivity.class).setAction("fastgo.task."+id).putExtra("staff_task_id",id).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   PendingIntent tap=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   String title=task.optString("title","Новая задача"),body=task.optString("body");title=title.substring(0,Math.min(200,title.length()));body=body.substring(0,Math.min(1000,body.length()));
   Notification notification=new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(ru.fastgo.mobile.R.drawable.ic_task_notice).setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setPriority(NotificationCompat.PRIORITY_HIGH).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_REMINDER).build();
   NotificationManagerCompat.from(context).notify(id,47022,notification);
   // Ack after posting. Lost ack retries without alerting again, including restart.
   prefs(context).edit().putBoolean(seen,true).commit();return true;
  }
 }
 static JSONObject request(String url,JSONObject body,String apikey,String access,String noticeToken) throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("apikey",apikey);if(access!=null)connection.setRequestProperty("Authorization","Bearer "+access);if(noticeToken!=null)connection.setRequestProperty("x-fastgo-notice-token",noticeToken);
  try{byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(data.length);try(OutputStream out=connection.getOutputStream()){out.write(data);}if(connection.getResponseCode()!=200)throw new IOException("notice request failed");ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] block=new byte[4096];int n;while((n=in.read(block))!=-1){if(bytes.size()+n>65536)throw new IOException("response too large");bytes.write(block,0,n);}}return new JSONObject(bytes.toString("UTF-8"));}finally{connection.disconnect();}
 }
 static void schedule(Context c){JobScheduler scheduler=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);for(JobInfo job:scheduler.getAllPendingJobs())if(job.getId()==JOB)return;scheduler.schedule(new JobInfo.Builder(JOB,new ComponentName(c,TaskNoticeJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).setPersisted(true).build());}
 static void clear(Context c){
  JSONObject credential;
  synchronized(LOCK){generation++;credential=load(c);prefs(c).edit().remove("credential").commit();((JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE)).cancel(JOB);NotificationManagerCompat.from(c).cancelAll();}
  if(credential!=null&&credential.optBoolean("registered"))new Thread(()->{try{deviceRequest(credential,new JSONObject().put("revoke",true));}catch(Exception ignored){}},"fastgo-notice-revoke").start();
 }
 void close(){executor.shutdown();}
}
