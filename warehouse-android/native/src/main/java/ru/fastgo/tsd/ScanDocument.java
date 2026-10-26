package ru.fastgo.tsd;
import org.json.*;
import java.util.*;
// Pure document logic: repeated scans have different IDs; retries reuse one ID/revision.
public final class ScanDocument {
 public static String normalizeCode(String value){if(value==null)return "";String code=value.trim();if(code.startsWith("\uFEFF"))code=code.substring(1).trim();if(code.matches("(?s)^\\](?:Q[0-9]|C[0-9]|d[0-9]).*"))code=code.substring(3);return code.trim();}
 public static boolean isPickupCode(String value){return normalizeCode(value).startsWith("FGPARTS1.");}
 public static boolean isRepairCode(String code){try{java.net.URI u=new java.net.URI(code.trim());if(!"https".equals(u.getScheme())||!"ivankirillov414-art.github.io".equals(u.getHost())||u.getUserInfo()!=null)return false;return "/fastgo-control/repair-status.html".equals(u.getPath())||"/fastgo-control/workshop.html".equals(u.getPath())&&u.getFragment()!=null&&u.getFragment().startsWith("order?")&&u.getFragment().contains("kind=repair");}catch(Exception e){return false;}}
 public static boolean isLink(String code){return code.trim().matches("(?is)^[a-z][a-z0-9+.-]*:.*")||code.trim().toLowerCase(Locale.ROOT).startsWith("www.");}
 public static String scanError(String kind,String code){
  code=normalizeCode(code);
  if(kind==null||kind.isEmpty())return "Сначала выберите раздел сканирования";
  if(code==null||code.trim().isEmpty()||code.length()>2048)return "Проверьте код";
  boolean pickup=code.startsWith("FGPARTS1."),repair=isRepairCode(code),link=isLink(code);
  if(kind.equals("repair"))return repair?"":"В оплате ремонта сканируйте только QR ремонта";
  if(kind.equals("parts"))return pickup||repair||!link?"":"Для выдачи сканируйте QR ремонта FastGo или QR «Взять запчасти»";
  if(kind.equals("receipt")||kind.equals("sale"))return pickup?"QR мастера принимается только в выдаче запчастей":repair?"Откройте раздел «Оплата ремонта»":link?"В этом разделе сканируйте штрихкод товара, а не ссылку":"";
  return "Сначала выберите раздел сканирования";
 }
 public static JSONObject create(String kind) throws JSONException {return new JSONObject().put("id",UUID.randomUUID().toString()).put("kind",kind).put("revision",1).put("acked",0).put("events",new JSONArray()).put("state","open");}
 public static void clearPickup(JSONObject doc){for(String key:new String[]{"pickup","pickup_code","pickup_scan","pickup_error","pickup_retry_at","pickup_attempts","pickup_blocked"})doc.remove(key);}
 public static void selectPickup(JSONObject doc,String code)throws JSONException{if(!doc.optString("state").equals("open")||doc.optBoolean("cancel_requested")||doc.optBoolean("issue_requested"))throw new IllegalStateException("Документ уже завершается");if(items(doc).length()==0)throw new IllegalStateException("Сначала отсканируйте запчасти");clearPickup(doc);doc.remove("scan_error");doc.put("pickup_scan",normalizeCode(code));}
 public static boolean samePickup(JSONObject current,JSONObject selected){return current!=null&&current.optString("state").equals("open")&&!current.optBoolean("cancel_requested")&&!current.optBoolean("issue_requested")&&current.optInt("revision")==selected.optInt("revision")&&!selected.optString("pickup_scan").isEmpty()&&current.optString("pickup_scan").equals(selected.optString("pickup_scan"));}
 public static void append(JSONObject doc,String code,JSONObject part) throws JSONException {
  if(!doc.optString("state").equals("open"))throw new IllegalStateException("Документ уже завершён");
  if(code==null||code.trim().isEmpty()||code.length()>2048)throw new IllegalArgumentException("Проверьте код");
  String error=scanError(doc.optString("kind"),code);if(!error.isEmpty())throw new IllegalArgumentException(error);
  if(doc.optString("kind").equals("parts")&&part==null)throw new IllegalArgumentException("Сканируйте штрихкод известной запчасти");
  if(doc.getJSONArray("events").length()>=2000)throw new IllegalStateException("Завершите документ на ноутбуке");
  int revision=doc.getInt("revision")+1;doc.put("revision",revision);
  JSONObject e=new JSONObject().put("id",UUID.randomUUID().toString()).put("code",code.trim()).put("revision",revision).put("origin_doc",doc.getString("id")).put("undone",false);
  if(part!=null)e.put("part_id",part.getString("id")).put("name",part.optString("name")).put("price",part.optDouble("retail_price",0));
  doc.getJSONArray("events").put(e);
 }
 public static boolean undo(JSONObject doc) throws JSONException {
  if(!doc.optString("state").equals("open"))return false;
  JSONArray events=doc.getJSONArray("events");for(int i=events.length()-1;i>=0;i--){JSONObject e=events.getJSONObject(i);if(!e.optBoolean("undone")){e.put("undone",true);doc.put("revision",doc.getInt("revision")+1);return true;}}return false;
 }
 public static JSONArray items(JSONObject doc) throws JSONException {
  Map<String,Integer> counts=new LinkedHashMap<>();JSONArray events=doc.getJSONArray("events");
  for(int i=0;i<events.length();i++){JSONObject e=events.getJSONObject(i);if(!e.optBoolean("undone")&&e.has("part_id")){String id=e.getString("part_id");counts.put(id,(counts.containsKey(id)?counts.get(id):0)+1);}}
  if(counts.size()>40)throw new IllegalStateException("В документе больше 40 разных товаров");
  JSONArray result=new JSONArray();for(Map.Entry<String,Integer> e:counts.entrySet()){if(e.getValue()>1000)throw new IllegalStateException("Не больше 1000 штук одного товара");result.put(new JSONObject().put("part_id",e.getKey()).put("quantity",e.getValue()));}return result;
 }
 public static JSONObject last(JSONObject doc) throws JSONException {JSONArray a=doc.getJSONArray("events");for(int i=a.length()-1;i>=0;i--)if(!a.getJSONObject(i).optBoolean("undone"))return a.getJSONObject(i);return null;}
 public static int count(JSONObject doc) throws JSONException {int n=0;JSONArray a=doc.getJSONArray("events");for(int i=0;i<a.length();i++)if(!a.getJSONObject(i).optBoolean("undone"))n++;return n;}
 public static JSONObject afterCommit(JSONObject doc,int serverRevision) throws JSONException {
  JSONObject next=create(doc.getString("kind"));JSONArray events=doc.getJSONArray("events");
  for(int i=0;i<events.length();i++){JSONObject e=events.getJSONObject(i);if(!e.optBoolean("undone")&&(e.optInt("revision")>serverRevision||!e.has("part_id"))){JSONObject copy=new JSONObject(e.toString());copy.put("revision",next.getInt("revision")+1);next.put("revision",next.getInt("revision")+1);next.getJSONArray("events").put(copy);}}
  return next;
 }
}
