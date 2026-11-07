package ru.fastgo.tsd;
import android.content.Context;
import org.json.*;
import java.io.*;
import ru.fastgo.backup.*;

final class TsdBackup {
 static File root(Context c){return new File(c.getFilesDir(),"server-backups-tsd");}
 static String status(Context c){return AndroidVault.spaceStatus(c,BackupJobs.summary(root(c))+"\n"+QueueBackup.status(c));}
 static void run(Context c) throws Exception {
  SecurePrefs secure=new SecurePrefs(c);String raw=secure.get("device");if(raw.isEmpty())throw new BackupReplica.ApiError(401,"no_device");final JSONObject device=new JSONObject(raw);final String token=device.getString("token"),id=device.getString("id");
  BackupReplica.Remote remote=new BackupReplica.Remote(){
   void current() throws Exception {String value=secure.get("device");if(value.isEmpty())throw new BackupReplica.ApiError(403,"device_removed");JSONObject current=new JSONObject(value);if(!id.equals(current.optString("id"))||!token.equals(current.optString("token")))throw new BackupReplica.ApiError(403,"device_changed");}
   @Override public JSONObject call(String action,JSONObject params) throws Exception {current();JSONObject body=new JSONObject(params.toString()).put("action",action).put("device_id",id).put("device_token",token);return BackupHttp.post(WarehouseApi.BASE,WarehouseApi.KEY,"/functions/v1/fastgo-backups",body,null).getJSONObject("data");}
   @Override public InputStream download(String url) throws Exception {current();return BackupHttp.download(WarehouseApi.BASE,url);}
  };
  remote.call("register",new JSONObject().put("app","tsd").put("host",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL));
  new BackupReplica(root(c),remote,null,AndroidVault.DURABLE,AndroidVault.budget(c)).run();
 }
}
