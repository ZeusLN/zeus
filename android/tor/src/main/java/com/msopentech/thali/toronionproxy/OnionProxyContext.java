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

package com.msopentech.thali.toronionproxy;

import android.util.Log;

import com.msopentech.thali.android.toronionproxy.torinstaller.TorResourceInstaller;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * This class encapsulates data that is handled differently in Java and Android as well
 * as managing file locations.
 */
abstract public class OnionProxyContext {
    protected final static String HIDDENSERVICE_DIRECTORY_NAME = "hiddenservice";
    protected final static String GEO_IP_NAME = "geoip";
    protected final static String GEO_IPV_6_NAME = "geoip6";
    protected final static String TORRC_NAME = "torrc";
    protected final static String TORBINARY_KEY = "tor.so";
    protected final static String PID_NAME = "pid";
    protected final File workingDirectory;
    protected final File geoIpFile;
    protected final File geoIpv6File;
    protected final File torrcFile;
    protected File torExecutableFile;
    protected final File cookieFile;
    protected final File hostnameFile;
    protected final File pidFile;
    private static final String TAG = "OnionProxyContext";

    public OnionProxyContext(File workingDirectory) {
        this.workingDirectory = workingDirectory;
        geoIpFile = new File(getWorkingDirectory(), GEO_IP_NAME);
        geoIpv6File = new File(getWorkingDirectory(), GEO_IPV_6_NAME);
        torrcFile = new File(getWorkingDirectory(), TORRC_NAME);
        torExecutableFile = new File(getWorkingDirectory(), TORBINARY_KEY);
        cookieFile = new File(getWorkingDirectory(), ".tor/control_auth_cookie");
        hostnameFile = new File(getWorkingDirectory(), "/" + HIDDENSERVICE_DIRECTORY_NAME + "/hostname");
        pidFile = new File(getWorkingDirectory(), PID_NAME);
    }

    public void installFiles() throws IOException, InterruptedException {
        // This is sleezy but we have cases where an old instance of the Tor OP needs an extra second to
        // clean itself up. Without that time we can't do things like delete its binary (which we currently
        // do by default, something we hope to fix with https://github.com/thaliproject/Tor_Onion_Proxy_Library/issues/13
        Thread.sleep(1000, 0);

        if (!workingDirectory.exists() && !workingDirectory.mkdirs()) {
            throw new RuntimeException("Could not create root directory!");
        }
        Log.i(TAG, "installFiles: ".concat("".concat(String.valueOf(getAssetOrResourceByName(GEO_IP_NAME).available()))));

        try {
            TorResourceInstaller torResourceInstaller = this.getTorInstaller();

            File fileTorBin = torResourceInstaller.installResources();

            Log.i(TAG, "installFiles: fileTorBin ".concat(fileTorBin.getAbsolutePath()));
            if (!fileTorBin.getAbsolutePath().contains("app_torfiles")) {
                FileUtilities.cleanInstallOneFile(new FileInputStream(fileTorBin), new File(getWorkingDirectory(), TORBINARY_KEY));
            }
            FileUtilities.cleanInstallOneFile(getAssetOrResourceByName(GEO_IP_NAME), geoIpFile);
            FileUtilities.cleanInstallOneFile(getAssetOrResourceByName(GEO_IPV_6_NAME), geoIpv6File);
            FileUtilities.cleanInstallOneFile(getAssetOrResourceByName(TORRC_NAME), torrcFile);

            boolean success = fileTorBin != null && fileTorBin.canExecute();
            Log.i(TAG, "installFiles: success ".concat(String.valueOf(success)));

        } catch (IOException e) {
            e.printStackTrace();

            Log.i(TAG, "installFiles: ".concat(e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            Log.i(TAG, "installFiles: ".concat(e.getMessage()));

        }
    }

    /**
     * Sets environment variables and working directory needed for Tor
     *
     * @param processBuilder we will call start on this to run Tor
     */
    public void setEnvironmentArgsAndWorkingDirectoryForStart(ProcessBuilder processBuilder) {
        processBuilder.directory(getWorkingDirectory());
        Map<String, String> environment = processBuilder.environment();
        environment.put("HOME", getWorkingDirectory().getAbsolutePath());
        switch (OsData.getOsType()) {
            case LINUX_32:
            case LINUX_64:
                // We have to provide the LD_LIBRARY_PATH because when looking for dynamic libraries
                // Linux apparently will not look in the current directory by default. By setting this
                // environment variable we fix that.
                environment.put("LD_LIBRARY_PATH", getWorkingDirectory().getAbsolutePath());
                break;
            default:
                break;
        }
    }

    public String[] getEnvironmentArgsForExec() {
        List<String> envArgs = new ArrayList<String>();
        envArgs.add("HOME=" + getWorkingDirectory().getAbsolutePath());
        switch (OsData.getOsType()) {
            case LINUX_32:
            case LINUX_64:
                // We have to provide the LD_LIBRARY_PATH because when looking for dynamic libraries
                // Linux apparently will not look in the current directory by default. By setting this
                // environment variable we fix that.
                envArgs.add("LD_LIBRARY_PATH=" + getWorkingDirectory().getAbsolutePath());
                break;
            default:
                break;
        }
        return envArgs.toArray(new String[envArgs.size()]);
    }

    public File getGeoIpFile() {
        return geoIpFile;
    }

    public File getGeoIpv6File() {
        return geoIpv6File;
    }

    public File getTorrcFile() {
        return torrcFile;
    }

    public File getCookieFile() {
        return cookieFile;
    }

    public File getHostNameFile() {
        return hostnameFile;
    }

    public File getTorExecutableFile() {
        return torExecutableFile;
    }

    public File getWorkingDirectory() {
        return workingDirectory;
    }

    public File getPidFile() {
        return pidFile;
    }

    public void deleteAllFilesButHiddenServices() throws InterruptedException {
        // It can take a little bit for the Tor OP to detect the connection is dead and kill itself
        Thread.sleep(1000, 0);
        for (File file : getWorkingDirectory().listFiles()) {
            if (file.isDirectory()) {
                if (file.getName().compareTo(HIDDENSERVICE_DIRECTORY_NAME) != 0) {
                    FileUtilities.recursiveFileDelete(file);
                }
            } else {
                if (!file.delete()) {
                    throw new RuntimeException("Could not delete file " + file.getAbsolutePath());
                }
            }
        }
    }

    abstract public String getProcessId();

    abstract public WriteObserver generateWriteObserver(File file);

    abstract protected InputStream getAssetOrResourceByName(String fileName) throws IOException;

    abstract protected TorResourceInstaller getTorInstaller();
}
