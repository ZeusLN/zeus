package com.remobile.qrcodeLocalImage;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Hashtable;


public class RCTQRCodeLocalImage extends ReactContextBaseJavaModule {

    private Context context;

    public RCTQRCodeLocalImage(ReactApplicationContext reactContext) {
        super(reactContext);
        this.context = context;
    }

    @Override
    public String getName() {
        return "RCTQRCodeLocalImage";
    }

    @ReactMethod
    public void decode(String path, Callback callback) {
        Hashtable<DecodeHintType, String> hints = new Hashtable<DecodeHintType, String>();
        hints.put(DecodeHintType.CHARACTER_SET, "utf-8"); // 设置二维码内容的编码
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 4;
        options.inPreferredConfig = Bitmap.Config.RGB_565;
        options.inPurgeable = true;

        Bitmap scanBitmap = null;
        if (path.startsWith("http://")||path.startsWith("https://")) {
            scanBitmap = getbitmap(path);
        } else if (path.startsWith("content://")) {
            try {
                final Uri imagePath = Uri.parse(path.replace("file://", "").replace("file:/", ""));
                InputStream inputStream = this.context.getContentResolver().openInputStream(imagePath);
                if (inputStream != null) {
                    scanBitmap = BitmapFactory.decodeStream(inputStream, null, options);
                    inputStream.close();
                }
            } catch (IOException e) {
                e.printStackTrace();
                scanBitmap = null;
            }
        } else if (path.startsWith("base64://")) {
            try {
                byte[] decodedBytes = Base64.decode(path.replace("base64://", ""), 0);
                scanBitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
            } catch (Exception e) {
                e.printStackTrace();
                scanBitmap = null;
            }
        } else {
            scanBitmap = BitmapFactory.decodeFile(path.replace("file://", ""), options);
        }

        if (scanBitmap == null) {
            callback.invoke("cannot load image");
            return;
        }

        int[] intArray = new int[scanBitmap.getWidth()*scanBitmap.getHeight()];
        scanBitmap.getPixels(intArray, 0, scanBitmap.getWidth(), 0, 0, scanBitmap.getWidth(), scanBitmap.getHeight());

        RGBLuminanceSource source = new RGBLuminanceSource(scanBitmap.getWidth(), scanBitmap.getHeight(), intArray);
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
        QRCodeReader reader = new QRCodeReader();
        try {
            Result result = reader.decode(bitmap, hints);
            if (result == null) {
                callback.invoke("image format error");
            } else {
                callback.invoke(null, result.toString());
            }

        } catch (Exception e) {
            callback.invoke("decode error");
        }
    }

    public static Bitmap getbitmap(String imageUri) {
        Bitmap bitmap = null;
        try {
            URL myFileUrl = new URL(imageUri);
            HttpURLConnection conn = (HttpURLConnection) myFileUrl.openConnection();
            conn.setDoInput(true);
            conn.connect();
            InputStream is = conn.getInputStream();
            bitmap = BitmapFactory.decodeStream(is);
            is.close();
        } catch (OutOfMemoryError e) {
            e.printStackTrace();
            bitmap = null;
        } catch (IOException e) {
            e.printStackTrace();
            bitmap = null;
        }
        return bitmap;
    }
}
