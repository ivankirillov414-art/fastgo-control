package ru.fastgo.backup;

import org.json.*;
import java.io.*;
import java.util.*;
import java.util.zip.GZIPInputStream;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

public final class Archive {
 public static final class Header {public JSONObject meta;public byte[] aad;public int offset;}
 public static Header header(File f) throws Exception {
  try(InputStream in=new FileInputStream(f)){ByteArrayOutputStream prefix=new ByteArrayOutputStream();int c;while((c=in.read())!=-1&&c!=10&&prefix.size()<30)prefix.write(c);if(!"FGARCHIVE1".equals(prefix.toString("UTF-8")))throw new IOException("Неизвестный формат архива");prefix.reset();while((c=in.read())!=-1&&c!=10&&prefix.size()<10)prefix.write(c);
   int n;try{n=Integer.parseInt(prefix.toString("UTF-8"));}catch(Exception e){throw new IOException("Повреждён заголовок архива");}if(n<1||n>8192||f.length()<n+30)throw new IOException("Повреждён заголовок архива");byte[] aad=new byte[n];new DataInputStream(in).readFully(aad);Header h=new Header();h.meta=new JSONObject(new String(aad,"UTF-8"));h.aad=aad;h.offset=11+prefix.size()+1+n;if(h.meta.getInt("format")!=1)throw new IOException("Неверная версия архива");return h;
  }
 }
 public static void belongs(File f,String kind,String id,String key) throws Exception {JSONObject m=header(f).meta;if(!kind.equals(m.getString("kind"))||!id.equals(m.getString("id"))||!key.equals(m.getString("key_id")))throw new IOException("Архив относится к другому снимку или ключу");}
 public static byte[] decrypt(File file,javax.crypto.SecretKey key,byte[] iv) throws Exception {
  Header h=header(file);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));cipher.updateAAD(h.aad);
  try(FileInputStream in=new FileInputStream(file)){in.getChannel().position(h.offset);ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[65536];int n;while((n=in.read(block))!=-1){BackupReplica.cancelled();byte[] b=cipher.update(block,0,n);if(b!=null)out.write(b);if(out.size()>256*1024*1024)throw new IOException("Архив слишком большой");}out.write(cipher.doFinal());byte[] plain=out.toByteArray();String compression=h.meta.optString("compression");if(compression.isEmpty())return plain;if(!"gzip".equals(compression))throw new IOException("Неподдерживаемое сжатие");try(GZIPInputStream zip=new GZIPInputStream(new ByteArrayInputStream(plain));ByteArrayOutputStream expanded=new ByteArrayOutputStream()){while((n=zip.read(block))!=-1){if(expanded.size()+n>256*1024*1024)throw new IOException("Распакованный архив слишком большой");expanded.write(block,0,n);}return expanded.toByteArray();}finally{Arrays.fill(plain,(byte)0);}}
 }
 private Archive(){}
}
