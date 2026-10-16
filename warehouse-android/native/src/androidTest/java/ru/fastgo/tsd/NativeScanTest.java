package ru.fastgo.tsd;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.widget.EditText;import android.view.inputmethod.*;import org.json.*;import java.lang.reflect.*;
@RunWith(AndroidJUnit4.class) public final class NativeScanTest {
 private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
 private void invoke(Object object,String name,Class<?>[] types,Object... args)throws Exception{Method m=object.getClass().getDeclaredMethod(name,types);m.setAccessible(true);m.invoke(object,args);}
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
