package com.zeusln.zeus.util;

import android.content.Context;
import android.util.Log;

import com.zeusln.zeus.TorManager;

import org.apache.commons.io.IOUtils;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import ch.boye.httpclientandroidlib.HttpResponse;
import ch.boye.httpclientandroidlib.NameValuePair;
import ch.boye.httpclientandroidlib.client.methods.HttpDelete;
import ch.boye.httpclientandroidlib.message.BasicNameValuePair;
import info.guardianproject.netcipher.client.StrongHttpsClient;
import okhttp3.FormBody;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;

public class WebUtil {
    public static final String CONTENT_TYPE_APPLICATION_JSON = "application/json";

    private static final int DefaultRequestRetry = 2;
    private static final int DefaultRequestTimeout = 60000;

    private static final String strProxyType = StrongHttpsClient.TYPE_SOCKS;
    private static final String strProxyIP = "127.0.0.1";
    private static final int proxyPort = 9050;

    private static WebUtil instance = null;
    private Context context = null;

    private WebUtil(Context context) {
        this.context = context;
    }

    public static WebUtil getInstance(Context ctx) {

        if (instance == null) {

            instance = new WebUtil(ctx);
        }

        return instance;
    }

    public String postURL(String request, String urlParameters) throws Exception {

        if (context == null) {
            return postURL(null, request, urlParameters);
        } else {
            // Log.i("WebUtil", "Tor required status:" + TorManager.getInstance(context).isRequired());
            // if (TorManager.getInstance(context).isRequired()) {
            if (true) {
                if (urlParameters.startsWith("tx=")) {
                    HashMap<String, String> args = new HashMap<String, String>();
                    args.put("tx", urlParameters.substring(3));
                    return tor_postURL(request, args);
                } else {
                    return tor_postURL(request + urlParameters, new HashMap());
                }
            } else {
                return postURL(null, request, urlParameters);
            }

        }

    }

    public String postURL(String contentType, String request, String urlParameters) throws Exception {

        String error = null;

        for (int ii = 0; ii < DefaultRequestRetry; ++ii) {
            URL url = new URL(request);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            try {
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", contentType == null ? "application/x-www-form-urlencoded" : contentType);
                connection.setRequestProperty("charset", "utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Length", "" + Integer.toString(urlParameters.getBytes().length));
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36");

                connection.setUseCaches(false);

                connection.setConnectTimeout(DefaultRequestTimeout);
                connection.setReadTimeout(DefaultRequestTimeout);

                connection.connect();

                DataOutputStream wr = new DataOutputStream(connection.getOutputStream());
                wr.writeBytes(urlParameters);
                wr.flush();
                wr.close();

                connection.setInstanceFollowRedirects(false);

                if (connection.getResponseCode() == 200) {
//					System.out.println("postURL:return code 200");
                    return IOUtils.toString(connection.getInputStream(), "UTF-8");
                } else {
                    error = IOUtils.toString(connection.getErrorStream(), "UTF-8");
//                    System.out.println("postURL:return code " + error);
                }

                Thread.sleep(5000);
            } finally {
                connection.disconnect();
            }
        }

        throw new Exception("Invalid Response " + error);
    }

    public String deleteURL(String request, String urlParameters) throws Exception {

        String error = null;

        for (int ii = 0; ii < DefaultRequestRetry; ++ii) {
            URL url = new URL(request);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            try {
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestMethod("DELETE");
                connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                connection.setRequestProperty("charset", "utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Length", "" + Integer.toString(urlParameters.getBytes().length));
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36");

                connection.setUseCaches(false);

                connection.setConnectTimeout(DefaultRequestTimeout);
                connection.setReadTimeout(DefaultRequestTimeout);

                connection.connect();

                DataOutputStream wr = new DataOutputStream(connection.getOutputStream());
                wr.writeBytes(urlParameters);
                wr.flush();
                wr.close();

                connection.setInstanceFollowRedirects(false);

                if (connection.getResponseCode() == 200) {
//					System.out.println("postURL:return code 200");
                    return IOUtils.toString(connection.getInputStream(), "UTF-8");
                } else {
                    error = IOUtils.toString(connection.getErrorStream(), "UTF-8");
//                    System.out.println("postURL:return code " + error);
                }

                Thread.sleep(5000);
            } finally {
                connection.disconnect();
            }
        }

        throw new Exception("Invalid Response " + error);
    }

    public String getURL(String URL) throws Exception {

        if (context == null) {
            return _getURL(URL);
        } else {
            //if(TorUtil.getInstance(context).orbotIsRunning())    {
            // Log.i("WebUtil", "Tor required status:" + TorManager.getInstance(context).isRequired());
            // if (TorManager.getInstance(context).isRequired()) {
            if (true) {
                return tor_getURL(URL);
            } else {
                return _getURL(URL);
            }

        }

    }

