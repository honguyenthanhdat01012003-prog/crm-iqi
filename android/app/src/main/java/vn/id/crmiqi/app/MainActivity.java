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

    /**
     * Channel id phải khớp getNativeNotificationSound() trên server.
     * Android 8+ bỏ im lặng notification có channel_id chưa tồn tại,
     * nên phải tạo sẵn ngay khi mở app — không đợi JS đăng ký push.
     */
    private void createLeadNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        createLeadChannel(manager, attrs, "lead_notifications_manager_v6", "Lead moi quan ly", rawSound(R.raw.lead_manager));
        createLeadChannel(manager, attrs, "lead_notifications_sale_v6", "Lead moi sale", rawSound(R.raw.lead_sale));
        createLeadChannel(manager, attrs, "lead_notifications_update_v3", "Nhac cap nhat lead", rawSound(R.raw.lead_update));
        createLeadChannel(manager, attrs, "lead_notifications_recall_v2", "Thu hoi lead", rawSound(R.raw.lead_recall));
        createLeadChannel(manager, attrs, "lead_notifications", "Lead moi",
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));

        // Dọn channel đời cũ để user không thấy mục trùng trong Cài đặt thông báo
        deleteLegacyChannel(manager, "lead_notifications_manager_v4");
        deleteLegacyChannel(manager, "lead_notifications_sale_v4");
        deleteLegacyChannel(manager, "lead_notifications_manager_v5");
        deleteLegacyChannel(manager, "lead_notifications_sale_v5");
    }

    private Uri rawSound(int resId) {
        return Uri.parse("android.resource://" + getPackageName() + "/" + resId);
    }

    private void createLeadChannel(NotificationManager manager, AudioAttributes attrs, String id, String name, Uri soundUri) {
        if (manager.getNotificationChannel(id) != null) return;
        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Thong bao khi co lead moi trong CRM");
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        if (soundUri != null) {
            channel.setSound(soundUri, attrs);
        }
        manager.createNotificationChannel(channel);
    }

    private void deleteLegacyChannel(NotificationManager manager, String id) {
        try {
            if (manager.getNotificationChannel(id) != null) manager.deleteNotificationChannel(id);
        } catch (Exception ignored) {
        }
    }
}
