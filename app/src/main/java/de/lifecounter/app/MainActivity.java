package de.lifecounter.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Vollbild-WebView für die Life-Counter-Web-App (assets/www).
 * minSdk 34 (Android 14): keine Kompatibilitätszweige für ältere Versionen nötig.
 */
public class MainActivity extends Activity {

    private static final int BG = Color.rgb(11, 12, 16);
    private static final String START_URL = "file:///android_asset/www/index.html";

    private WebView web;
    private Vibrator vibrator;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setDecorFitsSystemWindows(false);
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(lp);

        VibratorManager vm = getSystemService(VibratorManager.class);
        vibrator = vm != null ? vm.getDefaultVibrator() : null;

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true); // chrome://inspect im Debug-Build
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Inhalt nicht unter die Kamera-Aussparung legen – und symmetrisch halten:
        // unten so viel Abstand wie oben (abgerundete Ecken, Gestenleiste), links wie rechts.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets c = insets.getInsets(WindowInsets.Type.displayCutout());
            int vert = Math.max(c.top, c.bottom), hor = Math.max(c.left, c.right);
            v.setPadding(hor, vert, hor, vert);
            return WindowInsets.CONSUMED;
        });
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);      // Assets bleiben trotzdem erreichbar
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);               // Systemschriftgröße soll das Layout nicht sprengen

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);
        web.setHapticFeedbackEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl(START_URL);

        // Zurück-Geste: zuerst offene Dialoge in der Web-App schließen
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);

        hideSystemUi();
    }

    private void handleBack() {
        if (web == null) {
            finish();
            return;
        }
        web.evaluateJavascript("(window.__onBack && window.__onBack()) ? '1' : '0'", value -> {
            if (value == null || !value.contains("1")) finish();
        });
    }

    private void hideSystemUi() {
        WindowInsetsController c = getWindow().getInsetsController();
        if (c != null) {
            c.hide(WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.__save && window.__save()", null);
            web.onPause();
            web.pauseTimers(); // keine JS-Timer im Hintergrund -> spart Akku
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /* ================= Update-Check ================= */

    private String currentVersion() {
        try {
            String v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return v != null ? v : "0";
        } catch (PackageManager.NameNotFoundException e) {
            return "0";
        }
    }

    /** Fragt das neueste GitHub-Release ab. Läuft im Hintergrund-Thread, liefert JSON für die Web-App. */
    private String fetchUpdate(boolean manual) {
        JSONObject r = new JSONObject();
        try {
            String cur = currentVersion();
            r.put("manual", manual);
            r.put("current", cur);
            String repo = getString(R.string.update_repo);
            if (!repo.matches("[\\w.-]+/[\\w.-]+") || repo.startsWith("DEIN_USER")) {
                r.put("status", "disabled");
                return r.toString();
            }
            HttpURLConnection c = (HttpURLConnection) new URL(
                    "https://api.github.com/repos/" + repo + "/releases/latest").openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("User-Agent", "LifeCounter-Android");
            try {
                if (c.getResponseCode() != 200) {
                    r.put("status", "error");
                    r.put("code", c.getResponseCode());
                    return r.toString();
                }
                String body;
                try (InputStream in = c.getInputStream()) {
                    body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
                JSONObject rel = new JSONObject(body);
                String latest = rel.optString("tag_name", "").replaceFirst("^[vV]", "");
                String url = rel.optString("html_url", "https://github.com/" + repo + "/releases");
                JSONArray assets = rel.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject a = assets.getJSONObject(i);
                        if (a.optString("name").endsWith(".apk")) {
                            url = a.optString("browser_download_url", url);
                            break;
                        }
                    }
                }
                String notes = rel.optString("body", "").trim();
                if (notes.length() > 1500) notes = notes.substring(0, 1500) + " …";
                r.put("latest", latest);
                r.put("url", url);
                r.put("notes", notes);
                r.put("status", compareVersions(latest, cur) > 0 ? "update" : "current");
            } finally {
                c.disconnect();
            }
        } catch (Exception e) {
            try {
                r.put("status", "error");
            } catch (Exception ignored) {
            }
        }
        return r.toString();
    }

    /** Vergleicht Versionen wie 1.10.2 numerisch (Nicht-Ziffern werden ignoriert). */
    static int compareVersions(String a, String b) {
        String[] x = a.split("[.\\-+]"), y = b.split("[.\\-+]");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? parseNum(x[i]) : 0, q = i < y.length ? parseNum(y[i]) : 0;
            if (p != q) return Integer.compare(p, q);
        }
        return 0;
    }

    private static int parseNum(String s) {
        String d = s.replaceAll("\\D", "");
        try {
            return d.isEmpty() ? 0 : Integer.parseInt(d);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Wird im JavaScript als window.Android angesprochen. */
    public class Bridge {
        @JavascriptInterface
        public String version() {
            return currentVersion();
        }

        @JavascriptInterface
        public void checkUpdate(boolean manual) {
            new Thread(() -> {
                String json = fetchUpdate(manual);
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript(
                            "window.__onUpdate && window.__onUpdate(" + JSONObject.quote(json) + ")", null);
                });
            }, "update-check").start();
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || !url.startsWith("https://")) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = vibrator;
            if (v == null || !v.hasVibrator()) return;
            VibrationEffect e;
            if (ms <= 12) e = VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
            else if (ms <= 30) e = VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
            else if (ms <= 80) e = VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
            else e = VibrationEffect.createOneShot(Math.min(ms, 600), VibrationEffect.DEFAULT_AMPLITUDE);
            v.vibrate(e);
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = getSystemService(ClipboardManager.class);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Life Counter", text));
            });
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND)
                        .setType("text/plain")
                        .putExtra(Intent.EXTRA_TEXT, text);
                try {
                    startActivity(Intent.createChooser(i, "Protokoll teilen"));
                } catch (Exception ignored) {
                }
            });
        }
    }
}
