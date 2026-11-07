package ru.fastgo.backup;

import org.json.*;
import java.io.*;
import java.nio.channels.*;
import java.security.*;
import java.text.SimpleDateFormat;
import java.util.*;

/** Ciphertext is durable before a complete manifest becomes visible. No server writes except receipts. */
public final class BackupReplica {
 public interface Remote {
  JSONObject call(String action, JSONObject params) throws Exception;
  InputStream download(String signedUrl) throws Exception;
 }
 public interface Recovery { JSONObject verify(File database, JSONObject snapshot, List<File> media) throws Exception; }
 public interface DirectorySync {
  void sync(File directory) throws Exception;
  default void replace(File from,File to) throws Exception {if(!from.renameTo(to))throw new IOException("Не удалось завершить запись резерва");}
 }
 public static final class ApiError extends IOException {
  private static final long serialVersionUID=1L;
  public final int status; public final String code;
  public ApiError(int status,String code){super("HTTP "+status);this.status=status;this.code=code;}
  public boolean unsupportedHistory(){return (status==400||status==404)&&("unknown_action".equals(code)||"unsupported_action".equals(code)||"Unknown action".equals(code)||"Неизвестное действие".equals(code));}
 }
 public final File root;
 private final Remote remote; private final Recovery recovery; private final DirectorySync sync;
 private final DiskBudget budget;
 public BackupReplica(File root,Remote remote,Recovery recovery,DirectorySync sync) throws IOException {
  this(root,remote,recovery,sync,null);
 }
 public BackupReplica(File root,Remote remote,Recovery recovery,DirectorySync sync,DiskBudget budget) throws IOException {
  this.budget=budget;
  this.root=root.getCanonicalFile();this.remote=remote;this.recovery=recovery;this.sync=sync;
  if(!root.isDirectory()&&!root.mkdirs())throw new IOException("Не удалось создать каталог резервов");
 }
 public static String hash(byte[] bytes) throws Exception {return hex(MessageDigest.getInstance("SHA-256").digest(bytes));}
 static String hex(byte[] b){StringBuilder out=new StringBuilder();for(byte v:b)out.append(String.format(Locale.ROOT,"%02x",v&255));return out.toString();}
 public static String hash(File file) throws Exception {MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){cancelled();d.update(b,0,n);}}return hex(d.digest());}
 public static void cancelled() throws InterruptedIOException {if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Резервирование прервано; прежние копии сохранены");}
 File file(String name) throws IOException {
  File f=new File(root,name).getCanonicalFile();if(!f.getPath().startsWith(root.getPath()+File.separator))throw new IOException("Неверный путь резерва");return f;
 }
 public static byte[] read(File f,int max) throws IOException {
  try(InputStream in=new FileInputStream(f);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>max)throw new IOException("Слишком большой файл резерва");out.write(b,0,n);}return out.toByteArray();}
 }
 public void atomic(String name,byte[] bytes) throws Exception {
  File target=file(name),parent=target.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Ошибка каталога");
  File temp=new File(parent,target.getName()+"."+UUID.randomUUID()+".partial");
  try(DiskBudget.Lease space=budget==null?DiskBudget.unlimited():budget.reserve(bytes.length)){try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}cancelled();sync.replace(temp,target);sync.sync(parent);}finally{if(temp.exists())temp.delete();}
 }
 public void json(String name,JSONObject value) throws Exception {atomic(name,value.toString().getBytes("UTF-8"));}
 public JSONObject status(){try{return new JSONObject(new String(read(file("status.json"),65536),"UTF-8"));}catch(Exception e){return new JSONObject();}}
 public void cleanupPartials() throws Exception {
  for(String directory:new String[]{"","database","media","manifests"}){File folder=directory.isEmpty()?root:file(directory);File[] entries=folder.listFiles();if(entries==null)continue;for(File entry:entries)if(entry.isFile()&&entry.getName().matches("(status\\.json|[0-9]{4}-[0-9]{2}-[0-9]{2}\\.(json|candidate\\.fgqueue)|[a-fA-F0-9-]+-[a-f0-9]{64}\\.fgarchive)\\.[a-fA-F0-9-]{36}\\.partial")){File safe=file((directory.isEmpty()?"":directory+"/")+entry.getName());if(!safe.delete())throw new IOException("Не удалось очистить прерванную временную запись");sync.sync(folder);}}
 }
 public static String day(String iso) throws Exception {
  if(iso==null||iso.length()<10)throw new IOException("Сервер не указал суточную дату");
  SimpleDateFormat input=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);input.setLenient(false);input.setTimeZone(TimeZone.getTimeZone("Asia/Yekaterinburg"));
  String date=iso.substring(0,10);if(!input.format(input.parse(date)).equals(date))throw new IOException("Неверная суточная дата");return date;
 }
 static boolean uuid(String s){return s.matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}");}
 static void meta(JSONObject m) throws Exception {
  long bytes=m.getLong("bytes");if(!m.getString("sha256").matches("[a-f0-9]{64}")||bytes<1||bytes>64L*1024*1024)throw new IOException("Неверные параметры архива");
 }
 private File ensure(JSONObject m,String path) throws Exception {
  meta(m);File target=file(path);if(target.isFile()&&target.length()==m.getLong("bytes")&&hash(target).equals(m.getString("sha256")))return target;
  File parent=target.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Ошибка каталога архива");
  File partial=new File(parent,target.getName()+"."+UUID.randomUUID()+".partial");
  try(DiskBudget.Lease space=budget==null?DiskBudget.unlimited():budget.reserve(m.getLong("bytes"))) {
   long count=0;MessageDigest digest=MessageDigest.getInstance("SHA-256");
   try(InputStream in=remote.download(m.getString("url"));FileOutputStream out=new FileOutputStream(partial)){
    byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){cancelled();count+=n;if(count>m.getLong("bytes"))throw new IOException("Размер архива не совпал");digest.update(b,0,n);out.write(b,0,n);}out.getFD().sync();
   }
   if(count!=m.getLong("bytes")||!hex(digest.digest()).equals(m.getString("sha256")))throw new IOException("Контрольная сумма архива не совпала");
   Archive.header(partial);cancelled();sync.replace(partial,target);sync.sync(parent);return target;
  }finally{if(partial.exists())partial.delete();}
 }
 private String dbName(JSONObject s) throws Exception {return "database/"+s.getString("id")+"-"+s.getString("sha256")+".fgarchive";}
 private String mediaName(JSONObject s) throws Exception {return "media/"+s.getString("id")+"-"+s.getString("sha256")+".fgarchive";}
 private JSONObject clean(JSONObject value) throws Exception {JSONObject out=new JSONObject(value.toString());out.remove("url");out.remove("device_token");return out;}
 private List<JSONObject> manifests() throws Exception {
  List<JSONObject> out=new ArrayList<>();File directory=file("manifests");File[] files=directory.listFiles();if(files==null)return out;
  for(File f:files)if(f.getName().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json")){
   JSONObject m=new JSONObject(new String(read(f,4*1024*1024),"UTF-8"));if(m.getInt("format")!=2||!m.getBoolean("complete")||!f.getName().equals(day(m.getString("day"))+".json"))throw new IOException("Повреждён локальный манифест; очистка отменена");out.add(m);
  }
  Collections.sort(out,(a,b)->b.optString("day").compareTo(a.optString("day")));return out;
 }
 private void prune() throws Exception {
  List<JSONObject> all=manifests();if(all.size()<=7)return;
  // Compute references first. A malformed manifest must not authorize any deletion.
  Set<String> retained=new HashSet<>();for(int i=0;i<7;i++){JSONObject m=all.get(i),s=m.getJSONObject("snapshot");String archive=m.getString("archive_file");File db=file(archive);if(!db.isFile()||db.length()!=s.getLong("bytes")||!hash(db).equals(s.getString("sha256")))throw new IOException("Сохранённый резерв повреждён; ротация отменена");retained.add(archive);JSONArray media=m.getJSONArray("media");for(int j=0;j<media.length();j++){JSONObject r=media.getJSONObject(j);File f=file(r.getString("file"));if(!f.isFile()||f.length()!=r.getLong("bytes")||!hash(f).equals(r.getString("sha256")))throw new IOException("Сохранённый файл повреждён; ротация отменена");retained.add(r.getString("file"));}}
  List<String> obsolete=new ArrayList<>();
  for(int i=7;i<all.size();i++){
   JSONObject old=all.get(i);File manifest=file("manifests/"+old.getString("day")+".json");cancelled();
   if(!manifest.delete())throw new IOException("Не удалось удалить старый манифест");sync.sync(manifest.getParentFile());
   obsolete.add(old.getString("archive_file"));JSONArray media=old.getJSONArray("media");for(int j=0;j<media.length();j++)obsolete.add(media.getJSONObject(j).getString("file"));
  }
  for(String path:obsolete)if(!retained.contains(path)&&path.matches("(database|media)/[a-fA-F0-9-]+-[a-f0-9]{64}\\.fgarchive")){cancelled();File f=file(path);if(f.exists()&&!f.delete())throw new IOException("Не удалось удалить старый архив");}
 }
 public JSONObject run() throws Exception {
  try(RandomAccessFile guard=new RandomAccessFile(file("replica.lock"),"rw");FileChannel channel=guard.getChannel()){
   FileLock lock;try{lock=channel.tryLock();}catch(OverlappingFileLockException busy){return status();}if(lock==null)return status();
   try{cleanupPartials();return lockedRun();}finally{lock.release();}
  }
 }
 private JSONObject lockedRun() throws Exception {
  JSONObject state=status();JSONObject selected=null;int present=0;boolean legacy=false;
  try {
   List<JSONObject> history=new ArrayList<>();
   try {JSONObject response=remote.call("history",new JSONObject());JSONArray list=response.getJSONArray("snapshots");Set<String> days=new HashSet<>();
    for(int i=0;i<list.length();i++){JSONObject s=list.getJSONObject(i);String d=day(s.getString("day"));if(!days.add(d)||history.size()>=7)throw new IOException("Неверная суточная история");history.add(s);}
   }catch(ApiError e){if(!e.unsupportedHistory())throw e;legacy=true;JSONObject latest=remote.call("latest",new JSONObject());if(!latest.optBoolean("pending")){latest.put("day",legacyDay(latest.getString("created_at")));history.add(latest);}}
   if(history.isEmpty()){state.put("status","server_preparing").put("error","Сервер пока не подготовил суточную копию").put("history_supported",!legacy);json("status.json",state);return state;}
   // Oldest first: an interrupted catch-up never discards the last good day.
   Collections.sort(history,(a,b)->a.optString("day").compareTo(b.optString("day")));
   for(JSONObject entry:history){
    cancelled();selected=legacy?entry:remote.call("snapshot",new JSONObject().put("snapshot_id",entry.getString("id")));present=0;
    if(!uuid(selected.getString("id"))||!selected.getString("id").equals(entry.getString("id")))throw new IOException("Неверный снимок сервера");
    String date=day(entry.getString("day"));if(!legacy&&(!date.equals(day(selected.getString("day")))||selected.optString("completed_at").isEmpty()))throw new IOException("Суточная копия не завершена");
    selected.put("day",date);JSONArray media=selected.getJSONArray("media");if(media.length()!=selected.getInt("media_expected"))throw new IOException("Сервер ещё подготавливает файлы снимка");
    File db=ensure(selected,dbName(selected));Archive.belongs(db,"database",selected.getString("id"),selected.getString("key_id"));
    JSONArray references=new JSONArray();List<File> mediaFiles=new ArrayList<>();Set<String> ids=new HashSet<>();
    for(int i=0;i<media.length();i++){
     JSONObject f=media.getJSONObject(i);if(!f.getString("id").matches("[a-f0-9]{64}")||!ids.add(f.getString("id")))throw new IOException("Неверный список файлов");
     String name=mediaName(f);File target=file(name);
     if(!target.isFile()||target.length()!=f.getLong("bytes")||!hash(target).equals(f.getString("sha256"))){
      JSONObject signed=remote.call("media",new JSONObject().put("id",f.getString("id")).put("snapshot_id",selected.getString("id")));
      if(!signed.getString("id").equals(f.getString("id"))||!signed.getString("sha256").equals(f.getString("sha256"))||signed.getLong("bytes")!=f.getLong("bytes"))throw new IOException("Файл не относится к выбранному снимку");target=ensure(signed,name);
     }
     Archive.belongs(target,"media",f.getString("id"),f.getString("key_id"));mediaFiles.add(target);references.put(clean(f).put("file",name));present++;
    }
    JSONObject restored=recovery==null?null:recovery.verify(db,selected,mediaFiles);boolean verified=restored!=null&&restored.optBoolean("verified");
    JSONObject local=new JSONObject().put("format",2).put("complete",true).put("day",date).put("snapshot",clean(selected).put("media",new JSONArray(references.toString()))).put("archive_file",dbName(selected)).put("media",references).put("verified",verified).put("completed_locally_at",System.currentTimeMillis());if(restored!=null)local.put("recovery",restored);
    File previousFile=file("manifests/"+date+".json");if(previousFile.isFile()){JSONObject previous=new JSONObject(new String(read(previousFile,4*1024*1024),"UTF-8"));JSONObject old=previous.getJSONObject("snapshot");if(old.getString("id").equals(selected.getString("id"))&&old.getString("sha256").equals(selected.getString("sha256")))local.put("completed_locally_at",previous.getLong("completed_locally_at"));}
    cancelled();json("manifests/"+date+".json",local);
    List<JSONObject> saved=manifests();JSONArray days=new JSONArray();for(JSONObject m:saved)days.put(m.getString("day"));
    state.put("last_day",saved.get(0).getString("day")).put("retained_days",days).put("verified",verified).put("history_supported",!legacy).put("status",legacy?"legacy_latest":"current").put("error","");json("status.json",state);
    remote.call("receipt",new JSONObject().put("snapshot_id",selected.getString("id")).put("day",date).put("retained_days",days).put("media_present",present).put("media_expected",media.length()).put("verified",verified));
   }
   // No prune on empty history, unsupported history, download, restore, receipt or disk error.
   if(!legacy&&history.size()>=7)prune();List<JSONObject> saved=manifests();JSONArray days=new JSONArray();for(JSONObject m:saved)days.put(m.getString("day"));state.put("retained_days",days);json("status.json",state);return state;
  }catch(Exception error){
   state.put("status","error").put("error",safeError(error));try{json("status.json",state);}catch(Exception ignored){}
   if(selected!=null&&!Thread.currentThread().isInterrupted())try{remote.call("receipt",new JSONObject().put("snapshot_id",selected.getString("id")).put("day",selected.optString("day")).put("media_present",present).put("media_expected",selected.getInt("media_expected")).put("verified",false).put("error",safeError(error)));}catch(Exception ignored){}
   throw error;
  }
 }
 public static String safeError(Exception e){if(e instanceof ApiError){int s=((ApiError)e).status;return s==401?"Нужен повторный вход; копии сохранены":s==403?"Доступ отключён; копии сохранены":"Сервер резервов: HTTP "+s;}if(e instanceof java.net.SocketTimeoutException||e instanceof java.net.UnknownHostException)return "Нет связи; прежние копии сохранены";return e instanceof IOException&&e.getMessage()!=null&&!e.getMessage().contains("://")?e.getMessage():"Резервирование не завершено; прежние копии сохранены";}
 public static String legacyDay(String iso) throws Exception {SimpleDateFormat in=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",Locale.ROOT);in.setTimeZone(TimeZone.getTimeZone("UTC"));Date date=in.parse(iso);SimpleDateFormat out=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);out.setTimeZone(TimeZone.getTimeZone("Asia/Yekaterinburg"));return out.format(date);}
}
