package ru.fastgo.mobile;

import android.graphics.Bitmap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PhoneTaskNavigationTest {
 private static String read(InputStream input) throws Exception {
  try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()) {byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);return out.toString("UTF-8");}
 }
 private String js(ActivityScenario<MainActivity> scenario,String code) throws Exception {
  CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
  scenario.onActivity(activity->((WebView)activity.findViewById(14001)).evaluateJavascript(code,value->{result.set(value);latch.countDown();}));
  assertTrue("WebView JavaScript callback",latch.await(10,TimeUnit.SECONDS));return result.get();
 }
 private void until(ActivityScenario<MainActivity> scenario,String condition) throws Exception {
  for(int attempt=0;attempt<100;attempt++){if("true".equals(js(scenario,condition)))return;Thread.sleep(150);}
  fail("Installed task interface did not become ready: "+condition+"; "+js(scenario,"document.body.innerText.slice(0,1200)"));
 }
 @Test public void installedMechanicOpensVisibleTasksAndChangesWorkPriceOffline() throws Exception {
  String fixture=read(InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("task-price-fixture.js"));
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   until(scenario,"document.readyState==='complete' && !!document.querySelector('#login input')");
   scenario.onActivity(activity->{
    WebView web=activity.findViewById(14001);WebViewClient original=web.getWebViewClient();
    // Notifications have their own native test matrix. Keep this offline role/UI
    // fixture from registering a fabricated session with the production API.
    web.removeJavascriptInterface("FastGoPhone");
    web.setWebViewClient(new WebViewClient(){
     @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
      if(request.getUrl().getPath().equals(MainActivity.PREFIX+"__phone_task_fixture.js"))return new WebResourceResponse("text/javascript","UTF-8",new ByteArrayInputStream(fixture.getBytes(StandardCharsets.UTF_8)));
      WebResourceResponse response=original.shouldInterceptRequest(view,request);
      if(response!=null&&request.getUrl().getPath().equals(MainActivity.PREFIX+"workshop.html")){
       try{String html=read(response.getData()).replace("</head>","<script src=\"__phone_task_fixture.js\"></script></head>");return new WebResourceResponse(response.getMimeType(),response.getEncoding(),response.getStatusCode(),response.getReasonPhrase(),response.getResponseHeaders(),new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));}
       catch(Exception error){throw new IllegalStateException(error);}
      }
      return response;
     }
     @Override public void onPageFinished(WebView view,String url){original.onPageFinished(view,url);}
     @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return original.shouldOverrideUrlLoading(view,request);}
    });
    web.loadUrl(MainActivity.HOME+"#account");
   });
   until(scenario,"!!window.phoneTaskFixture && !!document.querySelector('.mobile-nav a[href=\"#tasks\"]')");
   assertEquals("true",js(scenario,"(()=>{const a=document.querySelector('.mobile-nav a[href=\"#tasks\"]');return innerWidth<=760 && a.getBoundingClientRect().width>0 && a.getBoundingClientRect().height>0;})()"));
   js(scenario,"document.querySelector('.mobile-nav a[href=\"#tasks\"]').click();true");
   until(scenario,"!!document.querySelector('.task-link')");js(scenario,"document.querySelector('.task-link').click();true");
   until(scenario,"!!document.querySelector('[data-scope=works]') && !!document.querySelector('[data-edit-price]')");
   js(scenario,"document.querySelector('[data-edit-price]').click();true");until(scenario,"!!document.querySelector('#modal-form [name=labor_price]')");
   js(scenario,"document.querySelector('#modal-form [name=labor_price]').value='750';document.querySelector('#modal-form [type=submit]').click();true");
   until(scenario,"window.phoneTaskFixture.price===750 && window.phoneTaskFixture.saves===1 && !document.querySelector('dialog[open]')");
   assertEquals("true",js(scenario,"document.querySelector('#task-prices').innerText.includes('750') && document.documentElement.scrollWidth<=innerWidth+1"));
   assertEquals("[]",js(scenario,"window.phoneTaskFixture.errors"));
   assertEquals("true",js(scenario,"location.href.startsWith('https://appassets.androidplatform.net/assets/fastgo/') && window.fastgoInstalledApp.bundled===true"));
   File output=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"task-prices.png");
   Bitmap screenshot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();assertNotNull(screenshot);
   try(FileOutputStream stream=new FileOutputStream(output)){assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG,100,stream));}finally{screenshot.recycle();}
   js(scenario,"localStorage.removeItem('fastgo_workshop_session');true");
  }
 }
}
