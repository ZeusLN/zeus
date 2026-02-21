package app.zeusln.zeus

import android.app.Application
import com.ReactNativeBlobUtil.ReactNativeBlobUtilUtils
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
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
                    add(CashuDevKitPackage())
                },
        )
    }

    override fun onCreate() {
        super.onCreate()
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
