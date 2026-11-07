package ru.fastgo.tsd;
import android.content.Context;
import android.util.Base64;
import ru.fastgo.backup.*;
import org.json.*;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import javax.crypto.*;

/** Logical read transaction includes WAL-backed queue state; never copies an open .db file. */
final class QueueBackup {
 static File root(Context c){return new File(c.getFilesDir(),"local-queue-backups");}
 static String status(Context c){try{JSONObject s=new JSONObject(new String(BackupReplica.read(new File(root(c),"status.json"),65536),"UTF-8"));return "Очередь ТСД: "+s.optString("last_day","ещё не сохранена")+(s.optString("error").isEmpty()?"":"\n"+s.optString("error"));}catch(Exception e){return "Очередь ТСД ещё не сохранена";}}
 static synchronized void run(Context c) throws Exception {
  DiskBudget budget=AndroidVault.budget(c);BackupReplica files=new BackupReplica(root(c),null,null,AndroidVault.DURABLE,budget);JSONObject state=files.status();
  try {
   files.cleanupPartials();File[] candidates=root(c).listFiles((dir,name)->name.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}\\.candidate\\.fgqueue"));if(candidates!=null)for(File candidate:candidates)if(!candidate.delete())throw new IOException("Не удалось убрать прерванный резерв очереди");
   SimpleDateFormat fmt=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);fmt.setTimeZone(TimeZone.getTimeZone("Asia/Yekaterinburg"));String day=fmt.format(new Date());
   File manifest=new File(root(c),day+".json");
   if(manifest.isFile()){JSONObject previous=new JSONObject(new String(BackupReplica.read(manifest,65536),"UTF-8"));File archive=new File(root(c),day+".fgqueue");if(archive.isFile()&&previous.getString("sha256").equals(BackupReplica.hash(archive))){verify(archive,budget);return;}}
   File source=c.getDatabasePath("fastgo-tsd-v1.db");long estimate=Math.max(65536,source.length()+new File(source.getPath()+"-wal").length());budget.preflight(estimate>DiskBudget.LIMIT/8?DiskBudget.LIMIT+1:estimate*8);
   JSONObject snapshot;LocalStore store=new LocalStore(c);try{snapshot=store.backupSnapshot();}finally{store.close();}
   SecretKey key=AndroidVault.aes("fastgo_tsd_queue_v1");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key);
   byte[] header=new JSONObject().put("format",1).put("kind","tsd_queue").put("id",day).put("key_id","fastgo_tsd_queue_v1").put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).toString().getBytes("UTF-8");cipher.updateAAD(header);byte[] plain=snapshot.toString().getBytes("UTF-8"),encrypted;
   try{encrypted=cipher.doFinal(plain);}finally{Arrays.fill(plain,(byte)0);}
   ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(("FGARCHIVE1\n"+header.length+"\n").getBytes("UTF-8"));out.write(header);out.write(encrypted);
   // A separate candidate prevents a failed validation from replacing the last good day.
   File candidate=new File(root(c),day+".candidate.fgqueue");JSONObject check;try{files.atomic(day+".candidate.fgqueue",out.toByteArray());check=verify(candidate,budget);if(!check.toString().equals(snapshot.toString()))throw new IOException("Проверка восстановления очереди не пройдена");}catch(Exception failure){candidate.delete();throw failure;}
   File archive=new File(root(c),day+".fgqueue");AndroidVault.DURABLE.replace(candidate,archive);AndroidVault.syncDirectory(root(c));
   files.json(day+".json",new JSONObject().put("day",day).put("sha256",BackupReplica.hash(archive)).put("bytes",archive.length()).put("verified",true));
   state.put("last_day",day).put("error","");files.json("status.json",state);
   File[] list=root(c).listFiles((dir,name)->name.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json"));if(list!=null){Arrays.sort(list,(a,b)->b.getName().compareTo(a.getName()));for(int i=0;i<Math.min(7,list.length);i++){JSONObject saved=new JSONObject(new String(BackupReplica.read(list[i],65536),"UTF-8"));File f=new File(root(c),list[i].getName().substring(0,10)+".fgqueue");if(!f.isFile()||!saved.getString("sha256").equals(BackupReplica.hash(f)))throw new IOException("Повреждён сохранённый резерв очереди; очистка отменена");}for(int i=7;i<list.length;i++){BackupReplica.cancelled();String old=list[i].getName().substring(0,10);if(!list[i].delete())throw new IOException("Ошибка ротации очереди");File f=new File(root(c),old+".fgqueue");if(f.exists()&&!f.delete())throw new IOException("Ошибка ротации очереди");}}
  }catch(Exception error){try{files.json("status.json",state.put("error",BackupReplica.safeError(error)));}catch(Exception ignored){}throw error;}
 }
 static JSONObject verify(File archive) throws Exception {
  return verify(archive,null);
 }
 static JSONObject verify(File archive,DiskBudget budget) throws Exception {
  JSONObject meta=Archive.header(archive).meta;if(!"tsd_queue".equals(meta.getString("kind"))||!"fastgo_tsd_queue_v1".equals(meta.getString("key_id")))throw new IOException("Неверный резерв очереди");
  byte[] plain=Archive.decrypt(archive,AndroidVault.aes("fastgo_tsd_queue_v1"),Base64.decode(meta.getString("iv"),Base64.NO_WRAP));try{JSONObject snapshot=new JSONObject(new String(plain,"UTF-8"));if(snapshot.getInt("format")!=1)throw new IOException("Неверная версия очереди");JSONObject tables=snapshot.getJSONObject("tables");for(String name:new String[]{"kv","docs","catalog"})tables.getJSONArray(name);
   if(budget!=null)budget.preflight(0);android.database.sqlite.SQLiteDatabase db=null;
   try{db=android.database.sqlite.SQLiteDatabase.create(null);db.execSQL("CREATE TABLE kv(k TEXT PRIMARY KEY,v TEXT NOT NULL)");db.execSQL("CREATE TABLE docs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,v TEXT NOT NULL)");db.execSQL("CREATE TABLE catalog(id TEXT PRIMARY KEY,barcode TEXT,sku TEXT,v TEXT NOT NULL)");db.beginTransaction();try{for(String name:new String[]{"kv","docs","catalog"}){JSONArray rows=tables.getJSONArray(name);for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);android.content.ContentValues values=new android.content.ContentValues();Iterator<String> fields=row.keys();while(fields.hasNext()){String field=fields.next();if(row.isNull(field))values.putNull(field);else values.put(field,row.getString(field));}db.insertOrThrow(name,null,values);}}db.setTransactionSuccessful();}finally{db.endTransaction();}try(android.database.Cursor cursor=db.rawQuery("PRAGMA integrity_check",null)){if(!cursor.moveToFirst()||!"ok".equals(cursor.getString(0)))throw new IOException("Не прошла проверка восстановленной очереди");}}
   finally{if(db!=null)db.close();}return snapshot;
  }finally{Arrays.fill(plain,(byte)0);}
 }
}
