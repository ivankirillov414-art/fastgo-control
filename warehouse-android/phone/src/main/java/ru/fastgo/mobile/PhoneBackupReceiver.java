package ru.fastgo.mobile;
import android.content.*;
import ru.fastgo.backup.BackupJobs;
public final class PhoneBackupReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){BackupJobs.schedule(c,PhoneBackupJob.class,true,false);}
}
