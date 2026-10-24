package ru.fastgo.tsd;
import android.app.Activity;import android.os.Bundle;
/** Emulator-only entry point; no such activity is present in release APKs. */
public final class InstallUpdateActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);try(LocalStore store=new LocalStore(this)){if(store.blockingDocuments()!=0)throw new IllegalStateException("Documents remain open");store.put("active_document","");if(!new AppUpdates(this,store).install())throw new IllegalStateException("Install permission missing");}catch(Exception error){throw new IllegalStateException(error);}}
}
