package vn.id.crmiqi.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(CrmNotificationsPlugin.class);
        createLeadNotificationChannels();
    }

    private void createLeadNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        createLeadChannel(manager, attrs, "lead_notifications_manager_v4", "Lead moi quan ly", defaultSound);
        createLeadChannel(manager, attrs, "lead_notifications_sale_v4", "Lead moi sale", defaultSound);
        createLeadChannel(manager, attrs, "lead_notifications", "Lead moi", defaultSound);
        createLeadChannel(manager, attrs, "lead_notifications_recall_v2", "Thu hoi lead", getRecallSoundUri());
    }

    private Uri getRecallSoundUri() {
        return Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.lead_recall);
    }

    private void createLeadChannel(NotificationManager manager, AudioAttributes attrs, String id, String name, Uri soundUri) {
        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Thong bao khi co lead moi trong CRM");
        channel.enableVibration(true);
        if (soundUri != null) {
            channel.setSound(soundUri, attrs);
        }
        manager.createNotificationChannel(channel);
    }
}
