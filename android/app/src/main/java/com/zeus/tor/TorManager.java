package com.zeusln.zeus;

import android.content.Context;
import android.util.Log;

import com.msopentech.thali.android.toronionproxy.AndroidOnionProxyManager;
import com.msopentech.thali.toronionproxy.OnionProxyManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.Socket;

import io.reactivex.Observable;
import io.reactivex.subjects.PublishSubject;
import io.reactivex.subjects.Subject;

public class TorManager {
    private static final String TAG = "TorManager";
    private boolean changingIdentity = false;

    public boolean newIDentity() {
        return this.onionProxyManager.newIdentity();
    }

    public enum CONNECTION_STATES {
        IDLE,
        CONNECTED,
        DISCONNECTED,
        CONNECTING
    }

    static TorManager instance;
    public int currentPort = 0;

    private Proxy proxy = null;
    public CONNECTION_STATES state = CONNECTION_STATES.IDLE;
    public Subject<CONNECTION_STATES> torStatus = PublishSubject.create();
    private OnionProxyManager onionProxyManager;
    public boolean isProcessRunning = false;
    String fileStorageLocation = "torfiles";

    private static Context context = null;

    public static TorManager getInstance(Context ctx) {

        context = ctx;

        if (instance == null) {
            instance = new TorManager(context);
        }
        return instance;
    }

    private TorManager(Context context) {

        torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
        onionProxyManager = new AndroidOnionProxyManager(context, fileStorageLocation);
    }

    public Observable<Proxy> startTor() {
        Log.i(TAG, "startTor: ");
        return Observable.fromCallable(() -> {
            state = CONNECTION_STATES.CONNECTING;
            torStatus.onNext(CONNECTION_STATES.CONNECTING);

            int totalSecondsPerTorStartup = 4 * 60;
            int totalTriesPerTorStartup = 5;
            try {
                boolean ok = onionProxyManager.startWithRepeat(totalSecondsPerTorStartup, totalTriesPerTorStartup);
                if (!ok) {
                    System.out.println("Couldn't start tor");
                    throw new RuntimeException("Couldn't start tor");
                }
                while (!onionProxyManager.isRunning())
                    Thread.sleep(90);
                proxy = new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", onionProxyManager.getIPv4LocalHostSocksPort()));
                currentPort = onionProxyManager.getIPv4LocalHostSocksPort();
                if (torStatus.hasObservers()) {
                    torStatus.onNext(CONNECTION_STATES.CONNECTED);
                }
                isProcessRunning = true;
                state = CONNECTION_STATES.CONNECTED;

                return proxy;
            } catch (Exception e) {
                e.printStackTrace();

                if (!onionProxyManager.isRunning()) {
                    state = CONNECTION_STATES.DISCONNECTED;
                    if (torStatus.hasObservers()) {
                        torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
                    }
                }
                e.printStackTrace();
                return proxy;
            }
        });

    }

    public String getLatestLogs() {
        try {
            if (onionProxyManager != null && onionProxyManager.isRunning()) {
                String log = onionProxyManager.getLastLog();
                try {
                    if (!TorManager.isPortOpen("127.0.0.1", onionProxyManager.getIPv4LocalHostSocksPort(), 4000)) {
                        this.state = CONNECTION_STATES.DISCONNECTED;
                        if (torStatus.hasObservers()) {
                            torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
                        }
                    }
                    int port = onionProxyManager.getIPv4LocalHostSocksPort();
                    if (currentPort != port) {
                        setProxy(port);
                    }

                } catch (Exception e) {
                    Log.i(TAG, "getLatestLogs: LOG");
                    e.printStackTrace();
                }
                return log;
            } else {
                return "Disconnected state";
            }
        } catch (IOException e) {
            e.printStackTrace();
            return "";
        }
    }

    private void setProxy(int port) {
        this.proxy = new Proxy(Proxy.Type.SOCKS, new InetSocketAddress("127.0.0.1", port));
    }

    public boolean isConnected() {
        Log.i(TAG, "isConnected: ");
        return this.state == CONNECTION_STATES.CONNECTED;
    }

    public Proxy getProxy() {
        return proxy;
    }

    public Observable<Boolean> stopTor() {
        Log.i(TAG, "stopTor: ");
        if (torStatus.hasObservers()) {
            torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
            state = CONNECTION_STATES.DISCONNECTED;
        }
        return Observable.fromCallable(() -> {
            try {
                this.state = CONNECTION_STATES.DISCONNECTED;
                if (torStatus.hasObservers()) {
                    torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
                }
                isProcessRunning = false;
            } catch (Exception ex) {
                ex.printStackTrace();
                this.state = CONNECTION_STATES.DISCONNECTED;
                if (torStatus.hasObservers()) {
                    torStatus.onNext(CONNECTION_STATES.DISCONNECTED);
                }
                isProcessRunning = false;
                return false;
            }

            return true;
        });

    }

    public Subject<CONNECTION_STATES> getTorStatus() {
        return torStatus;
    }


    public void setTorState(CONNECTION_STATES state) {
        this.state = state;
        if (torStatus.hasObservers()) {
            torStatus.onNext(state);
        }
    }

    public static boolean isPortOpen(final String ip, final int port, final int timeout) {

        try {
            Socket socket = new Socket();
            socket.connect(new InetSocketAddress(ip, port), timeout);
            socket.close();
            return true;
        } catch (ConnectException ce) {
            ce.printStackTrace();
            return false;
        } catch (Exception ex) {
            ex.printStackTrace();
            return false;
        }
    }
}
