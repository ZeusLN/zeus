// Excerpt of react-native-blob-util 0.25.1
// android/src/main/java/com/ReactNativeBlobUtil/ReactNativeBlobUtilReq.java
// lines 559-643, used by patches/patch-blob-util-no-retry.test.ts
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
                    } catch (SocketException e) {
                        timeout = true;
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                    } catch (SocketTimeoutException e) {
                        timeout = true;
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                        //ReactNativeBlobUtilUtils.emitWarningEvent("ReactNativeBlobUtil error when sending request : " + e.getLocalizedMessage());
                    } catch (Exception ex) {
                        if (originalResponse != null) {
                            originalResponse.close();
                        }
                    }

                    return chain.proceed(chain.request());
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
            clientBuilder.retryOnConnectionFailure(true);

