package ru.fastgo.backup;

import android.content.*;
import android.security.keystore.*;
import android.system.*;
import android.util.Base64;
import java.io.*;
import java.security.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** AES keys and RSA private recovery keys never leave Android Keystore. */
public final class AndroidVault {
 private final SharedPreferences prefs;private final String alias;
 public AndroidVault(Context context,String name){prefs=context.getSharedPreferences(name,Context.MODE_PRIVATE);alias=name;}
 public static synchronized javax.crypto.SecretKey aes(String alias) throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(store.containsAlias(alias))return (javax.crypto.SecretKey)store.getKey(alias,null);
  KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return gen.generateKey();
 }
 public String get(String name) throws Exception {
  String raw=prefs.getString(name,"");if(raw.isEmpty())return "";String[] pair=raw.split(":",2);if(pair.length!=2)throw new IOException("Не удалось открыть защищённое хранилище");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,aes(alias),new GCMParameterSpec(128,Base64.decode(pair[0],Base64.NO_WRAP)));return new String(c.doFinal(Base64.decode(pair[1],Base64.NO_WRAP)),"UTF-8");
 }
 public void put(String name,String plain) throws Exception {
  if(plain==null){if(!prefs.edit().remove(name).commit())throw new IOException("Ошибка сохранения сессии");return;}
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,aes(alias));String data=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(plain.getBytes("UTF-8")),Base64.NO_WRAP);if(!prefs.edit().putString(name,data).commit())throw new IOException("Ошибка защищённого хранилища");
 }
 public static synchronized KeyStore.PrivateKeyEntry rsa(String alias) throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);if(!store.containsAlias(alias)){
   KeyPairGenerator gen=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA,"AndroidKeyStore");gen.initialize(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_DECRYPT).setKeySize(2048).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP).setDigests(KeyProperties.DIGEST_SHA256,KeyProperties.DIGEST_SHA1).build());gen.generateKeyPair();
  }return (KeyStore.PrivateKeyEntry)store.getEntry(alias,null);
 }
 public static void syncDirectory(File directory) throws Exception {FileDescriptor fd=Os.open(directory.getPath(),OsConstants.O_RDONLY,0);try{Os.fsync(fd);}finally{Os.close(fd);}}
 public static final BackupReplica.DirectorySync DURABLE=new BackupReplica.DirectorySync(){
  public void sync(File directory) throws Exception {syncDirectory(directory);}
  public void replace(File from,File to) throws Exception {Os.rename(from.getPath(),to.getPath());}
 };
 public static DiskBudget budget(Context c) throws IOException {return new DiskBudget(java.util.Arrays.asList(new File(c.getFilesDir(),"server-backups"),new File(c.getFilesDir(),"server-backups-tsd"),new File(c.getFilesDir(),"local-queue-backups"),new File(c.getCacheDir(),"backup-restore")),c.getFilesDir());}
 public static String spaceStatus(Context c,String summary){try{budget(c).preflight(0);return summary;}catch(Exception e){return summary+"\nНедостаточно места: резервирование остановлено, прежние копии сохранены";}}
}
