package ru.fastgo.tsd;
import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;import org.junit.runner.RunWith;import static org.junit.Assert.*;import android.content.Context;import org.json.*;import java.io.*;import java.security.*;import java.util.*;
@RunWith(AndroidJUnit4.class) public final class UpgradeTest {
 @Test public void stagesRealSignedApkOnlyAfterDocumentsClose()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext(),test=InstrumentationRegistry.getInstrumentation().getContext();byte[] apk;try(InputStream in=test.getAssets().open("update-fixture.apk")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);apk=out.toByteArray();}
  StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(apk))hash.append(String.format(Locale.ROOT,"%02x",b&255));
  JSONObject managed=new JSONObject().put("package",context.getPackageName()).put("versionCode",6).put("versionName","2.1.3").put("url","https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/native/FastGo-TSD-2.1.3.apk").put("sha256",hash.toString());JSONObject meta=new JSONObject().put("package","ru.fastgo.tsd").put("versionCode",1).put("channels",new JSONObject().put(context.getPackageName(),managed));int[] downloads={0};
  try(LocalStore store=new LocalStore(context)){
   for(JSONObject doc:store.pending()){store.requestCancel(doc.getString("id"));store.complete(doc.getString("id"),doc.getInt("revision"));}
   store.put("active_document","");String id=store.open("receipt").getString("id");store.scan(id,"UPDATE-BLOCKING-SCAN");
   AppUpdates updates=new AppUpdates(context,store,(url,limit)->{if(url.contains(".json"))return meta.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);downloads[0]++;return apk;});
   assertTrue(updates.check(true).contains("незакрытые"));assertEquals(0,downloads[0]);assertFalse(updates.ready());
   store.requestCancel(id);store.complete(id,store.doc(id).getInt("revision"));updates.check(false);assertTrue(updates.ready());assertEquals(1,downloads[0]);
   store.put("upgrade-proof","retained-database");new SecurePrefs(context).put("upgrade-proof","retained-encrypted-value");
  }
 }
 @Test public void keepsDataAfterInstall()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();Assume.assumeTrue(context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionCode==6);
  try(LocalStore store=new LocalStore(context)){assertEquals("retained-database",store.get("upgrade-proof"));assertEquals("retained-encrypted-value",new SecurePrefs(context).get("upgrade-proof"));}
 }
}
