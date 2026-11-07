package ru.fastgo.backup;
import java.io.*;
import java.util.*;

/** All managed roots share the process reservation pool. Partials count as used bytes. */
public final class DiskBudget {
 public static final long LIMIT=512L*1024*1024,FREE_FLOOR=512L*1024*1024;
 public interface FreeSpace {long available();}
 public interface Lease extends AutoCloseable {void close();}
 private static final Object LOCK=new Object();private static final Map<String,Long> HELD=new HashMap<>();
 private final List<File> roots;private final FreeSpace free;private final String pool;
 public DiskBudget(List<File> roots,File volume) throws IOException {this(roots,volume,volume::getUsableSpace);}
 public DiskBudget(List<File> roots,File volume,FreeSpace free) throws IOException {this.roots=roots;this.free=free;pool=volume.getCanonicalPath();}
 private long size(File file,File boundary) throws IOException {
  if(!file.exists())return 0;String path=file.getCanonicalPath(),base=boundary.getCanonicalPath();if(!path.equals(base)&&!path.startsWith(base+File.separator))throw new IOException("Посторонний путь в каталоге резервов");
  if(file.isFile())return file.length();File[] children=file.listFiles();if(children==null)throw new IOException("Не удалось измерить каталог резервов");long sum=0;for(File child:children){sum+=size(child,boundary);if(sum>LIMIT)return sum;}return sum;
 }
 public long used() throws IOException {long total=0;for(File root:roots){total+=size(root,root);if(total>LIMIT)return total;}return total;}
 public Lease reserve(long bytes) throws IOException {
  if(bytes<0||bytes>LIMIT)throw new IOException("Недостаточно места: резерв превышает бюджет 512 МиБ");
  // Include a filesystem-page allowance as well as actual temporary payload bytes.
  final long reserved=bytes+65536;
  synchronized(LOCK){long held=HELD.containsKey(pool)?HELD.get(pool):0;long used=used();if(used+held+reserved>LIMIT||free.available()-held-reserved<FREE_FLOOR)throw new IOException("Недостаточно места для резерва: лимит 512 МиБ, свободный запас 512 МиБ. Прежние копии сохранены");HELD.put(pool,held+reserved);}
  return new Lease(){boolean closed;public void close(){synchronized(LOCK){if(!closed){closed=true;long held=HELD.containsKey(pool)?HELD.get(pool):0;HELD.put(pool,Math.max(0,held-reserved));}}}};
 }
 public void preflight(long bytes) throws IOException {try(Lease ignored=reserve(bytes)){} }
 public static Lease unlimited(){return ()->{};}
}
