package ru.fastgo.tsd;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;
import android.content.*;import org.json.*;
@RunWith(AndroidJUnit4.class) public final class ProvisionTest {
 @Test public void usbSetupStoresEncryptedConnectionOnceAndNeverReplacesDocuments()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();SecurePrefs prefs=new SecurePrefs(c);
  String oldAuth=prefs.get("auth"),oldDevice=prefs.get("device");
  try(LocalStore store=new LocalStore(c)){
   for(JSONObject doc:store.pending()){store.requestCancel(doc.getString("id"));store.complete(doc.getString("id"),doc.getInt("revision"));}
   prefs.put("auth","");prefs.put("device","");
   JSONObject auth=new JSONObject().put("user",new JSONObject().put("id","11111111-1111-4111-8111-111111111111")).put("access_token","fixture-token-for-encrypted-storage").put("refresh_token","fixture-refresh").put("expires_at",4102444800L);
   JSONObject device=new JSONObject().put("id","22222222-2222-4222-8222-222222222222").put("station_id","33333333-3333-4333-8333-333333333333").put("token","44444444-4444-4444-8444-44444444444444444444-4444-4444-8444-444444444444");
   JSONObject payload=new JSONObject().put("auth",auth).put("device",device);
   ProvisionReceiver.configure(c,payload);assertEquals(device.getString("id"),new JSONObject(prefs.get("device")).getString("id"));
   assertFalse(c.getSharedPreferences("credentials",Context.MODE_PRIVATE).getString("auth","").contains("fixture-token"));
   String id=store.open("receipt").getString("id");store.scan(id,"PERSISTENT-SETUP-SCAN");
   try{ProvisionReceiver.configure(c,payload);fail("Existing setup must not be replaced");}catch(IllegalStateException expected){assertEquals("already_configured",expected.getMessage());}
   assertEquals(1,ScanDocument.count(store.doc(id)));store.requestCancel(id);store.complete(id,store.doc(id).getInt("revision"));
  }finally{prefs.put("auth",oldAuth);prefs.put("device",oldDevice);}
 }
}
