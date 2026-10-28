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
 private void ready(ActivityScenario<MainActivity> scenario)throws Exception{for(int i=0;i<100;i++){if("true".equals(js(scenario,"!!document.querySelector('#login input')")))return;Thread.sleep(150);}fail("Bundled login did not render");}
 @Test public void installedOfflineScreensTypingAndSavedState()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   ready(scenario);assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));
   assertEquals("true",js(scenario,"location.href.startsWith('https://appassets.androidplatform.net/assets/fastgo/')"));
   js(scenario,"document.querySelector('#login input').focus();localStorage.setItem('fastgo-phone-smoke','kept');true");
   scenario.onActivity(a->{WebView w=a.findViewById(14001);w.requestFocus();});
   InstrumentationRegistry.getInstrumentation().sendStringSync("typing123");
   assertEquals("\"typing123\"",js(scenario,"document.querySelector('#login input').value"));
   assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));
   scenario.recreate();ready(scenario);assertEquals("\"kept\"",js(scenario,"localStorage.getItem('fastgo-phone-smoke')"));
   scenario.onActivity(a->((WebView)a.findViewById(14001)).loadUrl(MainActivity.ORIGIN+MainActivity.PREFIX+"warehouse.html?unified=1"));ready(scenario);assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));assertEquals("true",js(scenario,"!!document.querySelector('#login input[type=password]')"));
  }
 }
 @Test public void navigationKeepsUntrustedPagesOutsideApp(){assertTrue(MainActivity.internal(Uri.parse(MainActivity.HOME)));assertFalse(MainActivity.internal(Uri.parse("https://example.com/assets/fastgo/workshop.html")));assertFalse(MainActivity.internal(Uri.parse("http://appassets.androidplatform.net/assets/fastgo/workshop.html")));assertFalse(MainActivity.internal(Uri.parse("file:///sdcard/workshop.html")));}
}
