package com.vms.kiosk;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Method;

/**
 * Badge printing. Two paths:
 *  1. {@link #tryVendorPrint} — direct thermal print via the ZCS printer SDK (reflection, so it
 *     compiles without the vendor jar and degrades to a no-op when absent). This is the unattended
 *     kiosk path; an integrator drops the SDK jar onto the classpath to light it up.
 *  2. {@link #renderBadgePdf} — always renders the badge to a PDF on disk and returns the path, so
 *     there is a tangible, testable artifact even with no printer attached.
 */
public final class VendorPrinter {
    private static final String TAG = "VmsKiosk";

    private VendorPrinter() {}

    /** A printed thermal slip is ~58mm wide → 384px at 203dpi. */
    private static final int PAGE_W = 384;
    private static final int PAGE_H = 560;

    public static File renderBadgePdf(Context ctx, JSONObject badge) {
        PdfDocument doc = new PdfDocument();
        try {
            PdfDocument.Page page = doc.startPage(
                    new PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, 1).create());
            Canvas c = page.getCanvas();
            Paint p = new Paint();
            p.setAntiAlias(true);

            int x = 28;
            int y = 56;
            p.setTextSize(20f);
            p.setFakeBoldText(true);
            c.drawText("VISITOR", x, y, p);
            y += 14;
            p.setTextSize(11f);
            p.setFakeBoldText(false);
            c.drawText(opt(badge, "facilityName", ""), x, y, p);

            y += 40;
            p.setTextSize(26f);
            p.setFakeBoldText(true);
            c.drawText(opt(badge, "visitorName", "Visitor"), x, y, p);

            p.setFakeBoldText(false);
            p.setTextSize(13f);
            String org = opt(badge, "organization", "");
            if (!org.isEmpty()) {
                y += 26;
                c.drawText(org, x, y, p);
            }

            y += 40;
            String host = opt(badge, "hostName", "");
            if (!host.isEmpty()) c.drawText("Host: " + host, x, y, p);

            y += 24;
            c.drawText("Date: " + opt(badge, "date", ""), x, y, p);

            y += 40;
            p.setTextSize(22f);
            p.setFakeBoldText(true);
            c.drawText("# " + opt(badge, "badgeNumber", ""), x, y, p);

            doc.finishPage(page);

            File dir = new File(ctx.getExternalFilesDir(null), "badges");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            String num = opt(badge, "badgeNumber", "badge").replaceAll("[^A-Za-z0-9_-]", "_");
            File out = new File(dir, "badge-" + num + ".pdf");
            try (FileOutputStream fos = new FileOutputStream(out)) {
                doc.writeTo(fos);
            }
            return out;
        } catch (Exception e) {
            Log.w(TAG, "Badge PDF render failed: " + e.getMessage());
            return null;
        } finally {
            doc.close();
        }
    }

    /**
     * Best-effort direct thermal print via the ZCS SDK. Returns true only if the whole reflective
     * sequence succeeds on real hardware; any missing class/method → false (caller falls back).
     */
    public static boolean tryVendorPrint(Context ctx, JSONObject badge) {
        try {
            Class<?> dmClass = Class.forName("com.zcs.sdk.DriverManager");
            Object dm = dmClass.getMethod("getInstance").invoke(null);
            Object printer = dmClass.getMethod("getPrinter").invoke(dm);
            if (printer == null) return false;

            // PrnStrFormat describes one line's size/alignment.
            Class<?> fmtClass = Class.forName("com.zcs.sdk.print.PrnStrFormat");
            Object fmt = fmtClass.getConstructor().newInstance();
            try { fmtClass.getMethod("setTextSize", int.class).invoke(fmt, 28); } catch (Throwable ignored) {}

            Class<?> printerClass = printer.getClass();
            Method append = printerClass.getMethod("setPrintAppendString", String.class, fmtClass);
            append.invoke(printer, "VISITOR", fmt);
            append.invoke(printer, opt(badge, "visitorName", "Visitor"), fmt);
            String host = opt(badge, "hostName", "");
            if (!host.isEmpty()) append.invoke(printer, "Host: " + host, fmt);
            append.invoke(printer, "# " + opt(badge, "badgeNumber", ""), fmt);
            append.invoke(printer, "\n\n", fmt);

            // Different SDK builds name the trigger print()/setPrintStart(); try both.
            try {
                printerClass.getMethod("print").invoke(printer);
            } catch (NoSuchMethodException e) {
                printerClass.getMethod("setPrintStart").invoke(printer);
            }
            Log.i(TAG, "Vendor thermal print submitted.");
            return true;
        } catch (Throwable t) {
            Log.i(TAG, "Vendor printer unavailable (" + t.getClass().getSimpleName() + ").");
            return false;
        }
    }

    private static String opt(JSONObject o, String key, String def) {
        String v = o.optString(key, def);
        return (v == null || v.equals("null")) ? def : v;
    }
}
