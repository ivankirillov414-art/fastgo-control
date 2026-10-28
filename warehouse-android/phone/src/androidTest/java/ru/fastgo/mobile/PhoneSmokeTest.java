package ru.fastgo.mobile;
import android.webkit.WebView;
import android.net.Uri;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class PhoneSmokeTest {
 private String js(ActivityScenario<MainActivity> scenario,String code)throws Exception{CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();scenario.onActivity(a->((WebView)a.findViewById(14001)).evaluateJavascript(code,r->{value.set(r);latch.countDown();}));assertTrue("JavaScript callback",latch.await(10,TimeUnit.SECONDS));return value.get();}
 private void ready(ActivityScenario<MainActivity> scenario)throws Exception{ready(scenario,"workshop.html");}
 private void ready(ActivityScenario<MainActivity> scenario,String page)throws Exception{for(int i=0;i<100;i++){if("true".equals(js(scenario,"location.pathname.endsWith('"+page+"') && document.readyState==='complete' && !!document.querySelector('#login input')"))){Thread.sleep(200);return;}Thread.sleep(150);}fail("Bundled login did not render: "+page);}
 @Test public void installedOfflineScreensTypingAndSavedState()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   ready(scenario);assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));
   android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertEquals(JSONObject.quote(context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionName),js(scenario,"window.fastgoInstalledApp.version"));
   assertEquals("true",js(scenario,"location.href.startsWith('https://appassets.androidplatform.net/assets/fastgo/')"));
   assertEquals("true",js(scenario,"typeof window.fastgoRequestAppUpdate==='function' && typeof FastGoPhone.checkUpdate==='function'"));
   js(scenario,"document.querySelector('#login input').focus();localStorage.setItem('fastgo-phone-smoke','kept');true");
   scenario.onActivity(a->{WebView w=a.findViewById(14001);w.requestFocus();});
   InstrumentationRegistry.getInstrumentation().sendStringSync("typing123");
   InstrumentationRegistry.getInstrumentation().waitForIdleSync();for(int i=0;i<40;i++){if("\"typing123\"".equals(js(scenario,"document.querySelector('#login input').value")))break;Thread.sleep(50);}
   assertEquals("\"typing123\"",js(scenario,"document.querySelector('#login input').value"));
   assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));
   scenario.recreate();ready(scenario);assertEquals("\"kept\"",js(scenario,"localStorage.getItem('fastgo-phone-smoke')"));
   scenario.onActivity(a->((WebView)a.findViewById(14001)).loadUrl(MainActivity.ORIGIN+MainActivity.PREFIX+"warehouse.html?unified=1"));ready(scenario,"warehouse.html");assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));assertEquals("true",js(scenario,"!!document.querySelector('#login input[type=password]')"));
  }
 }
 @Test public void installedEquipmentCatalogueHasDatedSourcePrices()throws Exception{
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String text;
  try(java.io.InputStream in=context.getAssets().open("fastgo/warehouse/equipment-data.js");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);text=out.toString("UTF-8");}
  String marker="export const equipmentData=";String json=text.substring(text.indexOf(marker)+marker.length()).trim();JSONObject data=new JSONObject(json.substring(0,json.length()-1));assertEquals("RUB",data.getString("currency"));assertEquals(2440,data.getJSONArray("items").length());assertEquals("2026-10-28",data.getString("checked_at"));
  JSONObject item=data.getJSONArray("items").getJSONObject(0),offer=item.getJSONArray("offers").getJSONObject(0);assertTrue(offer.getDouble("price")>=500);assertTrue(offer.getString("url").startsWith("https://"));assertFalse(item.has("quantity"));assertFalse(item.has("unit_cost"));
 }
 @Test public void navigationKeepsUntrustedPagesOutsideApp(){assertTrue(MainActivity.internal(Uri.parse(MainActivity.HOME)));assertFalse(MainActivity.internal(Uri.parse("https://example.com/assets/fastgo/workshop.html")));assertFalse(MainActivity.internal(Uri.parse("http://appassets.androidplatform.net/assets/fastgo/workshop.html")));assertFalse(MainActivity.internal(Uri.parse("file:///sdcard/workshop.html")));}
 @Test public void updaterRejectsTamperedAndNonIncreasingApk()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   ready(scenario);java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();scenario.onActivity(a->{PhoneUpdates updater=new PhoneUpdates(a,(WebView)a.findViewById(14001));try{java.io.File file=new java.io.File(a.getApplicationInfo().sourceDir);JSONObject meta=new JSONObject().put("sha256","invalid");try{updater.verify(file,meta);failure.set(new AssertionError("Tampered APK accepted"));}catch(java.io.IOException expected){}java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");try(java.io.InputStream in=new java.io.FileInputStream(file)){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));android.content.pm.PackageInfo own=a.getPackageManager().getPackageInfo(a.getPackageName(),0);meta.put("sha256",hash.toString()).put("versionCode",own.versionCode).put("versionName",own.versionName);try{updater.verify(file,meta);failure.set(new AssertionError("Same version APK accepted"));}catch(java.io.IOException expected){} }catch(Throwable e){failure.set(e);}finally{updater.close();}});if(failure.get()!=null)throw new AssertionError(failure.get());
  }
 }
 @Test public void installerUsesOwnPackageAndPrivateCallback()throws Exception{
  android.content.Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();android.content.pm.PackageInstaller.SessionParams params=PhoneInstaller.parameters(c,123);assertNotNull(params);
  android.content.pm.ActivityInfo callback=c.getPackageManager().getReceiverInfo(new android.content.ComponentName(c,PhoneInstallReceiver.class),0);assertFalse("Installer callback must not be callable by other apps",callback.exported);
  if(android.os.Build.VERSION.SDK_INT>=31)assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,c.checkSelfPermission("android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION"));
 }
}
