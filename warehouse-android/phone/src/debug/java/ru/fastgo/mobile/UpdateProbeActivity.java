package ru.fastgo.mobile;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.util.Locale;

/** Debug/emulator fixture only. This activity and its APK asset never enter a release package. */
public final class UpdateProbeActivity extends Activity {
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  if((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)==0){finish();return;}
  TextView status=new TextView(this);status.setText("FastGo native self-update test");setContentView(status);
  int existing=PhoneInstaller.state(this).getInt("session",-1);
  if(existing!=-1&&getPackageManager().getPackageInstaller().getSessionInfo(existing)!=null){status.setText("Native PackageInstaller session awaiting completion");return;}
  WebView view=new WebView(this);PhoneUpdates verifier=new PhoneUpdates(this,view);
  new Thread(()->{try{
   File apk=new File(getCacheDir(),"probe-update.apk");MessageDigest digest=MessageDigest.getInstance("SHA-256");
   try(InputStream in=getAssets().open("update-fixture.apk");FileOutputStream out=new FileOutputStream(apk)){
    byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1){digest.update(b,0,n);out.write(b,0,n);}out.getFD().sync();
   }
   StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(Locale.ROOT,"%02x",b&255));
   PackageInfo next=getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(),0);
   if(next==null)throw new IOException("Fixture APK cannot be read");
   JSONObject meta=new JSONObject().put("sha256",hash.toString()).put("versionCode",next.versionCode).put("versionName",next.versionName);
   verifier.verify(apk,meta);
   try(FileOutputStream proof=new FileOutputStream(new File(getFilesDir(),"phone-upgrade-proof.txt"))){proof.write("retained-before-self-update".getBytes("UTF-8"));proof.getFD().sync();}
   runOnUiThread(()->{try{PhoneInstaller.install(this,apk,next.versionName);status.setText("Native PackageInstaller session committed");}catch(Exception e){int pending=PhoneInstaller.state(this).getInt("session",-1);if(pending!=-1&&getPackageManager().getPackageInstaller().getSessionInfo(pending)!=null)status.setText("Native PackageInstaller session awaiting completion");else status.setText("SELF UPDATE FAILED: "+e.getMessage());}finally{verifier.close();view.destroy();}});
  }catch(Exception e){runOnUiThread(()->{status.setText("SELF UPDATE FAILED: "+e.getMessage());verifier.close();view.destroy();});}},"phone-update-probe").start();
 }
}
