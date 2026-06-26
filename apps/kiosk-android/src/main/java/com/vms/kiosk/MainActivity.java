package com.vms.kiosk;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;

/**
 * VMS kiosk shell. A full-screen WebView that loads the on-prem VMS web app and injects a
 * {@code window.kiosk} bridge matching apps/web's {@code KioskBridge}: the same check-in UI runs on
 * a plain browser (camera QR, no print) and, here, gains native hardware — vendor QR scanner, NFC
 * tag tap, and badge printing — selected per-device by the server's Device Profile.
 *
 * The bridge is intentionally thin: all visitor/business logic stays in the web app + tRPC API;
 * this shell only marshals hardware events to/from JS.
 */
public class MainActivity extends Activity {
    private static final String TAG = "VmsKiosk";
    private static final int REQ_CAMERA = 1001;

    private WebView webView;
    private KioskConfig config;
    private NfcReader nfc;
    private final HardwareScanner scanner = new HardwareScanner();
    private final Handler main = new Handler(Looper.getMainLooper());

    // One-shot request ids awaiting a hardware event (null = nothing armed). Set on a binder
    // thread by the JS bridge, cleared on the UI/reader thread when the event arrives.
    private volatile String scanReqId;
    private volatile String nfcReqId;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        config = KioskConfig.load(this);
        nfc = new NfcReader(this);
        ensureCameraPermission();

        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
        webView.loadUrl(config.startUrl());
        Log.i(TAG, "Loading " + config.startUrl() + " as device " + config.deviceId);
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // camera QR scanner can start without a tap
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setAllowFileAccess(false);

