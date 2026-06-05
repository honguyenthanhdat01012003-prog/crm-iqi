package vn.id.crmiqi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createLeadNotificationChannels();
    }

    private void createLeadNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        createLeadChannel(manager, attrs, "lead_notifications_manager_v2", "Lead moi quan ly", R.raw.lead_manager);
        createLeadChannel(manager, attrs, "lead_notifications_sale_v2", "Lead moi sale", R.raw.lead_sale);
    }

    private void createLeadChannel(NotificationManager manager, AudioAttributes attrs, String id, String name, int soundResId) {
        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Thong bao khi co lead moi trong CRM");
        channel.enableVibration(true);
        channel.setSound(soundUri, attrs);
        manager.createNotificationChannel(channel);
    }
}
