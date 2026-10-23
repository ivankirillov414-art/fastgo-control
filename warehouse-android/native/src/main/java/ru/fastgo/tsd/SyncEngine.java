package ru.fastgo.tsd;
import org.json.*;
public final class SyncEngine {
 private final LocalStore store;private final WarehouseApi api;
 public SyncEngine(LocalStore s,WarehouseApi a){store=s;api=a;}
 public void catalog(boolean force)throws Exception{long stamp=0;try{stamp=Long.parseLong(store.get("catalog_at"));}catch(NumberFormatException ignored){}if(force||System.currentTimeMillis()-stamp>300000){JSONObject c=(JSONObject)api.call("catalog",new JSONObject());store.catalog(c.getJSONArray("parts"));}}
 public void sync()throws Exception{
  if(api.device()==null)return;
  for(JSONObject snapshot:store.pending()){
   String id=snapshot.getString("id"),kind=snapshot.getString("kind");
   if(snapshot.optBoolean("cancel_requested")){
    JSONObject result;
    try{result=(JSONObject)api.call("cancel_document",new JSONObject().put("id",id).put("kind",kind).put("revision",snapshot.getInt("revision")));}
    catch(WarehouseApi.ApiError e){if(e.status!=409)throw e;Object latest=api.call("job",new JSONObject().put("id",id));if(!(latest instanceof JSONObject))throw e;result=(JSONObject)latest;store.put("server:"+id,result.optString("state"));if(!result.optString("state").equals("done"))throw e;}
    if(result.optString("state").equals("done")){store.put("cancelled:"+id,Boolean.toString(result.optJSONObject("result")!=null&&result.getJSONObject("result").optBoolean("cancelled")));store.complete(id,snapshot.getInt("revision"));}continue;
   }
   if(kind.equals("repair")){syncRepair(snapshot);continue;}
   JSONArray events=snapshot.getJSONArray("events");
   for(int i=0;i<events.length();i++){
    JSONObject e=events.getJSONObject(i);if(e.has("part_id"))continue;
    if(e.optBoolean("undone")){api.call("scan_unknown",new JSONObject().put("request_id",e.getString("id")).put("code",e.getString("code")).put("kind",kind).put("document_id",e.optString("origin_doc",id)).put("cancel",true));continue;}
    JSONObject part=store.match(e.getString("code"));
    if(part!=null){store.resolve(id,e.getString("id"),part);continue;}
    JSONObject result=(JSONObject)api.call("scan_unknown",new JSONObject().put("request_id",e.getString("id")).put("code",e.getString("code")).put("kind",kind).put("document_id",e.optString("origin_doc",id)));
    if(result.optJSONObject("result")!=null&&result.getJSONObject("result").has("part"))store.resolve(id,e.getString("id"),result.getJSONObject("result").getJSONObject("part"));
   }
   JSONObject d=store.doc(id);JSONArray items=ScanDocument.items(d);
   if(d.getInt("revision")>d.optInt("acked")){
    try{JSONObject reply=(JSONObject)api.call("draft_sync",new JSONObject().put("request_id",id).put("kind",kind).put("revision",d.getInt("revision")).put("items",items));if(reply.optString("state").equals("done")){store.complete(id,reply.getJSONObject("payload").getInt("revision"));continue;}store.acknowledge(id,reply.getJSONObject("payload").getInt("revision"));}
    catch(WarehouseApi.ApiError ex){if(ex.status!=409)throw ex;}
   }
   Object r=api.call("job",new JSONObject().put("id",id));if(r instanceof JSONObject){JSONObject job=(JSONObject)r;store.put("server:"+id,job.optString("state"));if(job.optString("state").equals("done"))store.complete(id,job.getJSONObject("payload").getInt("revision"));}
  }
 }
 private void syncRepair(JSONObject d)throws Exception{
  JSONArray events=d.getJSONArray("events");if(events.length()==0)return;JSONObject event=events.getJSONObject(events.length()-1);if(event.optBoolean("undone"))return;
  String id=d.getString("id"),code=event.getString("code");JSONObject quote;
  try{quote=(JSONObject)api.call("repair_quote",new JSONObject().put("code",code));}catch(WarehouseApi.ApiError e){store.put("repair:"+id,"Ошибка: "+e.getMessage());return;}
  store.put("repair:"+id,"Ремонт № "+quote.optString("number")+"\n"+quote.optString("vehicle")+"\nК оплате: "+quote.optString("due")+" ₽");
  if(d.optInt("acked")==0){api.call("enqueue_repair",new JSONObject().put("request_id",id).put("repair_id",quote.getString("id")));store.acknowledge(id,d.getInt("revision"));}
  Object r=api.call("job",new JSONObject().put("id",id));if(r instanceof JSONObject&&((JSONObject)r).optString("state").equals("done"))store.complete(id,d.getInt("revision"));
 }
}