        webView.addJavascriptInterface(new Bridge(), "AndroidKiosk");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest request) {
                // Grant the in-page camera request (QR fallback); the OS-level CAMERA grant is
                // requested separately in ensureCameraPermission().
                main.post(new Runnable() {
                    @Override public void run() { request.grant(request.getResources()); }
                });
            }

            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, "web: " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap f) {
                injectBridge(); // before deferred module scripts run, so window.kiosk exists at mount
            }

            @Override public void onPageFinished(WebView v, String url) {
                injectBridge(); // backstop
            }

            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return false; // keep all navigation inside the kiosk WebView
            }
        });
    }

    /** Installs window.kiosk in the current page (idempotent). */
    private void injectBridge() {
        webView.evaluateJavascript(BRIDGE_JS, null);
    }

    // ── Hardware lifecycle ────────────────────────────────────────────────────

    @Override protected void onResume() {
        super.onResume();
        immersive();
        scanner.start(this, new HardwareScanner.OnScan() {
            @Override public void onScan(String value) { onScanned(value); }
        });
        nfc.enable(this, new NfcReader.OnTag() {
            @Override public void onTag(String uid) { onTagged(uid); }
        });
        if (config != null && config.lockTask) {
            try { startLockTask(); } catch (Throwable t) { Log.w(TAG, "lockTask: " + t.getMessage()); }
        }
    }

    @Override protected void onPause() {
        super.onPause();
        scanner.stop();
        nfc.disable(this);
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        // Never leave the app from a kiosk; a stray Back returns to the idle check-in screen.
        if (webView != null) webView.loadUrl(config.startUrl());
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    private void ensureCameraPermission() {
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
        }
    }

    // ── Hardware events → resolve any armed JS request ─────────────────────────

    private void onScanned(String value) {
        String id = scanReqId;
        if (id != null) {
            scanReqId = null;
            resolveString(id, value);
        }
    }

    private void onTagged(String uid) {
        String id = nfcReqId;
        if (id != null) {
            nfcReqId = null;
            resolveString(id, uid);
        }
    }

    private void armScan(String reqId) {
        if (!scanner.isActive()) { resolveNull(reqId); return; }   // no vendor reader → camera path
        String old = scanReqId;
        if (old != null) resolveNull(old);
        scanReqId = reqId;
        scheduleTimeout(reqId, true);
    }

    private void armNfc(String reqId) {
        if (!nfc.isAvailable()) { resolveNull(reqId); return; }
        String old = nfcReqId;
        if (old != null) resolveNull(old);
        nfcReqId = reqId;
        scheduleTimeout(reqId, false);
    }

    /** Don't leave a Promise hanging if no card/code arrives. */
    private void scheduleTimeout(final String reqId, final boolean scan) {
        main.postDelayed(new Runnable() {
            @Override public void run() {
                if (scan && reqId.equals(scanReqId)) { scanReqId = null; resolveNull(reqId); }
                if (!scan && reqId.equals(nfcReqId)) { nfcReqId = null; resolveNull(reqId); }
            }
        }, 30_000);
    }

    private void doPrint(final String reqId, final String badgeJson) {
        main.post(new Runnable() {
            @Override public void run() {
                JSONObject result = new JSONObject();
                try {
                    JSONObject badge = new JSONObject(badgeJson);
                    boolean vendor = VendorPrinter.tryVendorPrint(MainActivity.this, badge);
                    File pdf = VendorPrinter.renderBadgePdf(MainActivity.this, badge);
                    result.put("ok", vendor || pdf != null);
                    result.put("via", vendor ? "vendor" : "pdf");
                    if (pdf != null) result.put("path", pdf.getAbsolutePath());
                } catch (Exception e) {
                    try { result.put("ok", false); } catch (Exception ignored) {}
                }
                resolveRaw(reqId, result.toString());
            }
        });
    }

    // ── JS resolution helpers ──────────────────────────────────────────────────

    private void resolveString(String reqId, String value) {
        resolveRaw(reqId, JSONObject.quote(value));
    }

    private void resolveNull(String reqId) {
        resolveRaw(reqId, "null");
    }

    /** value is a literal JS/JSON expression (already quoted/escaped). */
    private void resolveRaw(final String reqId, final String value) {
        main.post(new Runnable() {
            @Override public void run() {
                if (webView == null) return;
                String js = "if(window.__kioskResolve)window.__kioskResolve("
                        + JSONObject.quote(reqId) + "," + value + ")";
                webView.evaluateJavascript(js, null);
            }
        });
    }

    // ── The @JavascriptInterface surface (runs on a binder thread) ─────────────

    private final class Bridge {
        @android.webkit.JavascriptInterface
        public String getConfig() {
            return config.toBridgeJson().toString();
        }

        @android.webkit.JavascriptInterface
        public void scanQr(String reqId) { armScan(reqId); }

        @android.webkit.JavascriptInterface
        public void readNfc(String reqId) { armNfc(reqId); }

        @android.webkit.JavascriptInterface
        public void issueTag(String reqId) { armNfc(reqId); } // a tapped card's UID becomes the tag

        @android.webkit.JavascriptInterface
        public void printBadge(String reqId, String badgeJson) { doPrint(reqId, badgeJson); }

        @android.webkit.JavascriptInterface
        public void reset(String reqId) {
            main.post(new Runnable() {
                @Override public void run() {
                    if (webView != null) webView.loadUrl(config.startUrl());
                }
            });
            resolveRaw(reqId, "{\"ok\":true}");
        }
    }

    // ── Injected JS: builds window.kiosk over the AndroidKiosk interface ───────

    private static final String BRIDGE_JS =
            "(function(){"
            + "if(window.__kioskInstalled)return;window.__kioskInstalled=true;"
            + "var pending={},seq=0;"
            + "window.__kioskResolve=function(id,value){var p=pending[id];if(!p)return;delete pending[id];try{p(value);}catch(e){}};"
            + "var cfg={};try{cfg=JSON.parse(AndroidKiosk.getConfig());}catch(e){}"
            + "try{if(cfg.deviceId)localStorage.setItem('vms.kiosk.deviceId',cfg.deviceId);}catch(e){}"
            + "function call(m){return new Promise(function(res){var id=String(++seq);pending[id]=res;try{AndroidKiosk[m](id);}catch(e){delete pending[id];res(null);}});}"
            + "window.kiosk={isKiosk:true,config:cfg,"
            + "printBadge:function(b){return new Promise(function(res){var id=String(++seq);pending[id]=res;try{AndroidKiosk.printBadge(id,JSON.stringify(b));}catch(e){delete pending[id];res({ok:false});}});},"
            + "reset:function(){return call('reset');},"
            + "scanQr:function(){return call('scanQr');},"
            + "readNfc:function(){return call('readNfc');},"
            + "issueTag:function(){return call('issueTag');}};"
            + "try{window.dispatchEvent(new Event('kioskready'));}catch(e){}"
            + "})();";
}
