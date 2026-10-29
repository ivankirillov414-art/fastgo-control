package ru.fastgo.mobile;
import android.app.job.*;
public final class TaskNoticeJob extends JobService {
 @Override public boolean onStartJob(JobParameters params){new TaskNotices(this,null).background(()->jobFinished(params,false));return true;}
 @Override public boolean onStopJob(JobParameters params){return true;}
}
