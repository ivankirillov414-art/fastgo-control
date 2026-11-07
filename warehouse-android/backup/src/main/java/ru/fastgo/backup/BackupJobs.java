package ru.fastgo.backup;
import android.app.job.*;
import android.content.*;
import org.json.*;
import java.io.*;

public final class BackupJobs {
 public static final int DAILY=48101,CATCHUP=48102,LOCAL_DAILY=48103,LOCAL_CATCHUP=48104;
 public static void schedule(Context c,Class<?> service,boolean immediate,boolean local){
  JobScheduler scheduler=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);ComponentName name=new ComponentName(c,service);
  boolean exists=false,localExists=false;for(JobInfo job:scheduler.getAllPendingJobs()){if(job.getId()==DAILY)exists=true;if(job.getId()==LOCAL_DAILY)localExists=true;}
  if(!exists)scheduler.schedule(new JobInfo.Builder(DAILY,name).setPeriodic(24*60*60*1000L).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setBackoffCriteria(15*60*1000L,JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build());
  if(local&&!localExists)scheduler.schedule(new JobInfo.Builder(LOCAL_DAILY,name).setPeriodic(24*60*60*1000L).setPersisted(true).build());
  if(immediate){scheduler.schedule(new JobInfo.Builder(CATCHUP,name).setMinimumLatency(1000).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build());if(local)scheduler.schedule(new JobInfo.Builder(LOCAL_CATCHUP,name).setMinimumLatency(1000).setPersisted(true).build());}
 }
 public static void cancel(Context c){JobScheduler s=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);s.cancel(DAILY);s.cancel(CATCHUP);}
 public static String summary(File root){try{JSONObject s=new JSONObject(new String(BackupReplica.read(new File(root,"status.json"),65536),"UTF-8"));String day=s.optString("last_day");JSONArray days=s.optJSONArray("retained_days");String title=day.isEmpty()?"Резерв ещё не создан":"Последний резерв: "+day+" · "+(days==null?0:days.length())+" сут.";if(!s.optString("error").isEmpty())title+="\n"+s.optString("error");else if(!s.optBoolean("history_supported",true))title+="\nСервер пока поддерживает только последнюю копию";else if(!day.isEmpty()&&!s.optBoolean("verified"))title+="\nЗашифрованные файлы проверены; восстановление базы не подтверждено";return title;}catch(Exception e){return "Резерв ещё не создан";}}
 private BackupJobs(){}
}
