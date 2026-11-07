package ru.fastgo.backup;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.security.spec.MGF1ParameterSpec;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.json.*;

/** Host-side directed integration checks run the same Java replica and AES parser as both APKs. */
public final class BackupReplicaCheck {
 static int checks;
 static void check(boolean value,String why){checks++;if(!value)throw new AssertionError(why);}
 static void expectFailure(BackupReplica r) throws Exception {boolean failed=false;try{r.run();}catch(Exception expected){failed=true;}check(failed,"operation must fail");}
 static final String KEY_ID="11111111-1111-4111-8111-111111111111",SHARED=repeat('a',64);
 static String repeat(char c,int n){char[] a=new char[n];Arrays.fill(a,c);return new String(a);}
 static final SecretKeySpec AES=new SecretKeySpec(new byte[32],"AES");
 static byte[] archive(String kind,String id,byte[] data) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,AES);JSONObject meta=new JSONObject().put("format",1).put("kind",kind).put("id",id).put("key_id",KEY_ID).put("iv",Base64.getEncoder().encodeToString(cipher.getIV()));if(kind.equals("media"))meta.put("plain_sha256",BackupReplica.hash(data));byte[] header=meta.toString().getBytes("UTF-8");cipher.updateAAD(header);ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(("FGARCHIVE1\n"+header.length+"\n").getBytes("UTF-8"));out.write(header);out.write(cipher.doFinal(data));return out.toByteArray();
 }
 static class Server implements BackupReplica.Remote {
  List<JSONObject> snapshots=new ArrayList<>();Map<String,byte[]> bodies=new HashMap<>();boolean offline,empty,partial,corrupt,receiptError,legacy,arbitrary404,missingMedia,onlyNewest;int downloads,receipts,latestCalls;JSONObject lastReceipt;
  Server() throws Exception {byte[] media=archive("media",SHARED,"photo-fixture".getBytes("UTF-8"));bodies.put("media",media);}
  void add(int day) throws Exception {
   String id=String.format("00000000-0000-4000-8000-%012d",day),date=String.format("2026-11-%02d",day);byte[] database=archive("database",id,new JSONObject().put("source_version",day).put("fixture","selected test backup").toString().getBytes("UTF-8"));bodies.put(id,database);byte[] media=bodies.get("media");
   snapshots.add(new JSONObject().put("id",id).put("day",date).put("created_at",date+"T01:00:00Z").put("completed_at",date+"T01:01:00Z").put("source_version",day).put("sha256",BackupReplica.hash(database)).put("bytes",database.length).put("key_id",KEY_ID).put("key_boxes",new JSONArray()).put("url",id).put("media_expected",1).put("media",new JSONArray().put(new JSONObject().put("id",SHARED).put("sha256",BackupReplica.hash(media)).put("bytes",media.length).put("key_id",KEY_ID))));
  }
  JSONObject clone(JSONObject x){return new JSONObject(x.toString());}
  public JSONObject call(String action,JSONObject params) throws Exception {
   if(offline)throw new java.net.UnknownHostException("fixture");
   if(action.equals("history")){if(legacy)throw new BackupReplica.ApiError(400,"unknown_action");if(arbitrary404)throw new BackupReplica.ApiError(404,"not_found");JSONArray list=new JSONArray();if(!empty)for(int i=snapshots.size()-1;i>=Math.max(0,snapshots.size()-(onlyNewest?1:7));i--)list.put(clone(snapshots.get(i)));return new JSONObject().put("snapshots",list);}
   if(action.equals("latest")){latestCalls++;return clone(snapshots.get(snapshots.size()-1));}
   if(action.equals("snapshot")){for(JSONObject s:snapshots)if(s.getString("id").equals(params.getString("snapshot_id"))){JSONObject c=clone(s);if(missingMedia)c.put("media_expected",2);return c;}}
   if(action.equals("media")){check(params.has("snapshot_id"),"media request bound to historical snapshot");JSONObject meta=clone(snapshots.get(0).getJSONArray("media").getJSONObject(0));return meta.put("url","media");}
   if(action.equals("receipt")){lastReceipt=clone(params);receipts++;if(receiptError&&params.optString("day").equals("2026-11-08"))throw new IOException("fixture receipt error");return new JSONObject();}
   throw new IllegalStateException(action);
  }
  public InputStream download(String url) throws Exception {
   downloads++;byte[] data=bodies.get(url).clone();if(corrupt&&url.equals(snapshots.get(snapshots.size()-1).getString("id")))data[data.length-1]^=1;
   if(partial&&url.equals(snapshots.get(snapshots.size()-1).getString("id")))return new ByteArrayInputStream(Arrays.copyOf(data,data.length/2));return new ByteArrayInputStream(data);
  }
 }
 static BackupReplica.Recovery recovery=(file,snapshot,media)->{
  byte[] plain=Archive.decrypt(file,AES,Base64.getDecoder().decode(Archive.header(file).meta.getString("iv")));JSONObject db=new JSONObject(new String(plain,"UTF-8"));check(db.getLong("source_version")==snapshot.getLong("source_version"),"selected snapshot restore matches source revision");Arrays.fill(plain,(byte)0);
  for(File f:media){Archive.Header h=Archive.header(f);plain=Archive.decrypt(f,AES,Base64.getDecoder().decode(h.meta.getString("iv")));check(BackupReplica.hash(plain).equals(h.meta.getString("plain_sha256")),"restored media SHA");Arrays.fill(plain,(byte)0);}return new JSONObject().put("verified",true);
 };
 static BackupReplica replica(File root,Server server,boolean owner)throws Exception{return new BackupReplica(root,server,owner?recovery:null,new BackupReplica.DirectorySync(){public void sync(File d){}public void replace(File from,File to)throws Exception{Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}});}
 static int manifests(File root){File[] files=new File(root,"manifests").listFiles((dir,name)->name.endsWith(".json"));return files==null?0:files.length;}
 static Map<String,String> durable(File root)throws Exception{Map<String,String> out=new TreeMap<>();try(java.util.stream.Stream<Path> walk=Files.walk(root.toPath())){for(Path p:(Iterable<Path>)walk.filter(Files::isRegularFile)::iterator){String name=root.toPath().relativize(p).toString();if(!name.equals("status.json")&&!name.equals("replica.lock"))out.put(name,BackupReplica.hash(p.toFile()));}}return out;}
 public static void main(String[] args)throws Exception {
  File root=Files.createTempDirectory("fastgo-backup-contract-").toFile();Server server=new Server();BackupReplica replica=replica(root,server,true);
  for(int i=1;i<=7;i++){server.add(i);replica.run();}check(manifests(root)==7,"seven successful dates");Map<String,String> before=durable(root);
  server.add(8);server.partial=true;expectFailure(replica);check(durable(root).equals(before),"partial eighth preserves every previous archive and manifest");server.partial=false;
  server.corrupt=true;expectFailure(replica);check(durable(root).equals(before),"corrupt eighth cannot authorize deletion");server.corrupt=false;
  server.offline=true;expectFailure(replica);check(durable(root).equals(before),"offline preserves history");check(replica.status().getString("last_day").equals("2026-11-07"),"offline status retains last successful day");server.offline=false;
  server.empty=true;replica.run();check(durable(root).equals(before),"empty history never prunes");server.empty=false;
  server.missingMedia=true;expectFailure(replica);check(durable(root).equals(before),"incomplete media refuses complete manifest");server.missingMedia=false;
  server.receiptError=true;expectFailure(replica);check(manifests(root)==8,"receipt failure never prunes old day");server.receiptError=false;replica.run();check(manifests(root)==7,"eight successful dates retain exactly seven after successful pass");check(!new File(root,"manifests/2026-11-01.json").exists(),"oldest day removed only after successful eighth");check(new File(root,"media").listFiles().length==1,"shared media retained by all seven references");
  before=durable(root);int downloads=server.downloads;replica.run();check(durable(root).keySet().equals(before.keySet())&&manifests(root)==7,"repeat day creates no duplicate archive");check(downloads==server.downloads,"valid cached ciphertext not downloaded again");check(server.lastReceipt.getBoolean("verified"),"owner receipt reflects actual AES/database/media recovery");
  File staffRoot=Files.createTempDirectory("fastgo-backup-staff-").toFile();BackupReplica staff=replica(staffRoot,server,false);staff.run();check(!server.lastReceipt.getBoolean("verified"),"staff ciphertext is never a plaintext restore claim");
  Server legacyServer=new Server();for(int i=1;i<=8;i++)legacyServer.add(i);legacyServer.legacy=true;BackupReplica legacy=replica(root,legacyServer,false);legacy.run();check(!legacy.status().getBoolean("history_supported"),"explicit legacy fallback reports missing history support");check(legacyServer.latestCalls==1,"unknown action falls back to latest");
  legacyServer.legacy=false;legacyServer.arbitrary404=true;expectFailure(legacy);check(legacyServer.latestCalls==1,"arbitrary 404 does not fall back");
  File fresh=Files.createTempDirectory("fastgo-backup-catchup-").toFile();replica(fresh,server,true).run();check(manifests(fresh)==7,"fresh online device catches up all seven available dates");
  byte[] media=server.bodies.get("media").clone();media[media.length-1]^=1;File broken=new File(root,"bad-cipher.fixture");Files.write(broken.toPath(),media);boolean rejected=false;try{Archive.decrypt(broken,AES,Base64.getDecoder().decode(Archive.header(broken).meta.getString("iv")));}catch(AEADBadTagException expected){rejected=true;}check(rejected,"AES authentication rejects modified ciphertext");
  KeyPairGenerator generator=KeyPairGenerator.getInstance("RSA");generator.initialize(2048);KeyPair pair=generator.generateKeyPair();OAEPParameterSpec oaep=new OAEPParameterSpec("SHA-256","MGF1",MGF1ParameterSpec.SHA256,PSource.PSpecified.DEFAULT);Cipher rsa=Cipher.getInstance("RSA/ECB/OAEPPadding");rsa.init(Cipher.ENCRYPT_MODE,pair.getPublic(),oaep);byte[] wrapped=rsa.doFinal(AES.getEncoded());rsa.init(Cipher.DECRYPT_MODE,pair.getPrivate(),oaep);check(Arrays.equals(AES.getEncoded(),rsa.doFinal(wrapped)),"server-compatible RSA OAEP SHA256/MGF1 SHA256 roundtrip");
  check(BackupReplica.legacyDay("2026-11-01T22:00:00.123Z").equals("2026-11-02"),"business day uses Yekaterinburg UTC+5");
  // One directed capacity case: no large fixture files or artificial disk filling.
  before=durable(fresh);downloads=server.downloads;server.add(9);server.onlyNewest=true;DiskBudget low=new DiskBudget(Arrays.asList(fresh),fresh,()->DiskBudget.FREE_FLOOR+1);BackupReplica.DirectorySync replace=new BackupReplica.DirectorySync(){public void sync(File d){}public void replace(File from,File to)throws Exception{Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}};
  expectFailure(new BackupReplica(fresh,server,recovery,replace,low));check(server.downloads==downloads,"low free space refuses before opening download");check(durable(fresh).equals(before),"low space preserves seven good copies without pruning");
  boolean oversize=false;try{low.reserve(DiskBudget.LIMIT+1);}catch(IOException e){oversize=e.getMessage().contains("512");}check(oversize,"oversize reservation rejected before allocation");
  DiskBudget ample=new DiskBudget(Arrays.asList(fresh),fresh,()->DiskBudget.FREE_FLOOR+2*DiskBudget.LIMIT);try(DiskBudget.Lease pending=ample.reserve(256*1024*1024L)){boolean refused=false;try{ample.reserve(300*1024*1024L);}catch(IOException expected){refused=true;}check(refused,"concurrent temporary reservations share installation budget");}
  File partialFile=new File(fresh,"capacity.fixture.partial");Files.write(partialFile.toPath(),new byte[1024]);check(ample.used()>=1024,"partial bytes count in budget");partialFile.delete();
  server.onlyNewest=false;
  System.out.println(new JSONObject().put("status","PASS").put("assertions",checks).put("cases",new JSONArray(Arrays.asList("rotation8to7","partial8","corruptSHA8","offline","empty-history","incomplete-media","receipt-failure","repeat-day","shared-media","owner-selected-restore","opaque-staff","legacy-latest","404-no-fallback","network-catchup7","AES-corrupt-tag","RSA-OAEP-SHA256","business-timezone","low-space-and-oversize"))));
 }
}
