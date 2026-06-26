package com.vms.kiosk;

import android.content.Context;
import android.util.Log;

import com.common.callback.IDecodeReaderListener;

import java.lang.reflect.Method;

/**
 * Bridges the device's built-in QR/barcode engine (ZCS T10 "HardReader" service) to a simple
 * callback. Everything is reflective so the app compiles and runs on hardware that lacks the
 * vendor SDK — {@link #isActive()} stays false there and the web app falls back to the camera.
 *
 * Mirrors the proven sequence in z92_hardware_tester: getSystemService("HardReader") →
 * open(115200) → addListener(IDecodeReaderListener).
 */
public final class HardwareScanner {
    private static final String TAG = "VmsKiosk";
    private static final String SERVICE_CLASS = "com.common.sdk.hardreader.HardReaderServiceManager";

    public interface OnScan {
        void onScan(String value);
    }

    private Object service;
    private IDecodeReaderListener listener;
    private boolean active;

    public boolean isActive() {
        return active;
    }

    public void start(Context ctx, final OnScan cb) {
        try {
            Object svc = ctx.getSystemService("HardReader");
            if (svc == null) {
                Log.i(TAG, "HardReader service unavailable; camera fallback will be used.");
                return;
            }
            service = svc;
            Class<?> svcClass = Class.forName(SERVICE_CLASS);

            try {
                Method open = svcClass.getMethod("open", int.class);
                open.invoke(svc, 115200);
            } catch (NoSuchMethodException e) {
                svcClass.getMethod("open").invoke(svc);
            }

            listener = new IDecodeReaderListener() {
                @Override public void onRecvData(byte[] data) {
                    String value = decode(data);
                    if (value.length() > 0) cb.onScan(value);
                }
            };
            svcClass.getMethod("addListener", IDecodeReaderListener.class).invoke(svc, listener);
            active = true;
            Log.i(TAG, "HardReader scanner active.");
        } catch (Throwable t) {
            active = false;
            Log.i(TAG, "HardReader startup failed (" + t.getClass().getSimpleName()
                    + "); camera fallback will be used.");
        }
    }

    public void stop() {
        active = false;
        if (service == null) return;
        try {
            Class<?> svcClass = Class.forName(SERVICE_CLASS);
            if (listener != null) {
                try {
                    svcClass.getMethod("removeListener", IDecodeReaderListener.class)
                            .invoke(service, listener);
                } catch (Throwable ignored) {}
            }
            try {
                svcClass.getMethod("close").invoke(service);
            } catch (Throwable ignored) {}
        } catch (Throwable ignored) {
        } finally {
            listener = null;
            service = null;
        }
    }

    /** Keep only printable ASCII; a real scan is at least a couple of chars. */
    private static String decode(byte[] data) {
        if (data == null || data.length == 0) return "";
        StringBuilder sb = new StringBuilder(data.length);
        for (byte b : data) {
            int c = b & 0xFF;
            if (c >= 32 && c <= 126) sb.append((char) c);
        }
        String s = sb.toString().trim();
        return s.length() >= 2 ? s : "";
    }
}
