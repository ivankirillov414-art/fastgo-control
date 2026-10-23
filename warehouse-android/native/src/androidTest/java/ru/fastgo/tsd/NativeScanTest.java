package ru.fastgo.tsd;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.widget.EditText;import android.view.inputmethod.*;import org.json.*;import java.lang.reflect.*;
@RunWith(AndroidJUnit4.class) public final class NativeScanTest {
 private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 private void invoke(Object object,String name,Class<?>[] types,Object... args)throws Exception{Method m=object.getClass().getDeclaredMethod(name,types);m.setAccessible(true);m.invoke(object,args);}
 @Test public void apkInstallWaitsForAllDocumentsIncludingHiddenAndCancelledPendingDocuments()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1000);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore store=(LocalStore)field(a,"store");AppUpdates updates=(AppUpdates)field(a,"updates");JSONObject receipt=store.open("receipt"),repair=store.open("repair");store.scan(receipt.getString("id"),"FGP-UPDATE-BLOCKER");store.scan(repair.getString("id"),"QR-UPDATE-BLOCKER");store.put("active_document","");assertFalse(updates.canInstall());store.requestCancel(receipt.getString("id"));assertFalse(updates.canInstall());store.complete(receipt.getString("id"),store.doc(receipt.getString("id")).getInt("revision"));assertFalse(updates.canInstall());store.requestCancel(repair.getString("id"));store.complete(repair.getString("id"),store.doc(repair.getString("id")).getInt("revision"));assertTrue(updates.canInstall());store.put("active_document","empty-screen");assertFalse(updates.canInstall());store.put("active_document","");assertTrue(updates.canInstall());}catch(Exception e){throw new AssertionError(e);}});
  }
 }
 @Test public void receiptAndRepairHaveDurableCancellationBeforeServerConfirmation()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1000);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore store=(LocalStore)field(a,"store");for(String kind:new String[]{"receipt","repair"}){invoke(a,"open",new Class[]{String.class},kind);assertTrue(((android.widget.Button)field(a,"cancel")).getText().toString().contains(kind.equals("receipt")?"приход":"ремонта"));String id=(String)field(a,"documentId");store.requestCancel(id);invoke(a,"refresh",new Class[]{});assertFalse(((android.widget.Button)field(a,"cancel")).isEnabled());assertTrue(store.doc(id).getBoolean("cancel_requested"));store.complete(id,store.doc(id).getInt("revision"));assertEquals(0,ScanDocument.count(store.open(kind)));}}catch(Exception e){throw new AssertionError(e);}});
  }
 }
 @Test public void repairBackOpensVisibleCancellationAndConfirmationPersistsTheRequest()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1000);InstrumentationRegistry.getInstrumentation().waitForIdleSync();final String[] id={""};
   scenario.onActivity(a->{try{
    LocalStore store=(LocalStore)field(a,"store");invoke(a,"open",new Class[]{String.class},"repair");id[0]=(String)field(a,"documentId");store.scan(id[0],"WRONG-REPAIR-CANCELLATION-FIXTURE");invoke(a,"refresh",new Class[]{});
    android.widget.Button cancel=(android.widget.Button)field(a,"cancel");android.graphics.Rect visible=new android.graphics.Rect();assertTrue(cancel.getGlobalVisibleRect(visible));assertEquals(cancel.getHeight(),visible.height());assertTrue(cancel.isEnabled());
    a.onBackPressed();
   }catch(Exception error){throw new AssertionError(error);}});
   InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   android.view.accessibility.AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();assertNotNull(root);
   java.util.List<android.view.accessibility.AccessibilityNodeInfo> buttons=root.findAccessibilityNodeInfosByText("Да, отменить");assertFalse(buttons.isEmpty());assertTrue(buttons.get(0).performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));
   Thread.sleep(300);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore store=(LocalStore)field(a,"store");assertTrue(store.doc(id[0]).getBoolean("cancel_requested"));assertFalse(((android.widget.Button)field(a,"cancel")).isEnabled());store.complete(id[0],store.doc(id[0]).getInt("revision"));}catch(Exception error){throw new AssertionError(error);}});
  }
 }
 @Test public void nativeEditorAcceptsImeScanWithoutSoftKeyboardAndPersistsIt()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1000);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   final String[] id={""};
   scenario.onActivity(a->{try{LocalStore s=(LocalStore)field(a,"store");s.catalog(new JSONArray().put(new JSONObject().put("id","native-fixture-part").put("name","Камера 10×2.5").put("barcode","FGP-NATIVE-TEST").put("retail_price",400).put("quantity",30)));invoke(a,"open",new Class[]{String.class},"receipt");id[0]=(String)field(a,"documentId");EditText editor=(EditText)field(a,"scanner");assertFalse(editor.getShowSoftInputOnFocus());assertTrue(editor.hasFocus());InputConnection connection=editor.onCreateInputConnection(new EditorInfo());assertNotNull(connection);assertTrue(connection.commitText("FGP-NATIVE-TEST",1));}catch(Exception e){throw new AssertionError(e);}});
   Thread.sleep(600);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.recreate();Thread.sleep(400);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore s=(LocalStore)field(a,"store");JSONObject d=s.doc(id[0]);assertEquals(1,ScanDocument.items(d).getJSONObject(0).getInt("quantity"));assertEquals("Камера 10×2.5",ScanDocument.last(d).getString("name"));invoke(a,"home",new Class[]{});invoke(a,"open",new Class[]{String.class},"receipt");assertEquals(id[0],field(a,"documentId"));invoke(a,"undo",new Class[]{});assertEquals(0,ScanDocument.count(s.doc(id[0])));}catch(Exception e){throw new AssertionError(e);}});
  }
 }
}
