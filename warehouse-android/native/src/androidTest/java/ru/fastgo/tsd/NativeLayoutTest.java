package ru.fastgo.tsd;

import android.content.Context;
import android.graphics.Rect;
import android.os.ParcelFileDescriptor;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;

@RunWith(AndroidJUnit4.class)
public final class NativeLayoutTest {
    @Test public void shortLargeTextAndNormalScreensKeepNavigationAndDocumentActionsReachable() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SecurePrefs prefs = new SecurePrefs(context);
        String auth = prefs.get("auth"), device = prefs.get("device");
        try (DisplaySettings display = new DisplaySettings(); UpdateCheckState updates = new UpdateCheckState(context)) {
            // A clean local fixture prevents login/provisioning or production API writes.
            prefs.put("auth", ""); prefs.put("device", "");
            for (String[] profile : new String[][]{{"320x480", "1.5"}, {"360x640", "1.0"}}) {
                display.apply(profile[0], profile[1]);
                updates.refresh();
                wakeAndUnlock();
                try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                    isolateUpdates(scenario);
                    awaitText(scenario, "Войти");
                    scenario.onActivity(a -> {
                        try {
                            assertEquals(Float.parseFloat(profile[1]), a.getResources().getConfiguration().fontScale, 0.01f);
                            android.util.DisplayMetrics metrics = a.getResources().getDisplayMetrics();
                            assertEquals(Integer.parseInt(profile[0].split("x")[0]), Math.round(metrics.widthPixels / metrics.density));
                            set(a, "busy", false); set(a, "resumed", false); invoke(a, "home");
                        }
                        catch (Exception error) { throw new AssertionError(error); }
                    });
                    awaitLayout(scenario);
                    awaitWindowFocus(scenario);
                    scenario.onActivity(a -> {
                        try {
                            LinearLayout content = (LinearLayout) field(a, "content");
                            assertTrue(content.getParent() instanceof ScrollView);
                            if (profile[0].equals("320x480")) {
                                // Demonstrates actual overflow: this content cannot fit without scrolling.
                                assertTrue(content.getHeight() > ((ScrollView) content.getParent()).getHeight());
                            }
                        } catch (Exception error) { throw new AssertionError(error); }
                    });
                    for (String action : new String[]{"Приход", "Продажа", "Оплата ремонта", "Выдача запчастей", "Обновить сейчас", "Сверить каталог"})
                        onView(withText(action)).perform(scrollTo()).check(matches(isCompletelyDisplayed()));

                    scenario.onActivity(a -> {
                        try { set(a, "resumed", true); }
                        catch (Exception error) { throw new AssertionError(error); }
                    });
                    onView(withText("Приход")).perform(scrollTo(), click());
                    awaitLayout(scenario);
                    awaitWindowFocus(scenario);
                    scenario.onActivity(a -> {
                        try {
                            LinearLayout content = (LinearLayout) field(a, "content");
                            assertFalse(content.getParent() instanceof ScrollView);
                            fullyVisible((Button) field(a, "cancel"));
                            fullyVisible((Button) field(a, "acceptReceiptButton"));
                            TextView summary = (TextView) field(a, "last");
                            assertTrue(summary.getParent() instanceof ScrollView);
                            assertTrue(((ScrollView) summary.getParent()).getHeight() > 0);
                            EditText scanner = (EditText) field(a, "scanner");
                            assertFalse(scanner.getShowSoftInputOnFocus());
                            assertTrue(scanner.hasFocus());
                            LocalStore store = (LocalStore) field(a, "store");
                            String id = (String) field(a, "documentId");
                            store.requestCancel(id);
                            store.complete(id, store.doc(id).getInt("revision"));
                        } catch (Exception error) { throw new AssertionError(error); }
                    });
                }
            }
        } finally { prefs.put("auth", auth); prefs.put("device", device); }
    }

    @Test public void shortScreenLoginAndLongStationNamesCanScrollIntoView() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SecurePrefs prefs = new SecurePrefs(context);
        String auth = prefs.get("auth"), device = prefs.get("device");
        try (DisplaySettings display = new DisplaySettings(); UpdateCheckState updates = new UpdateCheckState(context)) {
            prefs.put("auth", ""); prefs.put("device", "");
            display.apply("320x480", "1.5");
            updates.refresh();
            wakeAndUnlock();
            try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
                isolateUpdates(scenario);
                awaitText(scenario, "Войти");
                scenario.onActivity(a -> {
                    try { set(a, "resumed", false); }
                    catch (Exception error) { throw new AssertionError(error); }
                });
                awaitLayout(scenario);
                awaitWindowFocus(scenario);
                scenario.onActivity(a -> assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
                        a.getWindow().getAttributes().softInputMode & WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST));
                // Uses the real focused editor without submitting credentials.
                // A hardware-keyboard emulator need not show a software IME.
                onView(withHint("Пароль")).perform(scrollTo(), click(), typeText("fixture-only"));
                onView(withText("Войти")).perform(scrollTo()).check(matches(isCompletelyDisplayed()));
                androidx.test.espresso.Espresso.closeSoftKeyboard();
                final String first = "Кассовый ноутбук Драгнир — выдача запчастей, приход и оплата";
                final String second = "Сервисный ноутбук — второе разрешённое рабочее место FastGo";
                scenario.onActivity(a -> {
                    try {
                        WarehouseApi api = new WarehouseApi(prefs, (action, params) -> {
                            if (action.equals("stations")) return new JSONArray()
                                    .put(new JSONObject().put("id", "fixture-cash").put("name", first))
                                    .put(new JSONObject().put("id", "fixture-service").put("name", second));
                            throw new AssertionError("Unexpected fixture action: " + action);
                        });
                        set(a, "api", api);
                        invoke(a, "chooseStation");
                    } catch (Exception error) { throw new AssertionError(error); }
                });
                awaitText(scenario, second);
                awaitLayout(scenario);
                awaitWindowFocus(scenario);
                onView(withText(first)).perform(scrollTo()).check(matches(isCompletelyDisplayed()));
                onView(withText(second)).perform(scrollTo()).check(matches(isCompletelyDisplayed()));
            }
        } finally { prefs.put("auth", auth); prefs.put("device", device); }
    }

    private static void fullyVisible(View view) {
        Rect visible = new Rect();
        assertTrue(view.getGlobalVisibleRect(visible));
        assertEquals(view.getHeight(), visible.height());
        assertEquals(view.getWidth(), visible.width());
    }

    private static void isolateUpdates(ActivityScenario<MainActivity> scenario) {
        scenario.onActivity(a -> {
            try {
                set(a, "resumed", false);
                set(a, "ready", false);
                LocalStore store = (LocalStore) field(a, "store");
                // Do not consume/delete an APK staged by UpgradeTest, regardless of test order.
                store.put("update_last_check", Long.toString(System.currentTimeMillis()));
                store.put("update_waiting_documents", "");
                AppUpdates fixture = new AppUpdates(a, store, (url, limit) -> {
                    throw new java.io.IOException("Network disabled in layout fixture");
                });
                set(a, "updates", fixture);
                set(a, "updatePrompted", fixture.readyVersion());
            } catch (Exception error) { throw new AssertionError(error); }
        });
    }

    private static void awaitLayout(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            boolean[] measured = {false};
            scenario.onActivity(a -> {
                try {
                    View content = (View) field(a, "content"), root = (View) field(a, "root");
                    measured[0] = content.getWidth() > 0 && content.getHeight() > 0
                            && !content.isLayoutRequested() && !root.isLayoutRequested();
                } catch (Exception error) { throw new AssertionError(error); }
            });
            if (measured[0]) return;
            Thread.sleep(20);
        }
        fail("Native page did not finish layout");
    }

    private static void wakeAndUnlock() {
        DisplaySettings.shell("input keyevent KEYCODE_WAKEUP");
        DisplaySettings.shell("wm dismiss-keyguard");
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }

    private static void awaitWindowFocus(ActivityScenario<MainActivity> scenario) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            boolean[] focused = {false};
            scenario.onActivity(a -> focused[0] = a.hasWindowFocus());
            if (focused[0]) return;
            if (attempt == 20) wakeAndUnlock();
            Thread.sleep(50);
        }
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        android.app.KeyguardManager keyguard = (android.app.KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        android.os.PowerManager power = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        StringBuilder windows = new StringBuilder();
        for (String line : DisplaySettings.shell("dumpsys window windows").split("\\r?\\n"))
            if (line.contains("mCurrentFocus=") || line.contains("mFocusedApp=") || line.contains("mShowingLockscreen="))
                windows.append(line.trim()).append('\n');
        fail("Native Activity has no window focus; interactive=" + power.isInteractive()
                + ", keyguardLocked=" + keyguard.isKeyguardLocked() + "\n" + windows);
    }

    private static boolean containsText(View view, String text) {
        if (view instanceof TextView && text.contentEquals(((TextView) view).getText())) return true;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++)
            if (containsText(((ViewGroup) view).getChildAt(i), text)) return true;
        return false;
    }

    private static void awaitText(ActivityScenario<MainActivity> scenario, String text) throws Exception {
        for (int attempt = 0; attempt < 100; attempt++) {
            boolean[] found = {false};
            scenario.onActivity(a -> found[0] = containsText(a.findViewById(android.R.id.content), text));
            if (found[0]) return;
            Thread.sleep(50);
        }
        fail("Local screen did not appear: " + text);
    }

    private static Object field(Object object, String name) throws Exception {
        Field field = object.getClass().getDeclaredField(name); field.setAccessible(true); return field.get(object);
    }
    private static void set(Object object, String name, Object value) throws Exception {
        Field field = object.getClass().getDeclaredField(name); field.setAccessible(true); field.set(object, value);
    }
    private static void invoke(Object object, String name) throws Exception {
        Method method = object.getClass().getDeclaredMethod(name); method.setAccessible(true); method.invoke(object);
    }

    private static final class UpdateCheckState implements AutoCloseable {
        private final LocalStore store;
        private final String lastCheck, waiting;

        UpdateCheckState(Context context) {
            store = new LocalStore(context);
            lastCheck = store.get("update_last_check");
            waiting = store.get("update_waiting_documents");
        }

        void refresh() {
            store.put("update_last_check", Long.toString(System.currentTimeMillis()));
            store.put("update_waiting_documents", "");
        }

        @Override public void close() {
            try {
                store.put("update_last_check", lastCheck);
                store.put("update_waiting_documents", waiting);
            } finally { store.close(); }
        }
    }

    private static final class DisplaySettings implements AutoCloseable {
        private final String size = override(shell("wm size"), "Override size: (\\d+x\\d+)");
        private final String density = override(shell("wm density"), "Override density: (\\d+)");
        private final String fontScale = shell("settings get system font_scale").trim();

        void apply(String size, String fontScale) throws Exception {
            shell("wm size " + size); shell("wm density 160"); shell("settings put system font_scale " + fontScale);
            Thread.sleep(500);
            wakeAndUnlock();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        }

        @Override public void close() throws Exception {
            try {
                try { shell("wm size " + size); }
                finally {
                    try { shell("wm density " + density); }
                    finally { shell(fontScale.matches("[0-9.]+") ? "settings put system font_scale " + fontScale : "settings delete system font_scale"); }
                }
            } finally {
                Thread.sleep(500);
                wakeAndUnlock();
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            }
        }

        private static String override(String output, String pattern) {
            Matcher matcher = Pattern.compile(pattern).matcher(output); return matcher.find() ? matcher.group(1) : "reset";
        }

        private static String shell(String command) {
            try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(
                    InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[1024]; int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                String response = output.toString("UTF-8");
                if (response.contains("Error:") || response.contains("Exception")) throw new AssertionError(command + ": " + response);
                return response;
            } catch (Exception error) { throw new AssertionError(command, error); }
        }
    }
}
