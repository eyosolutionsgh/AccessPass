package com.vms.kiosk;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

/**
 * Kiosk runtime config. Loaded from {@code <externalFilesDir>/kiosk-config.json} when present
 * (so an installed device can be re-pointed without rebuilding), otherwise from the bundled
 * {@code assets/kiosk-config.json}. Drives which on-prem server to load and the device's identity.
 */
public final class KioskConfig {
    private static final String TAG = "VmsKiosk";
    private static final String FILE_NAME = "kiosk-config.json";

    public final String webUrl;
    public final String startPath;
    public final String deviceId;
    public final String facilityId;
    public final boolean lockTask;

    private KioskConfig(JSONObject o) {
        this.webUrl = o.optString("webUrl", "http://10.0.2.2:5173");
        this.startPath = o.optString("startPath", "/check-in");
        this.deviceId = o.optString("deviceId", "kiosk-android-1");
        this.facilityId = o.optString("facilityId", "");
        this.lockTask = o.optBoolean("lockTask", false);
    }

    public static KioskConfig load(Context ctx) {
        JSONObject json = readOverride(ctx);
        if (json == null) json = readAsset(ctx);
        if (json == null) json = new JSONObject();
        return new KioskConfig(json);
    }

    /** Absolute URL the WebView should open on launch. */
    public String startUrl() {
        String base = webUrl.endsWith("/") ? webUrl.substring(0, webUrl.length() - 1) : webUrl;
        String path = startPath.startsWith("/") ? startPath : "/" + startPath;
        return base + path;
    }

    /** The config the JS bridge exposes as {@code window.kiosk.config} (no secrets). */
    public JSONObject toBridgeJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("deviceId", deviceId);
            o.put("webUrl", webUrl);
            if (!facilityId.isEmpty()) o.put("facilityId", facilityId);
        } catch (Exception ignored) {}
        return o;
    }

    private static JSONObject readOverride(Context ctx) {
        try {
            File f = new File(ctx.getExternalFilesDir(null), FILE_NAME);
            if (!f.exists()) return null;
            try (FileInputStream in = new FileInputStream(f)) {
                JSONObject o = new JSONObject(readAll(in));
                Log.i(TAG, "Loaded config override from " + f.getAbsolutePath());
                return o;
            }
        } catch (Exception e) {
            Log.w(TAG, "Config override unreadable: " + e.getMessage());
            return null;
        }
    }

    private static JSONObject readAsset(Context ctx) {
        try (InputStream in = ctx.getAssets().open(FILE_NAME)) {
            return new JSONObject(readAll(in));
        } catch (Exception e) {
            Log.w(TAG, "Asset config unreadable: " + e.getMessage());
            return null;
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }
}
