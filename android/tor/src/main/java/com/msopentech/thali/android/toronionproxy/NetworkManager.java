package com.msopentech.thali.android.toronionproxy;

import java.util.concurrent.TimeUnit;

import io.reactivex.Observable;
import io.reactivex.Observer;
import io.reactivex.subjects.PublishSubject;

public class NetworkManager {
    private static NetworkManager instance = null;

    private NetworkManager() {

    }

    public static NetworkManager getInstance() {
        if (instance == null) {
            instance = new NetworkManager();
        }
        return instance;
    }

    private PublishSubject<Boolean> onlineSubject = PublishSubject.create();

    public Observable<Boolean> onlineSignal() {
        return onlineSubject;
    }

    Observer<Boolean> onlineObserver() {
        return onlineSubject;
    }

}