    private String _getURL(String URL) throws Exception {

        URL url = new URL(URL);

        String error = null;

        for (int ii = 0; ii < DefaultRequestRetry; ++ii) {

            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            try {
                connection.setRequestMethod("GET");
                connection.setRequestProperty("charset", "utf-8");
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36");

                connection.setConnectTimeout(DefaultRequestTimeout);
                connection.setReadTimeout(DefaultRequestTimeout);

                connection.setInstanceFollowRedirects(false);

                connection.connect();

                if (connection.getResponseCode() == 200)
                    return IOUtils.toString(connection.getInputStream(), "UTF-8");
                else
                    error = IOUtils.toString(connection.getErrorStream(), "UTF-8");

                Thread.sleep(5000);
            } finally {
                connection.disconnect();
            }
        }

        return error;
    }

    private String tor_getURL(String URL) throws Exception {

        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .proxy(TorManager.getInstance(this.context).getProxy())
                .connectTimeout(90, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS);

        // addInterceptor
        builder.addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY));
        if(URL.contains("onion")){
            getHostNameVerifier(builder);
        }

        Request request = new Request.Builder()
                .url(URL)
                .build();

        try (Response response = builder.build().newCall(request).execute()) {
            if(response.body() == null){
                return  "";
            }
            return response.body().string();

        }

    }

    public String tor_postURL(String URL, HashMap<String, String> args) throws Exception {

        FormBody.Builder formBodyBuilder = new FormBody.Builder();

        if (args != null && args.size()!=0) {
            List<NameValuePair> urlParameters = new ArrayList<NameValuePair>();
            for (String key : args.keySet()) {
                formBodyBuilder.add(key, args.get(key));
            }
        }


        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .proxy(TorManager.getInstance(this.context).getProxy())
                .connectTimeout(90, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS);

        if(URL.contains("onion")){
            getHostNameVerifier(builder);
        }

        // addInterceptor
        builder.addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY));

        Request request = new Request.Builder()
                .url(URL)
                .post(formBodyBuilder.build())
                .build();

        try (Response response = builder.build().newCall(request).execute()) {
            if(response.body() == null){
                return  "";
            }
            return response.body().string();

        }

    }

    public String tor_postURL(String URL, JSONObject args) throws Exception {

        final MediaType JSON
                = MediaType.parse("application/json; charset=utf-8");
        RequestBody body = RequestBody.create(JSON, args.toString());

        OkHttpClient.Builder builder = new OkHttpClient.Builder()
                .proxy(TorManager.getInstance(this.context).getProxy());

        if(URL.contains("onion")){
            getHostNameVerifier(builder);
        }

        // addInterceptor
        builder.addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY));

        Request request = new Request.Builder()
                .url(URL)
                .post(body)
                .build();

        try (Response response = builder.build().newCall(request).execute()) {
            if(response.body() == null){
                return  "";
            }
            return response.body().string();

        }

    }

    public String tor_deleteURL(String URL, HashMap<String, String> args) throws Exception {

        // ? R.raw.debiancacerts
        StrongHttpsClient httpclient = new StrongHttpsClient(context, null);

        httpclient.useProxy(true, strProxyType, strProxyIP, proxyPort);

        HttpDelete httpdelete = new HttpDelete(new URI(URL));
        httpdelete.setHeader("Content-Type", "application/x-www-form-urlencoded");
        httpdelete.setHeader("charset", "utf-8");
        httpdelete.setHeader("Accept", "application/json");
        httpdelete.setHeader("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36");

        if (args != null) {
            List<NameValuePair> urlParameters = new ArrayList<NameValuePair>();
            for (String key : args.keySet()) {
                urlParameters.add(new BasicNameValuePair(key, args.get(key)));
            }
//            httpdelete.setEntity(new UrlEncodedFormEntity(urlParameters));
        }

        HttpResponse response = httpclient.execute(httpdelete);

        StringBuffer sb = new StringBuffer();
        sb.append(response.getStatusLine()).append("\n\n");

        InputStream is = response.getEntity().getContent();
        BufferedReader br = new BufferedReader(new InputStreamReader(is));
        String line = null;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }

        httpclient.close();

        String result = sb.toString();
//        Log.d("WebUtil", "POST result via Tor:" + result);
        int idx = result.indexOf("{");
        if (idx != -1) {
            return result.substring(idx);
        } else {
            return result;
        }

    }


    private void getHostNameVerifier(OkHttpClient.Builder
                                             clientBuilder) throws
            Exception {

        // Create a trust manager that does not validate certificate chains
        final TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                        return new java.security.cert.X509Certificate[]{};
                    }
                }
        };

        // Install the all-trusting trust manager
        final SSLContext sslContext = SSLContext.getInstance("SSL");
        sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

        // Create an ssl socket factory with our all-trusting manager
        final SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();


        clientBuilder.sslSocketFactory(sslSocketFactory, (X509TrustManager) trustAllCerts[0]);
        clientBuilder.hostnameVerifier((hostname, session) -> true);

    }
}
