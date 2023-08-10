package app.zeusln.zeus;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;

import android.app.Activity;
import android.content.Intent;

import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends ReactActivity {
    static boolean started = false;

    static int INTENT_COPYLNDLOG = 100;
    static int INTENT_EXPORTCHANBACKUP = 101;
    static int INTENT_EXPORTCHANBACKUPFILE = 102;

    static int INTENT_COPYLNDLOGTESTNET = 200;
    static int INTENT_EXPORTCHANBACKUPFILETESTNET = 202;

    static byte[] tmpChanBackup;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(null);
        started = true;
    }

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "zeus";
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == INTENT_COPYLNDLOG && resultCode == Activity.RESULT_OK) {
            Uri destUri = data.getData();
            File sourceLocation = new File(getFilesDir().toString() + "/logs/bitcoin/mainnet/lnd.log");
            try {
                InputStream in = new FileInputStream(sourceLocation);
                OutputStream out = getContentResolver().openOutputStream(destUri);

                byte[] buf = new byte[1024];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                in.close();
                out.close();
            }
            catch(IOException e) {
                Toast.makeText(this, "Error " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == INTENT_COPYLNDLOGTESTNET && resultCode == Activity.RESULT_OK) {
            Uri destUri = data.getData();
            File sourceLocation = new File(getFilesDir().toString() + "/logs/bitcoin/testnet/lnd.log");
            try {
                InputStream in = new FileInputStream(sourceLocation);
                OutputStream out = getContentResolver().openOutputStream(destUri);

                byte[] buf = new byte[1024];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                in.close();
                out.close();
            }
            catch(IOException e) {
                Toast.makeText(this, "Error " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == INTENT_EXPORTCHANBACKUP && resultCode == Activity.RESULT_OK) {
            Uri destUri = data.getData();
            try {
                ByteArrayInputStream in = new ByteArrayInputStream(MainActivity.tmpChanBackup);
                OutputStream out = getContentResolver().openOutputStream(destUri);
                byte[] buf = new byte[1024];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                in.close();
                out.close();
                MainActivity.tmpChanBackup = new byte[0];
            } catch (IOException e) {
                e.printStackTrace();
            }
        } else if (requestCode == INTENT_EXPORTCHANBACKUPFILE && resultCode == Activity.RESULT_OK) {
            Uri destUri = data.getData();
            File sourceLocation = new File(getFilesDir().toString() + "/data/chain/bitcoin/mainnet/channel.backup");
            try {
                InputStream in = new FileInputStream(sourceLocation);
                OutputStream out = getContentResolver().openOutputStream(destUri);

                byte[] buf = new byte[1024];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                in.close();
                out.close();
            }
            catch(IOException e) {
                Toast.makeText(this, "Error " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == INTENT_EXPORTCHANBACKUPFILETESTNET && resultCode == Activity.RESULT_OK) {
            Uri destUri = data.getData();
            File sourceLocation = new File(getFilesDir().toString() + "/data/chain/bitcoin/testnet/channel.backup");
            try {
                InputStream in = new FileInputStream(sourceLocation);
                OutputStream out = getContentResolver().openOutputStream(destUri);

                byte[] buf = new byte[1024];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
                in.close();
                out.close();
            }
            catch(IOException e) {
                Toast.makeText(this, "Error " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }
}
