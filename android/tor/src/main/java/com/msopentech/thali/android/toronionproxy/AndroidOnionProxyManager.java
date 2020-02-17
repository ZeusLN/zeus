/*
Copyright (C) 2011-2014 Sublime Software Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

/*
Copyright (c) Microsoft Open Technologies, Inc.
All Rights Reserved
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED,
INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache 2 License for the specific language governing permissions and limitations under the License.
*/

package com.msopentech.thali.android.toronionproxy;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.util.Log;

import com.msopentech.thali.toronionproxy.OnionProxyManager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

import io.reactivex.android.schedulers.AndroidSchedulers;
import io.reactivex.disposables.Disposable;
import io.reactivex.schedulers.Schedulers;

public class AndroidOnionProxyManager extends OnionProxyManager {
    private static final Logger LOG = LoggerFactory.getLogger(AndroidOnionProxyManager.class);
    private Disposable onlineSubscription;
    private static final String TAG = "AndroidOnionProxyManage";

    private volatile BroadcastReceiver networkStateReceiver;
    private final Context context;

    public AndroidOnionProxyManager(Context context, String workingSubDirectoryName) {
        super(new AndroidOnionProxyContext(context, workingSubDirectoryName));
        this.context = context;
    }

    @Override
    public boolean installAndStartTorOp() throws IOException, InterruptedException {
        if (super.installAndStartTorOp()) {
            IntentFilter intentFilter = new IntentFilter();
            intentFilter.addAction(ConnectivityManager.CONNECTIVITY_ACTION);
            context.registerReceiver(new ConnectionChangeReceiver(), intentFilter);

            onlineSubscription = NetworkManager.getInstance().onlineSignal()
                    .debounce(100, TimeUnit.MILLISECONDS)
                    .observeOn(Schedulers.io())
                    .subscribeOn(AndroidSchedulers.mainThread())
                    .subscribe(this::enableNetwork, error->{
                Log.i(TAG, "installAndStartTorOp: ".concat(error.getMessage()));
            });
            return true;
        }
        return false;
    }

    @Override
    public void stop() throws IOException {
        try {
            super.stop();
        } finally {
            if (networkStateReceiver != null) {
                try {
                    onlineSubscription.dispose();
                } catch (IllegalArgumentException e) {
                    // There is a race condition where if someone calls stop before installAndStartTorOp is done
                    // then we could get an exception because the network state receiver might not be properly
                    // registered.
                    LOG.info("Someone tried to call stop before we had finished registering the receiver", e);
                }
            }
        }
    }

    @SuppressLint("NewApi")
    protected boolean setExecutable(File f) {
        return f.setExecutable(true, true);
    }


}
