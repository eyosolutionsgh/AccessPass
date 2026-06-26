package com.vms.kiosk;

import android.app.Activity;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.util.Log;

import java.lang.reflect.Method;
import java.util.Locale;

/**
 * Reader-mode NFC: surfaces a tapped tag's UID (uppercase hex) as the reusable visitor-tag id.
 * Used for both "tap NFC tag" at check-in (issue) and "tap to return" at check-out. No-ops cleanly
 * on devices without NFC.
 */
public final class NfcReader {
    private static final String TAG = "VmsKiosk";

    public interface OnTag {
        void onTag(String uid);
    }

    private final NfcAdapter adapter;

    public NfcReader(Activity act) {
        this.adapter = NfcAdapter.getDefaultAdapter(act);
    }

    public boolean isAvailable() {
        return adapter != null;
    }

    public void enable(Activity act, final OnTag cb) {
        if (adapter == null) return;
        if (!adapter.isEnabled()) tryEnableAdapter();
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V
                | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;
        try {
            adapter.enableReaderMode(act, new NfcAdapter.ReaderCallback() {
                @Override public void onTagDiscovered(Tag tag) {
                    String uid = toHex(tag.getId());
                    if (uid.length() > 0) cb.onTag(uid);
                }
            }, flags, null);
            Log.i(TAG, "NFC reader mode enabled.");
        } catch (Exception e) {
            Log.w(TAG, "enableReaderMode failed: " + e.getMessage());
        }
    }

    public void disable(Activity act) {
        if (adapter == null) return;
        try {
            adapter.disableReaderMode(act);
        } catch (Exception ignored) {}
    }

    /** Some POS terminals ship NFC off; the hidden enable() exists on many ZCS builds. */
    private void tryEnableAdapter() {
        try {
            Method enable = NfcAdapter.class.getDeclaredMethod("enable");
            enable.setAccessible(true);
            enable.invoke(adapter);
        } catch (Exception ignored) {}
    }

    private static String toHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02X", b));
        return sb.toString();
    }
}
