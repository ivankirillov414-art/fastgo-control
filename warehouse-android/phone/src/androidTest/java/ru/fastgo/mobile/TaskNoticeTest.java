package ru.fastgo.mobile;
import android.app.*;import android.content.*;import android.os.Build;import android.webkit.WebView;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;import androidx.test.runner.lifecycle.Stage;
import org.junit.Test;import org.junit.runner.RunWith;import org.json.JSONObject;
import java.util.UUID;import java.util.concurrent.*;import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class TaskNoticeTest {
 private final android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
 private void shell(String cmd)throws Exception{try(android.os.ParcelFileDescriptor fd=instrumentation.getUiAutomation().executeShellCommand(cmd);java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] b=new byte[1024];while(in.read(b)!=-1){}}}
 private AccessibilityNodeInfo findButton(AccessibilityNodeInfo node,String suffix){if(node==null)return null;String id=node.getViewIdResourceName();if(id!=null&&id.endsWith("/"+suffix)&&node.isVisibleToUser())return node;for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo found=findButton(node.getChild(i),suffix);if(found!=null)return found;}return null;}
 private String describe(AccessibilityNodeInfo node){if(node==null)return "no active window";StringBuilder s=new StringBuilder();s.append(node.getViewIdResourceName()).append(':').append(node.getText()).append(' ');for(int i=0;i<node.getChildCount();i++)s.append(describe(node.getChild(i)));return s.toString();}
 private void permissionButton(String suffix)throws Exception{AccessibilityNodeInfo root=null;for(int i=0;i<100;i++){root=instrumentation.getUiAutomation().getRootInActiveWindow();AccessibilityNodeInfo button=findButton(root,suffix);if(button!=null){assertTrue(button.performAction(AccessibilityNodeInfo.ACTION_CLICK));Thread.sleep(300);return;}Thread.sleep(100);}fail("Notification permission button missing: "+suffix+"; window: "+describe(root));}
 private void permissionRequest(MainActivity a)throws Exception{java.util.concurrent.atomic.AtomicBoolean focus=new java.util.concurrent.atomic.AtomicBoolean();for(int i=0;i<100;i++){instrumentation.runOnMainSync(()->focus.set(a.hasWindowFocus()));if(focus.get())break;Thread.sleep(50);}assertTrue("Permission request starts from the visible application",focus.get());instrumentation.runOnMainSync(()->a.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},TaskNotices.PERMISSION));}
 private java.util.Set<Activity> activities(){java.util.Set<Activity> result=new java.util.HashSet<>();for(Stage stage:Stage.values())if(stage!=Stage.DESTROYED)for(Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(stage))if(a instanceof MainActivity)result.add(a);return result;}
 private String foregroundHash()throws Exception{AtomicReference<String> value=new AtomicReference<>();CountDownLatch latch=new CountDownLatch(1);instrumentation.runOnMainSync(()->{for(Activity a:ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED))if(a instanceof MainActivity){assertEquals("Notification must reuse one MainActivity",1,activities().size());((WebView)a.findViewById(14001)).evaluateJavascript("location.hash",v->{value.set(v);latch.countDown();});return;}latch.countDown();});assertTrue(latch.await(5,TimeUnit.SECONDS));return value.get();}
 @Test public void notificationPermissionDeduplicationAndTaskDeepLink()throws Exception{
  Context c=instrumentation.getTargetContext();NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);TaskNotices.clear(c);TaskNotices.channel(c);
  MainActivity initial=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));try{
   if(Build.VERSION.SDK_INT>=33){
    shell("pm revoke "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS");shell("pm clear-permission-flags "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS user-set user-fixed");
    assertFalse(TaskNotices.allowed(c));permissionRequest(initial);permissionButton("permission_deny_button");assertFalse("Denial must stay denied",TaskNotices.allowed(c));
    shell("pm clear-permission-flags "+c.getPackageName()+" android.permission.POST_NOTIFICATIONS user-set user-fixed");permissionRequest(initial);permissionButton("permission_allow_button");
   }
   assertTrue("OS notifications allowed",TaskNotices.allowed(c));
   String actor=UUID.randomUUID().toString(),id=UUID.randomUUID().toString();JSONObject credential=new JSONObject().put("actor",actor).put("device_id",UUID.randomUUID().toString()).put("token","fixture-device-key").put("registered",false);
   java.lang.reflect.Method save=TaskNotices.class.getDeclaredMethod("save",Context.class,JSONObject.class);save.setAccessible(true);save.invoke(null,c,credential);
   JSONObject task=new JSONObject().put("id",id).put("title","Проверить цены").put("body","Запчасти, техника и стоимость работ");
   assertTrue(TaskNotices.post(c,credential,task));assertTrue(TaskNotices.post(c,credential,task));assertEquals("Same notice must not create a second notification",1,nm.getActiveNotifications().length);
   assertTrue(TaskNotices.prefs(c).getString("credential","").indexOf("fixture-device-key")==-1);
   nm.getActiveNotifications()[0].getNotification().contentIntent.send();
   String hash=null;for(int i=0;i<50;i++){hash=foregroundHash();if(JSONObject.quote("#task?id="+id).equals(hash))break;Thread.sleep(100);}assertEquals("Notification opens assigned task route",JSONObject.quote("#task?id="+id),hash);
   TaskNotices.clear(c);for(int i=0;i<40&&nm.getActiveNotifications().length!=0;i++)Thread.sleep(50);assertEquals("Logout cancels the OS notification",0,nm.getActiveNotifications().length);assertFalse("Logged-out credential cannot post",TaskNotices.post(c,credential,task));
  }catch(Throwable failure){android.util.Log.e("FastGoNoticeTest","Task notice scenario failed",failure);throw failure;}finally{TaskNotices.clear(c);instrumentation.runOnMainSync(()->{for(Activity a:activities())a.finish();});}
 }
}
