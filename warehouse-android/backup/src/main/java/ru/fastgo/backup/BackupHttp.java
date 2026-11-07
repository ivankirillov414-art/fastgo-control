package ru.fastgo.backup;

import java.io.*;
import java.net.*;
import org.json.*;

public final class BackupHttp {
 public static JSONObject post(String base,String key,String path,JSONObject body,String bearer) throws Exception {
  URL url=new URL(base+path);if(!"https".equals(url.getProtocol())||url.getUserInfo()!=null)throw new IOException("Неверный адрес API");
  HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(15000);c.setReadTimeout(45000);c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("apikey",key);c.setRequestProperty("Content-Type","application/json");if(bearer!=null)c.setRequestProperty("Authorization","Bearer "+bearer);
  try{byte[] data=body.toString().getBytes("UTF-8");c.setFixedLengthStreamingMode(data.length);try(OutputStream out=c.getOutputStream()){out.write(data);}int status=c.getResponseCode();InputStream stream=status>=400?c.getErrorStream():c.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();if(stream!=null)try(InputStream in=stream){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){BackupReplica.cancelled();if(bytes.size()+n>8*1024*1024)throw new IOException("Слишком большой ответ резервного сервера");bytes.write(b,0,n);}}
   JSONObject result;try{result=new JSONObject(bytes.toString("UTF-8"));}catch(Exception e){throw new BackupReplica.ApiError(status>=400?status:502,"invalid_json");}
   if(status!=200)throw new BackupReplica.ApiError(status,result.optString("code",result.optString("error_code",result.optString("error","request_failed"))));return result;
  }finally{c.disconnect();}
 }
 public static InputStream download(String base,String signed) throws Exception {
  URL origin=new URL(base),url=new URL(signed);if(!"https".equals(url.getProtocol())||!origin.getHost().equals(url.getHost())||url.getPort()!=origin.getPort()||url.getUserInfo()!=null||!url.getPath().startsWith("/storage/v1/object/sign/fastgo-backups/")||url.getPath().contains("..")||url.getPath().contains("%"))throw new IOException("Неверный сервер резервного архива");
  final HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(45000);connection.setInstanceFollowRedirects(false);
  try{if(connection.getResponseCode()!=200)throw new IOException("Не удалось загрузить архив");return new FilterInputStream(connection.getInputStream()){@Override public void close() throws IOException{try{super.close();}finally{connection.disconnect();}}};}catch(Exception e){connection.disconnect();throw e;}
 }
 private BackupHttp(){}
}
