package ru.fastgo.tsd;

import android.app.job.*;
import android.content.*;
import java.util.concurrent.*;

/** OS-scheduled internet checks continue when the scanner activity is closed. */
public final class UpdateJob extends JobService {
 private static final int PERIODIC=7301, IMMEDIATE=7302;
 private final ExecutorService executor=Executors.newSingleThreadExecutor();
 private final java.util.Set<Integer> stopped=java.util.concurrent.ConcurrentHashMap.newKeySet();
 public static void schedule(Context context,boolean immediate){
  JobScheduler scheduler=(JobScheduler)context.getSystemService(JOB_SCHEDULER_SERVICE);
  ComponentName service=new ComponentName(context,UpdateJob.class);
  if(scheduler.getPendingJob(PERIODIC)==null)
   scheduler.schedule(new JobInfo.Builder(PERIODIC,service).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15*60*1000L).build());
  if(immediate)scheduler.schedule(new JobInfo.Builder(IMMEDIATE,service).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(1000).setOverrideDeadline(60000).build());
 }
 @Override public boolean onStartJob(JobParameters params){
  stopped.remove(params.getJobId());executor.execute(()->{
   boolean retry=false;
   try(LocalStore store=new LocalStore(this)){
    try{
     String message=new AppUpdates(this,store).check(true);
     store.put("update_background_checked_at",Long.toString(System.currentTimeMillis()));
     store.put("update_background_error","");
     if(!store.get("update_pending_version").isEmpty())UpdateNotifications.show(this,"Обновление FastGo",message.isEmpty()?"Обновление готово. Откройте FastGo для установки":message);
    }catch(Exception error){store.put("update_background_error",error.getMessage()==null?"network_error":error.getMessage());retry=true;}
   }finally{if(!stopped.remove(params.getJobId()))jobFinished(params,retry);}
  });return true;
 }
 @Override public boolean onStopJob(JobParameters params){stopped.add(params.getJobId());return true;}
 @Override public void onDestroy(){executor.shutdownNow();super.onDestroy();}
}
