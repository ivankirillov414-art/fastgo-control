package ru.fastgo.tsd;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.widget.EditText;import android.view.inputmethod.*;import org.json.*;import java.lang.reflect.*;
@RunWith(AndroidJUnit4.class) public final class NativeScanTest {
 @Test public void wrongSectionAndHomeNeverAppendScans()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(600);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore store=(LocalStore)field(a,"store");String qr="https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf";
    invoke(a,"home",new Class[]{});int before=store.pending().size();invoke(a,"scan",new Class[]{String.class},qr);assertEquals("",field(a,"documentId"));assertEquals(before,store.pending().size());
    for(String kind:new String[]{"sale","receipt","parts","repair"}){invoke(a,"open",new Class[]{String.class},kind);String id=(String)field(a,"documentId");JSONObject beforeDoc=store.doc(id);invoke(a,"scan",new Class[]{String.class},kind.equals("repair")?"FGP-00000001":kind.equals("parts")?"https://foreign.invalid/repair":qr);JSONObject after=store.doc(id);assertEquals(beforeDoc.getInt("revision"),after.getInt("revision"));assertEquals(beforeDoc.getJSONArray("events").toString(),after.getJSONArray("events").toString());assertFalse(after.optString("scan_error").isEmpty());invoke(a,"refresh",new Class[]{});assertEquals(android.view.View.VISIBLE,((android.widget.TextView)field(a,"feedback")).getVisibility());assertEquals(kind,field(a,"kind"));store.requestCancel(id);store.complete(id,store.doc(id).getInt("revision"));}
   }catch(Exception e){throw new AssertionError(e);}});
  }
 }
 @Test public void backgroundCompletionClearsOnlyTheCompletedActiveScreen()throws Exception{
  try(LocalStore store=new LocalStore(InstrumentationRegistry.getInstrumentation().getTargetContext())){
   String previous=store.get("active_document");JSONObject first=ScanDocument.create("repair"),second=ScanDocument.create("receipt");store.save(first);store.save(second);store.put("active_document",second.getString("id"));store.complete(first.getString("id"),1);assertEquals(second.getString("id"),store.get("active_document"));store.requestCancel(second.getString("id"));store.complete(second.getString("id"),1);assertEquals("",store.get("active_document"));store.put("active_document",previous);
  }
 }
 private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 private void invoke(Object object,String name,Class<?>[] types,Object... args)throws Exception{Method m=object.getClass().getDeclaredMethod(name,types);m.setAccessible(true);m.invoke(object,args);}
 private void set(Object object,String name,Object value)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);f.set(object,value);}
 @Test public void scannedRepairQrResolvesAfterRetryThenShowsIssueButtonAndIssuesOnlyOnConfirmation()throws Exception{
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();SecurePrefs prefs=new SecurePrefs(context);String previousDevice=prefs.get("device");java.util.concurrent.atomic.AtomicInteger quotes=new java.util.concurrent.atomic.AtomicInteger(),issues=new java.util.concurrent.atomic.AtomicInteger();LocalStore[] store={null};SyncEngine[] engine={null};String[] id={""};
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(700);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{set(a,"ready",false);set(a,"busy",false);LocalStore s=(LocalStore)field(a,"store");store[0]=s;for(JSONObject d:s.pending()){s.requestCancel(d.getString("id"));s.complete(d.getString("id"),d.getInt("revision"));}prefs.put("device",new JSONObject().put("id","fixture-terminal").put("token","fixture-only").toString());WarehouseApi api=new WarehouseApi(prefs,(action,params)->{if(action.equals("parts_pickup_quote")){if(quotes.incrementAndGet()==1)throw new WarehouseApi.ApiError(503,"Временная ошибка сервера");return new JSONObject().put("id","repair-fixture").put("number","FGR-0041").put("master_id","master-fixture").put("master_name","Мастер теста").put("vehicle","Kugoo").put("code","FGPARTS1.fixture.signed");}if(action.equals("parts_issue")){issues.incrementAndGet();assertEquals("FGPARTS1.fixture.signed",params.getString("code"));assertEquals(2,params.getJSONArray("items").getJSONObject(0).getInt("quantity"));return new JSONObject().put("repair_id","repair-fixture");}return new JSONObject();});set(a,"api",api);engine[0]=new SyncEngine(s,api);set(a,"sync",engine[0]);s.catalog(new JSONArray().put(new JSONObject().put("id","shock-fixture").put("barcode","FGP-SHOCK-FIXTURE").put("name","Амортизатор").put("quantity",4)));invoke(a,"open",new Class[]{String.class},"parts");id[0]=(String)field(a,"documentId");invoke(a,"scan",new Class[]{String.class},"FGP-SHOCK-FIXTURE");invoke(a,"scan",new Class[]{String.class},"FGP-SHOCK-FIXTURE");invoke(a,"receive",new Class[]{String.class,String.class},"]Q3https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf","broadcast");}catch(Exception e){throw new AssertionError(e);}});
   Thread.sleep(800);InstrumentationRegistry.getInstrumentation().waitForIdleSync();assertEquals(0,issues.get());assertEquals(1,quotes.get());
   scenario.onActivity(a->{try{invoke(a,"refresh",new Class[]{});assertEquals(android.view.View.GONE,((android.widget.Button)field(a,"issue")).getVisibility());assertTrue(((android.widget.TextView)field(a,"feedback")).getText().toString().contains("Временная ошибка"));JSONObject d=store[0].doc(id[0]);assertEquals(2,ScanDocument.count(d));d.put("pickup_retry_at",0);store[0].save(d);}catch(Exception e){throw new AssertionError(e);}});
   engine[0].sync();assertEquals(0,issues.get());
   scenario.onActivity(a->{try{invoke(a,"refresh",new Class[]{});android.widget.Button issue=(android.widget.Button)field(a,"issue");assertEquals(android.view.View.VISIBLE,issue.getVisibility());assertEquals("Выдать мастеру",issue.getText().toString());assertTrue(((android.widget.TextView)field(a,"last")).getText().toString().contains("FGR-0041"));issue.performClick();}catch(Exception e){throw new AssertionError(e);}});
   Thread.sleep(600);assertEquals(1,issues.get());assertEquals("done",store[0].doc(id[0]).getString("state"));
  }finally{prefs.put("device",previousDevice);}
 }
 @Test public void partsIssueBufferSurvivesRecreationAndRequiresRepairQrBeforeIssue()throws Exception{
  final String[] id={""};
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(600);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore s=(LocalStore)field(a,"store");s.catalog(new JSONArray().put(new JSONObject().put("id","native-parts-fixture").put("barcode","FGP-PARTS-FIXTURE").put("name","Камера 10 × 2,5").put("quantity",5)));invoke(a,"open",new Class[]{String.class},"parts");id[0]=(String)field(a,"documentId");invoke(a,"scan",new Class[]{String.class},"FGP-PARTS-FIXTURE");invoke(a,"scan",new Class[]{String.class},"FGP-PARTS-FIXTURE");assertEquals(2,ScanDocument.items(s.doc(id[0])).getJSONObject(0).getInt("quantity"));assertEquals(android.view.View.GONE,((android.widget.Button)field(a,"issue")).getVisibility());JSONObject doc=s.doc(id[0]);doc.put("pickup_code","FGPARTS1.fixture.signed").put("pickup",new JSONObject().put("number","0044").put("vehicle","Kugoo M4").put("master_name","Мастер"));s.save(doc);invoke(a,"refresh",new Class[]{});assertEquals(android.view.View.VISIBLE,((android.widget.Button)field(a,"issue")).getVisibility());assertTrue(((android.widget.TextView)field(a,"last")).getText().toString().contains("0044"));}catch(Exception e){throw new AssertionError(e);}});
   scenario.recreate();Thread.sleep(300);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore s=(LocalStore)field(a,"store");invoke(a,"open",new Class[]{String.class},"parts");assertEquals(id[0],field(a,"documentId"));assertTrue(s.doc(id[0]).has("pickup"));invoke(a,"undo",new Class[]{});assertEquals(1,ScanDocument.items(s.doc(id[0])).getJSONObject(0).getInt("quantity"));assertFalse(s.doc(id[0]).has("pickup"));assertEquals(android.view.View.GONE,((android.widget.Button)field(a,"issue")).getVisibility());s.requestCancel(id[0]);s.complete(id[0],s.doc(id[0]).getInt("revision"));}catch(Exception e){throw new AssertionError(e);}});
  }
 }
 @Test public void apkInstallWaitsForAllDocumentsIncludingHiddenAndCancelledPendingDocuments()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1000);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{LocalStore store=(LocalStore)field(a,"store");AppUpdates updates=(AppUpdates)field(a,"updates");JSONObject receipt=store.open("receipt"),repair=store.open("repair");store.scan(receipt.getString("id"),"FGP-UPDATE-BLOCKER");store.scan(repair.getString("id"),"https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf");store.put("active_document","");assertFalse(updates.canInstall());store.requestCancel(receipt.getString("id"));assertFalse(updates.canInstall());store.complete(receipt.getString("id"),store.doc(receipt.getString("id")).getInt("revision"));assertFalse(updates.canInstall());store.requestCancel(repair.getString("id"));store.complete(repair.getString("id"),store.doc(repair.getString("id")).getInt("revision"));assertTrue(updates.canInstall());store.put("active_document","empty-screen");assertFalse(updates.canInstall());store.put("active_document","");assertTrue(updates.canInstall());}catch(Exception e){throw new AssertionError(e);}});
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
    LocalStore store=(LocalStore)field(a,"store");invoke(a,"open",new Class[]{String.class},"repair");id[0]=(String)field(a,"documentId");store.scan(id[0],"https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf");invoke(a,"refresh",new Class[]{});
   }catch(Exception error){throw new AssertionError(error);}});
   InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   scenario.onActivity(a->{try{android.widget.Button cancel=(android.widget.Button)field(a,"cancel");android.graphics.Rect visible=new android.graphics.Rect();assertTrue(cancel.getGlobalVisibleRect(visible));assertEquals(cancel.getHeight(),visible.height());assertTrue(cancel.isEnabled());a.onBackPressed();}catch(Exception error){throw new AssertionError(error);}});
   InstrumentationRegistry.getInstrumentation().waitForIdleSync();
   androidx.test.espresso.Espresso.onView(androidx.test.espresso.matcher.ViewMatchers.withText("Да, отменить")).inRoot(androidx.test.espresso.matcher.RootMatchers.isDialog()).perform(androidx.test.espresso.action.ViewActions.click());
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
