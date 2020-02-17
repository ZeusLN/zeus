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

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;

public class Utilities {
    private static final int READ_TIMEOUT_MILLISECONDS = 60000;
    private static final int CONNECT_TIMEOUT_MILLISECONDS = 60000;

    private Utilities() {}

    /**
     * When making a request via the Tor Proxy one needs to establish the socket using SOCKS4a. However Android
     * only supports SOCKS4 so this class provides a wrapper when getting a socket to handle things.
     * @param networkHost DNS or IP address of destination host
     * @param networkPort Port of destination host
     * @param socksHost DNS or IP address of local SOCKS4A Proxy (the Tor Onion Proxy)
     * @param socksPort Port of SOCKS4A Proxy (the Tor Onion Proxy)
     * @return A socket set up to relay via socks to the local Tor Onion Proxy and via the Tor Network to the
     * destination host.
     * @throws IOException Networking issues
     */
    public static Socket socks4aSocketConnection(String networkHost, int networkPort, String socksHost, int socksPort)
            throws IOException {
        // Perform explicit SOCKS4a connection request. SOCKS4a supports remote host name resolution
        // (i.e., Tor resolves the hostname, which may be an onion address).
        // The Android (Apache Harmony) Socket class appears to support only SOCKS4 and throws an
        // exception on an address created using INetAddress.createUnresolved() -- so the typical
        // technique for using Java SOCKS4a/5 doesn't appear to work on Android:
        // https://android.googlesource.com/platform/libcore/+/master/luni/src/main/java/java/net/PlainSocketImpl.java
        // See also: http://www.mit.edu/~foley/TinFoil/src/tinfoil/TorLib.java, for a similar implementation

        // From http://en.wikipedia.org/wiki/SOCKS#SOCKS4a:
        //
        // field 1: SOCKS version number, 1 byte, must be 0x04 for this version
        // field 2: command code, 1 byte:
        //     0x01 = establish a TCP/IP stream connection
        //     0x02 = establish a TCP/IP port binding
        // field 3: network byte order port number, 2 bytes
        // field 4: deliberate invalid IP address, 4 bytes, first three must be 0x00 and the last one must not be 0x00
        // field 5: the user ID string, variable length, terminated with a null (0x00)
        // field 6: the domain name of the host we want to contact, variable length, terminated with a null (0x00)

        Socket socket = new Socket();
        socket.setSoTimeout(READ_TIMEOUT_MILLISECONDS);
        SocketAddress socksAddress = new InetSocketAddress(socksHost, socksPort);
        socket.connect(socksAddress, CONNECT_TIMEOUT_MILLISECONDS);

        DataOutputStream outputStream = new DataOutputStream(socket.getOutputStream());
        outputStream.write((byte)0x04);
        outputStream.write((byte)0x01);
        outputStream.writeShort((short)networkPort);
        outputStream.writeInt(0x01);
        outputStream.write((byte)0x00);
        outputStream.write(networkHost.getBytes());
        outputStream.write((byte)0x00);

        DataInputStream inputStream = new DataInputStream(socket.getInputStream());
        byte firstByte = inputStream.readByte();
        byte secondByte = inputStream.readByte();
        if (firstByte != (byte)0x00 || secondByte != (byte)0x5a) {
            socket.close();
            throw new IOException("SOCKS4a connect failed, got " + firstByte + " - " + secondByte +
                    ", but expected 0x00 - 0x5a");
        }
        inputStream.readShort();
        inputStream.readInt();
        return socket;
    }
}
