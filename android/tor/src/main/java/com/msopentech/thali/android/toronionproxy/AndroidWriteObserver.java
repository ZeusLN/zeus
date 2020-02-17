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

import android.os.FileObserver;
import com.msopentech.thali.toronionproxy.WriteObserver;

import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Adapted from the Briar WriteObserver code
 */
public class AndroidWriteObserver extends FileObserver implements WriteObserver {
    private final CountDownLatch countDownLatch = new CountDownLatch(1);

    public AndroidWriteObserver(File file) {
        super(file.getAbsolutePath(), CLOSE_WRITE);

        if (!file.exists()) {
            throw new IllegalArgumentException("FileObserver doesn't work properly on files that don't already exist.");
        }

        this.startWatching();
    }

    @Override
    public boolean poll(long timeout, TimeUnit unit) {
        try {
            return countDownLatch.await(timeout, unit);
        } catch (InterruptedException e) {
            throw new RuntimeException("Internal error has caused AndroidWriteObserver to not be reliable.", e);
        }
    }

    @Override
    public void onEvent(int i, String s) {
        stopWatching();
        countDownLatch.countDown();
    }
}
