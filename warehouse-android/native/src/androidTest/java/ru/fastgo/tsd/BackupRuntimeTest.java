package ru.fastgo.tsd;
import android.content.*;
import android.os.Build;
import android.app.job.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import ru.fastgo.backup.*;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;

/** Emulator fixture only. Never reboot/replace the working TSD database to make a backup. */
@RunWith(AndroidJUnit4.class)
public final class BackupRuntimeTest {
 @Test public void queueRoundtripLeavesWorkingDatabaseOpenAndLocalJobNeedsNoNetwork() throws Exception {
  Assume.assumeTrue(Build.FINGERPRINT.contains("generic")||Build.HARDWARE.contains("ranchu")||Build.HARDWARE.contains("goldfish"));Context base=InstrumentationRegistry.getInstrumentation().getTargetContext();File scratch=new File(base.getCacheDir(),"backup-runtime-"+UUID.randomUUID());assertTrue(scratch.mkdirs());
  Context wrapper=new ContextWrapper(base){@Override public File getFilesDir(){return scratch;}@Override public File getCacheDir(){return scratch;}};
  LocalStore store=new LocalStore(base);JSONObject doc=ScanDocument.create("sale");String id=doc.getString("id");
  try{store.save(doc);JSONObject before=store.doc(id);QueueBackup.run(wrapper);File[] archives=QueueBackup.root(wrapper).listFiles((d,n)->n.endsWith(".fgqueue")&&!n.contains("candidate"));assertNotNull(archives);assertEquals(1,archives.length);JSONObject restored=QueueBackup.verify(archives[0]);JSONArray docs=restored.getJSONObject("tables").getJSONArray("docs");boolean found=false;for(int i=0;i<docs.length();i++)if(id.equals(docs.getJSONObject(i).getString("id")))found=true;assertTrue(found);assertEquals(before.toString(),store.doc(id).toString());store.put("backup_runtime_fixture","usable");assertEquals("usable",store.get("backup_runtime_fixture"));QueueBackup.run(wrapper);assertEquals(1,QueueBackup.root(wrapper).listFiles((d,n)->n.endsWith(".fgqueue")&&!n.contains("candidate")).length);
   BackupJobs.schedule(wrapper,TsdBackupJob.class,false,true);JobInfo local=null;for(JobInfo j:((JobScheduler)base.getSystemService(Context.JOB_SCHEDULER_SERVICE)).getAllPendingJobs())if(j.getId()==BackupJobs.LOCAL_DAILY)local=j;assertNotNull(local);assertTrue(local.isPersisted());assertEquals(JobInfo.NETWORK_TYPE_NONE,local.getNetworkType());
  }finally{store.getWritableDatabase().delete("docs","id=?",new String[]{id});store.getWritableDatabase().delete("kv","k=?",new String[]{"backup_runtime_fixture"});store.close();JobScheduler scheduler=(JobScheduler)base.getSystemService(Context.JOB_SCHEDULER_SERVICE);for(int job:new int[]{BackupJobs.DAILY,BackupJobs.CATCHUP,BackupJobs.LOCAL_DAILY,BackupJobs.LOCAL_CATCHUP})scheduler.cancel(job);remove(scratch,scratch.getCanonicalPath());}
 }
 static void remove(File file,String root) throws Exception {String path=file.getCanonicalPath();if(!path.equals(root)&&!path.startsWith(root+File.separator))throw new IOException("Fixture path escaped");if(file.isDirectory()){File[] list=file.listFiles();if(list!=null)for(File child:list)remove(child,root);}if(!file.delete())throw new IOException("Fixture cleanup failed");}
}
