package com.common.callback;

/**
 * Vendor scanner callback (ZCS / T10 "HardReader" SDK). The real interface is provided by the
 * device's framework SDK at runtime; this declaration lets the app compile against it. The
 * fully-qualified name must match the vendor's so the system service accepts our listener.
 */
public interface IDecodeReaderListener {
    void onRecvData(byte[] data);
}
