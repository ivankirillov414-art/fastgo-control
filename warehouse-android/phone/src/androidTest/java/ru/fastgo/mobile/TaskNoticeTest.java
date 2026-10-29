package ru.fastgo.mobile;
import android.app.*;import android.content.*;import android.os.Build;import android.webkit.WebView;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.core.app.ActivityScenario;import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import org.json.JSONObject;
import java.util.UUID;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class TaskNoticeTest {
 private final android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
 private void shell(String cmd)throws Exception{try(android.os.ParcelFileDescriptor fd=instrumentation.getUiAutomation().executeShellCommand(cmd);java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] b=new byte[1024];while(in.read(b)!=-1){}}}
 private void permissionButton(String suffix)throws Exception{for(int i=0;i<60;i++){AccessibilityNodeInfo root=instrumentation.getUiAutomation().getRootInActiveWindow();if(root!=null){java.util.List<AccessibilityNodeInfo> buttons=root.findAccessibilityNodeInfosByViewId("com.android.permissioncontroller:id/"+suffix);if(!buttons.isEmpty()){buttons.get(0).performAction(AccessibilityNodeInfo.ACTION_CLICK);Thread.sleep(300);return;}}Thread.sleep(100);}fail("Notification permission button missing: "+suffix);}
 @Test public void notificationPermissionDeduplicationAndTaskDeepLink()throws Exception{
  Context c=instrumentation.getTargetContext();NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);TaskNotices.clear(c);TaskNotices.channel(c);
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   if(Build.VERSION.SDK_INT>=33){
    shell("pm revoke "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS");shell("pm clear-permission-flags "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS user-set user-fixed");
    assertFalse(TaskNotices.allowed(c));scenario.onActivity(a->a.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},TaskNotices.PERMISSION));permissionButton("permission_deny_button");assertFalse("Denial must stay denied",TaskNotices.allowed(c));
    shell("pm clear-permission-flags "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS user-set user-fixed");scenario.onActivity(a->a.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},TaskNotices.PERMISSION));permissionButton("permission_allow_button");
   }
   assertTrue("OS notifications allowed",TaskNotices.allowed(c));
   String actor=UUID.randomUUID().toString(),id=UUID.randomUUID().toString();JSONObject credential=new JSONObject().put("actor",actor).put("device_id",UUID.randomUUID().toString()).put("token","fixture-device-key").put("registered",false);
   java.lang.reflect.Method save=TaskNotices.class.getDeclaredMethod("save",Context.class,JSONObject.class);save.setAccessible(true);save.invoke(null,c,credential);
   JSONObject task=new JSONObject().put("id",id).put("title","Проверить цены").put("body","Запчасти, техника и стоимость работ");
   assertTrue(TaskNotices.post(c,credential,task));assertTrue(TaskNotices.post(c,credential,task));assertEquals("Same notice must not create a second notification",1,nm.getActiveNotifications().length);
   assertTrue(TaskNotices.prefs(c).getString("credential","").indexOf("fixture-device-key")==-1);
   nm.getActiveNotifications()[0].getNotification().contentIntent.send();
   AtomicReference<String> hash=new AtomicReference<>();for(int i=0;i<50;i++){CountDownLatch latch=new CountDownLatch(1);scenario.onActivity(a->((WebView)a.findViewById(14001)).evaluateJavascript("location.hash",v->{hash.set(v);latch.countDown();}));assertTrue(latch.await(5,TimeUnit.SECONDS));if(JSONObject.quote("#task?id="+id).equals(hash.get()))break;Thread.sleep(100);}assertEquals("Notification opens assigned task route",JSONObject.quote("#task?id="+id),hash.get());
   TaskNotices.clear(c);for(int i=0;i<40&&nm.getActiveNotifications().length!=0;i++)Thread.sleep(50);assertEquals("Logout cancels the OS notification",0,nm.getActiveNotifications().length);assertFalse("Logged-out credential cannot post",TaskNotices.post(c,credential,task));
  }finally{TaskNotices.clear(c);}
 }
}
