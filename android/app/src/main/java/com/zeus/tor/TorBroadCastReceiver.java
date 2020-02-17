package com.zeusln.zeus;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class TorBroadCastReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Intent serviceIntent = new Intent(context, TorService.class);
        serviceIntent.setAction(intent.getAction());
        context.startService(serviceIntent);

    }
}
