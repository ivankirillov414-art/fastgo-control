package ru.fastgo.tsd;
import android.content.*;
import ru.fastgo.backup.BackupJobs;
public final class TsdBackupReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){BackupJobs.schedule(c,TsdBackupJob.class,true,true);}
}
