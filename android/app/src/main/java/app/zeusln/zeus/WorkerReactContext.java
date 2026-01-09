package app.zeusln.zeus;

import android.content.Context;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.CatalystInstance;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.JavaScriptContextHolder;
import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder;

import java.util.Collection;
import java.util.Collections;

/**
 * A minimal concrete implementation of ReactApplicationContext for use in Worker contexts
 * where the full React Native bridge is not available.
 */
public class WorkerReactContext extends ReactApplicationContext {

    public WorkerReactContext(Context context) {
        super(context);
    }

    @Override
    public <T extends JavaScriptModule> T getJSModule(Class<T> jsInterface) {
        throw new UnsupportedOperationException("JS modules not available in Worker context");
    }

    @Override
    public <T extends NativeModule> boolean hasNativeModule(Class<T> nativeModuleInterface) {
        return false;
    }

    @Override
    public Collection<NativeModule> getNativeModules() {
        return Collections.emptyList();
    }

    @Override
    public <T extends NativeModule> T getNativeModule(Class<T> nativeModuleInterface) {
        return null;
    }

    @Override
    @Nullable
    public NativeModule getNativeModule(String moduleName) {
        return null;
    }

    @Override
    public CatalystInstance getCatalystInstance() {
        throw new UnsupportedOperationException("CatalystInstance not available in Worker context");
    }

    @Override
    public boolean hasActiveCatalystInstance() {
        return false;
    }

    @Override
    public boolean hasActiveReactInstance() {
        return false;
    }

    @Override
    public boolean hasCatalystInstance() {
        return false;
    }

    @Override
    public boolean hasReactInstance() {
        return false;
    }

    @Override
    public void destroy() {
        // No-op in Worker context
    }

    @Override
    public void handleException(Exception e) {
        throw new RuntimeException(e);
    }

    @Override
    public boolean isBridgeless() {
        return true;
    }

    @Override
    @Nullable
    public JavaScriptContextHolder getJavaScriptContextHolder() {
        return null;
    }

    @Override
    @Nullable
    public CallInvokerHolder getJSCallInvokerHolder() {
        return null;
    }

    @Override
    @Nullable
    public UIManager getFabricUIManager() {
        return null;
    }

    @Override
    @Nullable
    public String getSourceURL() {
        return null;
    }

    @Override
    public void registerSegment(int segmentId, String path, Callback callback) {
        // No-op in Worker context
    }
}
