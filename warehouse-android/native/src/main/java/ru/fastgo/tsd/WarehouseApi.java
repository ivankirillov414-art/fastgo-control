package ru.fastgo.tsd;
import org.json.*;
import java.net.*;
import java.io.*;
public final class WarehouseApi {
 private static final String BASE="https://oqgpjfikjpcplnxueoki.supabase.co",KEY="sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji";
 private final SecurePrefs prefs;
 public static class ApiError extends IOException{public final int status;ApiError(int s,String m){super(m);status=s;}}
 public WarehouseApi(SecurePrefs p){prefs=p;}
 private JSONObject request(String path,JSONObject body,String token)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(BASE+path).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(20000);c.setRequestMethod("POST");c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json");if(token!=null)c.setRequestProperty("Authorization","Bearer "+token);c.setDoOutput(true);
  try{try(OutputStream o=c.getOutputStream()){o.write(body.toString().getBytes("UTF-8"));}int status=c.getResponseCode();InputStream stream=status>=400?c.getErrorStream():c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(stream!=null)try(InputStream in=stream){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>8*1024*1024)throw new IOException("Слишком большой ответ");out.write(b,0,n);}}JSONObject r=new JSONObject(out.toString("UTF-8"));if(status>=400)throw new ApiError(status,r.optString("error_description",r.optString("error",r.optString("message","Ошибка сервера"))));return r;}finally{c.disconnect();}
 }
 private void session(JSONObject r)throws Exception{JSONObject user=r.optJSONObject("user");JSONObject old=auth();if(user==null&&old!=null)user=old.optJSONObject("user");r.put("expires_at",System.currentTimeMillis()/1000+r.optLong("expires_in",3600));if(user!=null)r.put("user",user);prefs.put("auth",r.toString());}
 public JSONObject auth()throws Exception{String raw=prefs.get("auth");return raw.isEmpty()?null:new JSONObject(raw);}
 public void login(String email,String password)throws Exception{JSONObject r=request("/auth/v1/token?grant_type=password",new JSONObject().put("email",email).put("password",password),null);JSONObject old=auth();if(old!=null&&!old.getJSONObject("user").getString("id").equals(r.getJSONObject("user").getString("id")))throw new IOException("На этом терминале сохранены данные другого сотрудника. Используйте прежний аккаунт");session(r);}
 public synchronized Object call(String action,JSONObject params)throws Exception{
  JSONObject a=auth();if(a==null)throw new ApiError(401,"Войдите в FastGo");if(a.optLong("expires_at")<System.currentTimeMillis()/1000+90){session(request("/auth/v1/token?grant_type=refresh_token",new JSONObject().put("refresh_token",a.getString("refresh_token")),null));a=auth();}
  JSONObject p=new JSONObject(params.toString()).put("action",action);String raw=prefs.get("device");if(!raw.isEmpty()){JSONObject d=new JSONObject(raw);p.put("device_id",d.getString("id")).put("device_token",d.getString("token"));}
  return request("/functions/v1/fastgo-warehouse",p,a.getString("access_token")).opt("data");
 }
 public JSONObject device()throws Exception{String raw=prefs.get("device");return raw.isEmpty()?null:new JSONObject(raw);}
 public void connect(String station)throws Exception{String raw=prefs.get("connect");JSONObject p=raw.isEmpty()?new JSONObject():new JSONObject(raw);if(!station.equals(p.optString("station_id"))){p=new JSONObject().put("station_id",station).put("terminal_id",java.util.UUID.randomUUID().toString()).put("token",java.util.UUID.randomUUID().toString()+java.util.UUID.randomUUID().toString());prefs.put("connect",p.toString());}JSONObject d=(JSONObject)call("connect_terminal",p);prefs.put("device",d.toString());}
}
