package ru.fastgo.backup;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.security.*;
import java.security.spec.MGF1ParameterSpec;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.util.*;

/** Verification rebuilds an in-memory database; decrypted rows never become disk files. */
public final class OwnerRecovery implements BackupReplica.Recovery {
 private final KeyStore.PrivateKeyEntry rsa;private final String device,publicHash;private final File cache;private final DiskBudget budget;
 public OwnerRecovery(KeyStore.PrivateKeyEntry rsa,String device,File cache,DiskBudget budget) throws Exception {this.rsa=rsa;this.device=device;this.cache=cache;this.budget=budget;if(!cache.isDirectory()&&!cache.mkdirs())throw new IOException("Не удалось подготовить проверку восстановления");this.publicHash=BackupReplica.hash(rsa.getCertificate().getPublicKey().getEncoded());}
 @Override public JSONObject verify(File file,JSONObject snapshot,List<File> media) throws Exception {
  JSONArray boxes=snapshot.getJSONArray("key_boxes");JSONObject box=null;for(int i=0;i<boxes.length();i++){JSONObject b=boxes.getJSONObject(i);if(device.equals(b.optString("device_id"))&&publicHash.equals(b.optString("public_key_sha256"))&&snapshot.getString("key_id").equals(b.optString("key_id")))box=b;}
  if(box==null)return new JSONObject().put("verified",false).put("reason","Нет коробки ключа для этого владельца");
  byte[] aes=null;
  try {
   try{Cipher unwrap=Cipher.getInstance("RSA/ECB/OAEPPadding");unwrap.init(Cipher.DECRYPT_MODE,rsa.getPrivateKey(),new OAEPParameterSpec("SHA-256","MGF1",MGF1ParameterSpec.SHA256,PSource.PSpecified.DEFAULT));aes=unwrap.doFinal(Base64.decode(box.getString("wrapped_key"),Base64.NO_WRAP));}
   catch(BadPaddingException|IllegalBlockSizeException corrupt){throw new IOException("Повреждена коробка ключа восстановления");}
   catch(GeneralSecurityException unavailable){return new JSONObject().put("verified",false).put("reason","Keystore устройства не поддерживает восстановление RSA-OAEP/SHA256; сохранён зашифрованный резерв");}
   if(aes.length!=32)throw new IOException("Неверный ключ восстановления");SecretKeySpec key=new SecretKeySpec(aes,"AES");byte[] plain=Archive.decrypt(file,key,Base64.decode(Archive.header(file).meta.getString("iv"),Base64.NO_WRAP));JSONObject restored;
   try{restored=validateDatabase(plain,snapshot,cache,budget);}finally{Arrays.fill(plain,(byte)0);}
   for(File f:media){JSONObject header=Archive.header(f).meta;plain=Archive.decrypt(f,key,Base64.decode(header.getString("iv"),Base64.NO_WRAP));try{if(!BackupReplica.hash(plain).equals(header.getString("plain_sha256")))throw new IOException("Не прошло восстановление файла");}finally{Arrays.fill(plain,(byte)0);}}
   return restored.put("verified",true);
  }finally{if(aes!=null)Arrays.fill(aes,(byte)0);}
 }
 public static JSONObject validateDatabase(byte[] plain,JSONObject expected,File cache) throws Exception {
  return validateDatabase(plain,expected,cache,null);
 }
 public static JSONObject validateDatabase(byte[] plain,JSONObject expected,File cache,DiskBudget budget) throws Exception {
  JSONObject data=new JSONObject(new String(plain,"UTF-8")),sheets=data.getJSONObject("native").getJSONObject("sheets"),tables=new JSONObject(data.getJSONObject("tables").toString());
  JSONObject project=data.optJSONObject("project_tables");if(project!=null){Iterator<String> extra=project.keys();while(extra.hasNext()){String name=extra.next();if(tables.has(name))throw new IOException("Повтор таблицы в архиве");tables.put(name,project.getJSONArray(name));}}
  if(data.getInt("format")!=1||data.getLong("source_version")!=expected.getLong("source_version")||sheets.length()<10)throw new IOException("Неполная база в архиве");
  if(budget!=null)budget.preflight(0);SQLiteDatabase db=null;long nativeRows=0,rawRows=0;
  try{db=SQLiteDatabase.create(null);db.execSQL("CREATE TABLE recovered(sheet TEXT,row_no INTEGER,data TEXT,PRIMARY KEY(sheet,row_no))");db.execSQL("CREATE TABLE raw_recovered(name TEXT,row_no INTEGER,data TEXT,PRIMARY KEY(name,row_no))");db.beginTransaction();try{
   Iterator<String> keys=sheets.keys();while(keys.hasNext()){String name=keys.next();JSONObject sheet=sheets.getJSONObject(name);sheet.getJSONArray("headers");JSONArray rows=sheet.getJSONArray("rows");for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);long number=row.getLong("__row");if(number<2)throw new IOException("Неверная строка базы");db.execSQL("INSERT INTO recovered VALUES(?,?,?)",new Object[]{name,number,row.toString()});nativeRows++;}}
   keys=tables.keys();while(keys.hasNext()){String name=keys.next();if(!name.matches("(public|auth)\\.[a-zA-Z_][a-zA-Z0-9_]*"))throw new IOException("Неверная таблица базы");JSONArray rows=tables.getJSONArray(name);for(int i=0;i<rows.length();i++){db.execSQL("INSERT INTO raw_recovered VALUES(?,?,?)",new Object[]{name,i,rows.getJSONObject(i).toString()});rawRows++;}}
   JSONArray files=data.getJSONArray("media");Set<String> ids=new HashSet<>();for(int i=0;i<files.length();i++)if(!ids.add(files.getJSONObject(i).getString("id")))throw new IOException("Повтор файла в резерве");if(files.length()!=expected.getInt("media_expected"))throw new IOException("Неполный список файлов базы");db.setTransactionSuccessful();
  }finally{db.endTransaction();}
  try(Cursor c=db.rawQuery("PRAGMA integrity_check",null)){if(!c.moveToFirst()||!"ok".equals(c.getString(0)))throw new IOException("Не прошла проверка восстановленной базы");}return new JSONObject().put("native_rows",nativeRows).put("raw_rows",rawRows).put("tables",tables.length());
  }finally{if(db!=null)db.close();}
 }
}
