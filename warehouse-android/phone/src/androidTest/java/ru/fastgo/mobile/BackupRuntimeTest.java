package ru.fastgo.mobile;
import android.content.Context;
import android.app.job.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import ru.fastgo.backup.*;
import java.util.*;
import static org.junit.Assert.*;

/** Run on the isolated phone debug package after server/native integration, not a signed release. */
@RunWith(AndroidJUnit4.class)
public final class BackupRuntimeTest {
 @Test public void nativeSessionEncryptedLogoutAndBootScheduling() throws Exception {
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();assertTrue("Use isolated debug app",c.getPackageName().endsWith(".test"));Assume.assumeTrue(PhoneBackup.session(c).isEmpty());
  JSONObject fixture=new JSONObject().put("user_id","11111111-1111-4111-8111-111111111111").put("access_token","fixture-access-no-production-account").put("refresh_token","fixture-refresh-no-production-account").put("expires_at",4102444800L);
  try{PhoneBackup.session(c,fixture.toString());BackupJobs.cancel(c);
   String stored=c.getSharedPreferences("fastgo_phone_session_v1",Context.MODE_PRIVATE).getString("session","");assertFalse(stored.contains("fixture-access"));assertFalse(stored.contains("fixture-refresh"));assertEquals(fixture.getString("access_token"),new JSONObject(PhoneBackup.session(c)).getString("access_token"));
   // A different stale WebView token receives the already-refreshed native session, no network.
   assertEquals(fixture.getString("access_token"),PhoneBackup.refresh(c,"old-webview-token").getString("access_token"));long epoch=PhoneBackup.epoch();PhoneBackup.session(c,"");assertTrue(PhoneBackup.epoch()>epoch);assertEquals("",PhoneBackup.session(c));
   BackupJobs.schedule(c,PhoneBackupJob.class,false,false);JobInfo daily=null;for(JobInfo j:((JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE)).getAllPendingJobs())if(j.getId()==BackupJobs.DAILY)daily=j;assertNotNull(daily);assertTrue(daily.isPersisted());assertEquals(24*60*60*1000L,daily.getIntervalMillis());assertEquals(JobInfo.NETWORK_TYPE_ANY,daily.getNetworkType());
  }finally{PhoneBackup.session(c,"");BackupJobs.cancel(c);}
 }
 @Test public void selectedSnapshotRestoresLegacyAndProjectTablesIntoIsolatedMemorySQLite() throws Exception {
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();JSONObject sheets=new JSONObject();for(int i=0;i<10;i++)sheets.put("sheet"+i,new JSONObject().put("headers",new JSONArray().put("id")).put("rows",new JSONArray().put(new JSONObject().put("__row",2).put("id","fixture"))));
  JSONObject legacy=new JSONObject().put("format",1).put("source_version",4).put("native",new JSONObject().put("sheets",sheets)).put("tables",new JSONObject().put("auth.users",new JSONArray().put(new JSONObject().put("id","fixture"))).put("public.workshop_repairs",new JSONArray().put(new JSONObject().put("id","repair")))).put("media",new JSONArray());
  JSONObject expected=new JSONObject().put("source_version",4).put("media_expected",0);JSONObject restored=OwnerRecovery.validateDatabase(legacy.toString().getBytes("UTF-8"),expected,c.getCacheDir());assertEquals(10,restored.getInt("native_rows"));assertEquals(2,restored.getInt("raw_rows"));
  legacy.put("project_tables",new JSONObject().put("public.rental_contracts",new JSONArray().put(new JSONObject().put("id","rental"))));restored=OwnerRecovery.validateDatabase(legacy.toString().getBytes("UTF-8"),expected,c.getCacheDir());assertEquals(3,restored.getInt("raw_rows"));assertEquals(3,restored.getInt("tables"));
 }
}
