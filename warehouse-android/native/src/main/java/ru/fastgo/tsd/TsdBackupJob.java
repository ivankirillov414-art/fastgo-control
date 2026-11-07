package ru.fastgo.tsd;
import android.app.job.*;
import ru.fastgo.backup.*;
import java.util.concurrent.*;
import java.util.*;
public final class TsdBackupJob extends JobService {
 private final ExecutorService executor=Executors.newSingleThreadExecutor();private final Map<Integer,Future<?>> tasks=new ConcurrentHashMap<>();private final Set<Integer> stopped=Collections.newSetFromMap(new ConcurrentHashMap<Integer,Boolean>());
 @Override public boolean onStartJob(JobParameters params){int id=params.getJobId();stopped.remove(id);tasks.put(id,executor.submit(()->{boolean retry=false;try{if(id==BackupJobs.LOCAL_DAILY||id==BackupJobs.LOCAL_CATCHUP)QueueBackup.run(this);else TsdBackup.run(this);}catch(Exception error){retry=!(error instanceof BackupReplica.ApiError&&(((BackupReplica.ApiError)error).status==401||((BackupReplica.ApiError)error).status==403));if(id!=BackupJobs.LOCAL_DAILY&&id!=BackupJobs.LOCAL_CATCHUP)try{BackupReplica r=new BackupReplica(TsdBackup.root(this),null,null,AndroidVault.DURABLE,AndroidVault.budget(this));r.json("status.json",r.status().put("status","error").put("error",BackupReplica.safeError(error)));}catch(Exception ignored){}}finally{tasks.remove(id);if(!stopped.remove(id))jobFinished(params,retry);}}));return true;}
 @Override public boolean onStopJob(JobParameters params){stopped.add(params.getJobId());Future<?> task=tasks.remove(params.getJobId());if(task!=null)task.cancel(true);return true;}
 @Override public void onDestroy(){executor.shutdownNow();super.onDestroy();}
}
