package app.zeusln.zeus;

import app.zeusln.zeus.BuildConfig;

public class ZeusTorUtils {
  public static int getListenPort(Boolean isTestnet) {
    int listenPort = 9760;
    if (isTestnet) {
      listenPort += 10;
    }
    if (BuildConfig.DEBUG) {
      listenPort += 100;
    }
    return listenPort;
  }
}