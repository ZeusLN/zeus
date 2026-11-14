package app.zeusln.zeus

import android.app.Application
import com.ReactNativeBlobUtil.ReactNativeBlobUtilUtils
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.websocket.WebSocketModule
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

import app.zeusln.zeus.cashudevkit.CashuDevKitPackage

class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())

                    // ZEUS
                    add(MobileToolsPackage())
                    add(LndMobilePackage())
                    add(LndMobileToolsPackage())
                    add(LndMobileScheduledSyncPackage())
                    add(LncPackage())
                    add(NostrConnectPackage())
                    add(StealthModePackage())
                    add(CashuDevKitPackage())
                    add(LdkNodePackage())
                    add(ZipUtilsPackage())
                    add(LockKdfPackage())
                },
        )
    }

    override fun onCreate() {
        super.onCreate()
        // OkHttp follows redirects on the WebSocket handshake and drops only
        // the Authorization header when the host changes, so an LND stream's
        // Grpc-Metadata-Macaroon header would be sent on to whatever host the
        // node URL redirects to. Browsers fail a WebSocket on a redirect, and
        // so does SocketRocket on iOS; a 3xx now fails the handshake here too.
        WebSocketModule.setCustomClientBuilder { builder ->
            builder.followRedirects(false).followSslRedirects(false)
        }
        loadReactNative(this)
        ReactNativeBlobUtilUtils.sharedTrustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> {
                return arrayOf()
            }
        }
    }
}
