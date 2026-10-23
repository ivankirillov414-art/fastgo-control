package ru.fastgo.tsd;

import android.app.*;
import android.content.*;
import android.os.Build;

final class UpdateNotifications {
 private static final String CHANNEL="fastgo-updates";
 static void show(Context context,String title,String message){
  NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Обновления FastGo",NotificationManager.IMPORTANCE_DEFAULT));
  PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder notification=Build.VERSION.SDK_INT>=26?new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
  notification.setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(open).setOnlyAlertOnce(true).setAutoCancel(true);
  try{manager.notify(7301,notification.build());}catch(SecurityException ignored){/* Foreground update remains available if Android 13 notifications are disabled. */}
 }
 static void clear(Context context){((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(7301);}
}
