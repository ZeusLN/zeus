// Excerpt of react-native-blob-util 0.25.1
// android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilReq.java
// lines 559-643 as patched by patches/patch-blob-util-no-retry.mjs at
// 8f029cd88 (interceptor and retry edits, no 503 edit), used by
// patches/patch-blob-util-no-retry.test.ts
            // #156 fix cookie issue
            final Request req = builder.build();
            clientBuilder.addNetworkInterceptor(new Interceptor() {
                @NonNull
                @Override
                public Response intercept(@NonNull Chain chain) throws IOException {
                    redirects.add(chain.request().url().toString());
                    return chain.proceed(chain.request());
                }
            });
            // Add request interceptor for upload progress event
            clientBuilder.addInterceptor(new Interceptor() {
                @NonNull
                @Override
                public Response intercept(@NonNull Chain chain) throws IOException {
                    Response originalResponse = null;
                    try {
                        originalResponse = chain.proceed(req);
                        ResponseBody extended;
                        switch (responseType) {
                            case KeepInMemory:
                                extended = new ReactNativeBlobUtilDefaultResp(
                                        ReactNativeBlobUtilImpl.RCTContext,
                                        taskId,
                                        originalResponse.body(),
                                        options.increment);
                                break;
                            case FileStorage:
                                extended = new ReactNativeBlobUtilFileResp(
                                        ReactNativeBlobUtilImpl.RCTContext,
                                        taskId,
                                        originalResponse.body(),
                                        destPath,
                                        options.overwrite);
                                break;
                            default:
                                extended = new ReactNativeBlobUtilDefaultResp(
                                        ReactNativeBlobUtilImpl.RCTContext,
                                        taskId,
                                        originalResponse.body(),
                                        options.increment);
                                break;
                        }
                        return originalResponse.newBuilder().body(extended).build();
                    } catch (IOException e) {
                        // ZEUS PATCH: blob-util-no-retry
                        // Report the failure instead of sending the request
                        // again: the server may already have acted on it.
                        if (e instanceof SocketException || e instanceof SocketTimeoutException) {
                            timeout = true;
                        }
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        throw e;
                    } catch (Exception ex) {
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        throw new IOException(ex);
                    }
                }
            });


            if (options.timeout >= 0) {
                clientBuilder.connectTimeout(options.timeout, TimeUnit.MILLISECONDS);
            }
            // For file-to-disk downloads use no read timeout: the 60-second default
            // can fire on slow connections before a large file finishes transferring.
            // Individual socket reads on a healthy connection take milliseconds, so
            // there is no risk of hanging indefinitely; the user can always cancel().
            if (responseType == ResponseType.FileStorage) {
                clientBuilder.readTimeout(0, TimeUnit.MILLISECONDS);
            } else if (options.timeout >= 0) {
                clientBuilder.readTimeout(options.timeout, TimeUnit.MILLISECONDS);
            }

            clientBuilder.connectionPool(pool);
            clientBuilder.retryOnConnectionFailure(false);
            clientBuilder.followRedirects(options.followRedirect);
            clientBuilder.followSslRedirects(options.followRedirect);
            // ZEUS PATCH: blob-util-no-connection-retry
            // OkHttp may resend a request it already sent after a
            // connection failure; only allow that for idempotent methods
            clientBuilder.retryOnConnectionFailure("GET".equals(method) || "HEAD".equals(method));

