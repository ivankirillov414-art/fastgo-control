package ru.fastgo.mobile;
import android.app.job.*;
import java.util.concurrent.*;
import java.util.*;
import ru.fastgo.backup.*;
public final class PhoneBackupJob extends JobService {
 private final ExecutorService executor=Executors.newSingleThreadExecutor();private final Map<Integer,Future<?>> tasks=new ConcurrentHashMap<>();private final Set<Integer> stopped=Collections.newSetFromMap(new ConcurrentHashMap<Integer,Boolean>());
 @Override public boolean onStartJob(JobParameters params){int id=params.getJobId();stopped.remove(id);tasks.put(id,executor.submit(()->{boolean retry=false;try{PhoneBackup.run(this);}catch(Exception error){retry=!(error instanceof BackupReplica.ApiError&&(((BackupReplica.ApiError)error).status==401||((BackupReplica.ApiError)error).status==403));try{String s=PhoneBackup.session(this);if(!s.isEmpty()){BackupReplica replica=new BackupReplica(PhoneBackup.root(this,PhoneBackup.actor(new org.json.JSONObject(s))),null,null,AndroidVault.DURABLE,AndroidVault.budget(this));replica.json("status.json",replica.status().put("status","error").put("error",BackupReplica.safeError(error)));}}catch(Exception ignored){}}finally{tasks.remove(id);if(!stopped.remove(id))jobFinished(params,retry);}}));return true;}
 @Override public boolean onStopJob(JobParameters params){int id=params.getJobId();stopped.add(id);Future<?> task=tasks.remove(id);if(task!=null)task.cancel(true);return true;}
 @Override public void onDestroy(){executor.shutdownNow();super.onDestroy();}
}
