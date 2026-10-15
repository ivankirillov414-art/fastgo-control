package ru.fastgo.terminal;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.net.Uri;
public final class MainActivity extends Activity {
 private WebView web;
 private static final String HOME="https://ivankirillov414-art.github.io/fastgo-control/warehouse-terminal.html";
 @Override public void onCreate(Bundle state){super.onCreate(state);web=new WebView(this);setContentView(web);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);
 web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){return !allowed(r.getUrl());}@Override public boolean shouldOverrideUrlLoading(WebView view,String url){return !allowed(Uri.parse(url));}});
 // Keyboard-wedge scanners enter text into the focused scan field and send Enter.
 // No global key capture: quantity fields and passwords keep their normal keyboard behaviour.
 if(state==null)web.loadUrl(HOME);else web.restoreState(state);
 }
 private boolean allowed(Uri u){return "https".equals(u.getScheme())&&"ivankirillov414-art.github.io".equals(u.getHost())&&"/fastgo-control/warehouse-terminal.html".equals(u.getPath());}
 @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);web.saveState(state);}
 @Override public void onBackPressed(){web.evaluateJavascript("document.getElementById('back')?.click()",null);}
}
