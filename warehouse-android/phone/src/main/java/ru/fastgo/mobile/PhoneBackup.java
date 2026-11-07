package ru.fastgo.mobile;

import android.content.Context;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.security.*;
import java.util.*;
import ru.fastgo.backup.*;

/** The WebView and the background job use one encrypted session and one refresh lock. */
final class PhoneBackup {
 static final Object SESSION_LOCK=new Object();
 private static final Object REFRESH_LOCK=new Object();
 static final String BASE=TaskNotices.BASE,KEY="sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji";
 private static long generation;
 static long epoch(){synchronized(SESSION_LOCK){return generation;}}
 private static AndroidVault vault(Context c){return new AndroidVault(c,"fastgo_phone_session_v1");}
 static String session(Context c) throws Exception {synchronized(SESSION_LOCK){return vault(c).get("session");}}
 static String actor(JSONObject s){return s.optString("user_id",s.optJSONObject("user")==null?"":s.optJSONObject("user").optString("id"));}
 static void session(Context c,String raw) throws Exception {
  synchronized(SESSION_LOCK){if(raw==null||raw.equals("null")||raw.isEmpty()){generation++;vault(c).put("session",null);BackupJobs.cancel(c);return;}
   if(raw.length()>32000)throw new IOException("Сессия слишком большая");JSONObject s=new JSONObject(raw);if(!TaskNotices.uuid(actor(s))||s.optString("access_token").isEmpty())throw new IOException("Неверная сессия");String previous=session(c);if(!previous.isEmpty()&&!actor(new JSONObject(previous)).equals(actor(s)))generation++;vault(c).put("session",s.toString());
  }BackupJobs.schedule(c,PhoneBackupJob.class,true,false);
 }
 static JSONObject refresh(Context c) throws Exception {
  return refresh(c,null);
 }
 static JSONObject refresh(Context c,String staleAccess) throws Exception {
  synchronized(REFRESH_LOCK){final JSONObject s;final long started;
   synchronized(SESSION_LOCK){String raw=session(c);if(raw.isEmpty())throw new BackupReplica.ApiError(401,"no_session");s=new JSONObject(raw);if(s.optLong("expires_at")>System.currentTimeMillis()/1000+90&&(staleAccess==null||!staleAccess.equals(s.optString("access_token"))))return s;started=generation;}
   if(s.optString("refresh_token").isEmpty())throw new BackupReplica.ApiError(401,"no_refresh");
   try{JSONObject next=BackupHttp.post(BASE,KEY,"/auth/v1/token?grant_type=refresh_token",new JSONObject().put("refresh_token",s.getString("refresh_token")),null);if(!actor(s).equals(actor(next)))throw new IOException("Аккаунт сессии изменился");next.put("user_id",actor(s)).put("expires_at",System.currentTimeMillis()/1000+next.getLong("expires_in"));
    synchronized(SESSION_LOCK){String current=session(c);if(started!=generation||current.isEmpty()||!s.getString("access_token").equals(new JSONObject(current).optString("access_token")))throw new BackupReplica.ApiError(401,"session_changed");vault(c).put("session",next.toString());}return next;}
   catch(BackupReplica.ApiError e){if(e.status==400||e.status==401)synchronized(SESSION_LOCK){String current=session(c);if(started==generation&&!current.isEmpty()&&s.getString("access_token").equals(new JSONObject(current).optString("access_token"))){generation++;vault(c).put("session",null);BackupJobs.cancel(c);}}throw e;}
  }
 }
 static File root(Context c,String actor) throws Exception {return new File(c.getFilesDir(),"server-backups/"+BackupReplica.hash(actor.getBytes("UTF-8")).substring(0,24));}
 static String status(Context c){try{String s=session(c);return AndroidVault.spaceStatus(c,s.isEmpty()?"Войдите в аккаунт для резервирования":BackupJobs.summary(root(c,actor(new JSONObject(s)))));}catch(Exception e){return "Не удалось прочитать статус резерва";}}
 static void run(Context c) throws Exception {
  JSONObject session=refresh(c);final String actor=actor(session);final long started;synchronized(SESSION_LOCK){started=generation;}
  AndroidVault vault=vault(c);String identityRaw=vault.get("replica_"+actor);JSONObject identity=identityRaw.isEmpty()?new JSONObject().put("device_id",UUID.randomUUID().toString()).put("device_token",UUID.randomUUID().toString()+UUID.randomUUID().toString()):new JSONObject(identityRaw);if(identityRaw.isEmpty())vault.put("replica_"+actor,identity.toString());
  BackupReplica.Remote remote=new BackupReplica.Remote(){
   @Override public JSONObject call(String action,JSONObject params) throws Exception {
    if(started!=epoch())throw new BackupReplica.ApiError(401,"session_changed");JSONObject current=refresh(c);final String access;synchronized(SESSION_LOCK){if(started!=generation||!actor.equals(actor(current)))throw new BackupReplica.ApiError(401,"actor_changed");access=current.getString("access_token");}
    JSONObject body=new JSONObject(params.toString()).put("action",action).put("device_id",identity.getString("device_id")).put("device_token",identity.getString("device_token"));return BackupHttp.post(BASE,KEY,"/functions/v1/fastgo-backups",body,access).getJSONObject("data");
   }
   @Override public InputStream download(String url) throws Exception {synchronized(SESSION_LOCK){if(started!=generation)throw new BackupReplica.ApiError(401,"session_changed");}return BackupHttp.download(BASE,url);}
  };
  JSONObject me=BackupHttp.post(BASE,KEY,"/functions/v1/fastgo-workshop-api",new JSONObject().put("action","me").put("params",new JSONObject()),session.getString("access_token")).getJSONObject("data");
  boolean owner="owner".equals(me.optString("role"))||"developer".equals(me.optString("role"));KeyStore.PrivateKeyEntry rsa=owner?AndroidVault.rsa("fastgo_recovery_"+BackupReplica.hash(actor.getBytes("UTF-8")).substring(0,24)):null;
  JSONObject registration=new JSONObject().put("app","android").put("host",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL);if(rsa!=null)registration.put("public_key",Base64.encodeToString(rsa.getCertificate().getPublicKey().getEncoded(),Base64.NO_WRAP));remote.call("register",registration);
  BackupReplica replica=new BackupReplica(root(c,actor),remote,rsa==null?null:new OwnerRecovery(rsa,identity.getString("device_id"),new File(c.getCacheDir(),"backup-restore"),AndroidVault.budget(c)),AndroidVault.DURABLE,AndroidVault.budget(c));replica.run();
 }
}
