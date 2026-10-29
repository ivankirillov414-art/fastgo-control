package ru.fastgo.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ClipData;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.*;
import java.util.*;

public final class MainActivity extends Activity {
 static final String ORIGIN="https://appassets.androidplatform.net";
 static final String PREFIX="/assets/fastgo/";
 static final String HOME=ORIGIN+PREFIX+"workshop.html";
 private WebView web;
 private PhoneUpdates updates;
 private TaskNotices notices;
 private boolean resumed;
 private boolean noticePermissionPending;
 private ValueCallback<Uri[]> picker;
 private PermissionRequest cameraRequest;
 private WebChromeClient.FileChooserParams pendingChooser;
 private Uri cameraUri;
 private File cameraFile;
 private static final int FILE_PICKER=41;

 private String appVersion(){try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}catch(android.content.pm.PackageManager.NameNotFoundException e){throw new IllegalStateException(e);}}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setStatusBarColor(0xff0b1c2c);getWindow().setNavigationBarColor(0xff0b1c2c);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(0xff0b1c2c);
  if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(i.left,i.top,i.right,i.bottom);return insets;});}else root.setFitsSystemWindows(true);
  web=new WebView(this);web.setId(14001);web.setBackgroundColor(0xff0b1c2c);root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0);
  updates=new PhoneUpdates(this,web);
  notices=new TaskNotices(this,()->runOnUiThread(this::requestNoticePermission));
  web.addJavascriptInterface(new Object(){@JavascriptInterface public void configureNotices(String data){runOnUiThread(()->{if(internal(Uri.parse(web.getUrl()==null?"":web.getUrl())))notices.configure(data);});}@JavascriptInterface public void clearNotices(){runOnUiThread(()->{if(internal(Uri.parse(web.getUrl()==null?"":web.getUrl())))TaskNotices.clear(MainActivity.this);});}@JavascriptInterface public void noticeSettings(){runOnUiThread(()->{if(!internal(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getPackageName()));});}@JavascriptInterface public void checkUpdate(){runOnUiThread(()->{if(internal(Uri.parse(web.getUrl()==null?"":web.getUrl())))updates.check(true);});}@JavascriptInterface public void print(){runOnUiThread(()->{if(!internal(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);manager.print("FastGo",web.createPrintDocumentAdapter("FastGo"),new PrintAttributes.Builder().build());});}},"FastGoPhone");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return asset(request.getUrl());}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return navigate(request.getUrl());}
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return navigate(Uri.parse(url));}
   @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
   @Override public void onPageFinished(WebView view,String url){if(internal(Uri.parse(url)))view.evaluateJavascript("window.fastgoInstalledApp=Object.freeze({platform:'android',version:"+org.json.JSONObject.quote(appVersion())+",bundled:true});window.print=()=>FastGoPhone.print();window.fastgoRequestAppUpdate=()=>FastGoPhone.checkUpdate();",null);}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())Toast.makeText(MainActivity.this,"Не удалось открыть экран. Вернитесь назад и повторите.",Toast.LENGTH_LONG).show();}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{Uri origin=request.getOrigin();if(!"https".equals(origin.getScheme())||!"appassets.androidplatform.net".equals(origin.getHost())||!Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)){request.deny();return;}if(checkSelfPermission(android.Manifest.permission.CAMERA)==android.content.pm.PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else{cameraRequest=request;requestPermissions(new String[]{android.Manifest.permission.CAMERA},43);}});}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
   @Override public boolean onJsAlert(WebView view,String url,String text,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(text).setPositiveButton("Понятно",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsConfirm(WebView view,String url,String text,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(text).setPositiveButton("Да",(d,w)->result.confirm()).setNegativeButton("Отмена",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(picker!=null)picker.onReceiveValue(null);picker=callback;cameraUri=null;cameraFile=null;
    boolean image=false;for(String type:params.getAcceptTypes())if(type!=null&&type.startsWith("image/"))image=true;
    if(image&&checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED){pendingChooser=params;requestPermissions(new String[]{android.Manifest.permission.CAMERA},42);}else showChooser(params);return true;
   }
  });
  String task=getIntent().getStringExtra("staff_task_id");
  if(TaskNotices.uuid(task))web.loadUrl(HOME+"#task?id="+task);else if(state==null||web.restoreState(state)==null)web.loadUrl(HOME);
 }
 private void showChooser(WebChromeClient.FileChooserParams params){
    Intent select=params.createIntent();select.addCategory(Intent.CATEGORY_OPENABLE);select.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    Intent chooser=Intent.createChooser(select,"Выберите файл");
    boolean image=checkSelfPermission(android.Manifest.permission.CAMERA)==android.content.pm.PackageManager.PERMISSION_GRANTED;boolean acceptsImage=false;for(String type:params.getAcceptTypes())if(type!=null&&type.startsWith("image/"))acceptsImage=true;image=image&&acceptsImage;
    if(image){try{File folder=new File(getCacheDir(),"camera");folder.mkdirs();cameraFile=File.createTempFile("fastgo-",".jpg",folder);cameraUri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".files",cameraFile);Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);camera.setClipData(ClipData.newRawUri("Фото FastGo",cameraUri));camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);if(camera.resolveActivity(getPackageManager())!=null)chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});}catch(IOException|IllegalArgumentException ignored){cameraUri=null;}}
    try{startActivityForResult(chooser,FILE_PICKER);}catch(android.content.ActivityNotFoundException error){picker.onReceiveValue(null);picker=null;Toast.makeText(MainActivity.this,"На телефоне нет приложения выбора файлов",Toast.LENGTH_LONG).show();}
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);boolean granted=results.length>0&&results[0]==android.content.pm.PackageManager.PERMISSION_GRANTED;if(code==TaskNotices.PERMISSION&&granted&&notices!=null)notices.check();if(code==42&&pendingChooser!=null){WebChromeClient.FileChooserParams params=pendingChooser;pendingChooser=null;showChooser(params);}if(code==43&&cameraRequest!=null){if(granted)cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();cameraRequest=null;}}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String task=intent.getStringExtra("staff_task_id");if(TaskNotices.uuid(task))web.loadUrl(HOME+"#task?id="+task);}
 static boolean internal(Uri uri){return "https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())&&uri.getPath()!=null&&uri.getPath().startsWith(PREFIX);}
 private boolean navigate(Uri uri){if(internal(uri))return false;if(Arrays.asList("https","tel","mailto").contains(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(android.content.ActivityNotFoundException ignored){Toast.makeText(this,"Не удалось открыть ссылку",Toast.LENGTH_SHORT).show();}return true;}
 private WebResourceResponse asset(Uri uri){
  if(!"appassets.androidplatform.net".equals(uri.getHost()))return null;
  String path=uri.getPath();if(!internal(uri)||path.contains("..")||path.contains("\\"))return missing();
  String relative=path.substring(PREFIX.length());if(relative.isEmpty())relative="workshop.html";
  String ext=relative.contains(".")?relative.substring(relative.lastIndexOf('.')+1):"",mime=ext.equals("js")?"text/javascript":ext.equals("css")?"text/css":ext.equals("html")?"text/html":ext.equals("json")?"application/json":android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
  try{return new WebResourceResponse(mime==null?"application/octet-stream":mime,"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-cache"),getAssets().open("fastgo/"+relative));}catch(IOException error){return missing();}
 }
 private WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request!=FILE_PICKER||picker==null)return;Uri[] values=result==RESULT_OK?WebChromeClient.FileChooserParams.parseResult(result,data):null;if(result==RESULT_OK&&values==null&&cameraUri!=null&&cameraFile!=null&&cameraFile.length()>0)values=new Uri[]{cameraUri};picker.onReceiveValue(values);picker=null;cameraUri=null;web.requestFocus();}
 @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);web.saveState(state);}
 @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}if(document.getElementById('app-menu')?.classList.contains('open')){document.getElementById('menu-toggle')?.click();return true;}return false})()",handled->{if("true".equals(handled))return;if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("Закрыть FastGo?").setPositiveButton("Закрыть",(d,w)->finish()).setNegativeButton("Отмена",null).show();});}
 private void requestNoticePermission(){if(!TaskNotices.prefs(this).contains("credential")){noticePermissionPending=false;return;}noticePermissionPending=true;if(!resumed||!hasWindowFocus()||isFinishing())return;noticePermissionPending=false;if(Build.VERSION.SDK_INT>=33&&!TaskNotices.allowed(this)&&!TaskNotices.prefs(this).getBoolean("permission_asked",false)){TaskNotices.prefs(this).edit().putBoolean("permission_asked",true).commit();requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},TaskNotices.PERMISSION);}}
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused&&noticePermissionPending)requestNoticePermission();}
 @Override protected void onResume(){super.onResume();resumed=true;if(noticePermissionPending)requestNoticePermission();if(notices!=null)notices.check();if(updates!=null)updates.resume();}
 @Override protected void onPause(){resumed=false;if(updates!=null)updates.pause();super.onPause();}
 @Override protected void onDestroy(){if(notices!=null)notices.close();if(updates!=null)updates.close();if(picker!=null){picker.onReceiveValue(null);picker=null;}if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}if(web!=null){web.removeJavascriptInterface("FastGoPhone");web.destroy();}super.onDestroy();}
}
