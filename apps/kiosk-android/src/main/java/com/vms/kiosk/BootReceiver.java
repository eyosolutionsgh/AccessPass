package com.vms.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Brings the kiosk back to the foreground after the device reboots (a power blip must not leave
 * the terminal parked on the Android launcher). Fires on {@code BOOT_COMPLETED} — and the OEM
 * "quick boot" variants some tablets send instead — then cold-starts {@link MainActivity}.
 *
 * <p>Redundant on a device where this app is the Home launcher (the manifest declares the
 * {@code HOME} category, so a reboot already lands here), but essential on a consumer tablet where
 * VMS is just an installed app. Opt out per-device with {@code "relaunchOnBoot": false}.
 */
public final class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "VmsKiosk";

    @Override public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
                && !"com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }
        if (!KioskConfig.load(context).relaunchOnBoot) {
            Log.i(TAG, "Boot relaunch disabled by config");
            return;
        }
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(launch);
        Log.i(TAG, "Relaunched kiosk after " + action);
    }
}
