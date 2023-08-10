package app.zeusln.zeus;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;

public abstract class PromiseWrapper implements Promise {
  abstract void onSuccess(@Nullable Object value);

  abstract void onFail(Throwable throwable);

  @Override
  public void resolve(@Nullable Object value) { onSuccess(value); }
  @Override
  public void reject(String code, String message) { onFail(new Error(message)); }
  @Override
  public void reject(String code, Throwable throwable) { onFail(throwable); }
  @Override
  public void reject(String code, String message, Throwable throwable) { onFail(throwable); }
  @Override
  public void reject(Throwable throwable) { onFail(throwable); }
  @Override
  public void reject(Throwable throwable, WritableMap userInfo) { onFail(throwable); }
  @Override
  public void reject(String code, @NonNull WritableMap userInfo) { onFail(new Error(code)); }
  @Override
  public void reject(String code, Throwable throwable, WritableMap userInfo) { onFail(throwable); }
  @Override
  public void reject(String code, String message, @NonNull WritableMap userInfo) { onFail(new Error(message)); }
  @Override
  public void reject(String code, String message, Throwable throwable, WritableMap userInfo) { onFail(throwable); }
  @Override
  public void reject(String message) { onFail(new Error(message)); }
}