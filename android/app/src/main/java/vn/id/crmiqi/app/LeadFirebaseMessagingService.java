package vn.id.crmiqi.app;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class LeadFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        RemoteMessage.Notification notificationPayload = message.getNotification();
        boolean hasSystemNotification = notificationPayload != null;
        boolean inForeground = isAppInForeground();

        try {
            PushNotificationsPlugin.sendRemoteMessage(message);
        } catch (Exception ignored) {
        }

        // App tắt/background: FCM notification payload đã do hệ thống hiển thị.
        if (hasSystemNotification && !inForeground) {
            return;
        }

        Map<String, String> data = new HashMap<>();
        if (message.getData() != null) data.putAll(message.getData());
        RemoteMessage.Notification notification = message.getNotification();
        if (notification != null) {
            if (notification.getTitle() != null) data.put("title", notification.getTitle());
            if (notification.getBody() != null) data.put("body", notification.getBody());
        }
        if (data.isEmpty()) return;

        String sound = valueOrDefault(data.get("sound"), "manager");
        String title = valueOrDefault(data.get("title"), "LUX IQI CRM");
        String body = valueOrDefault(data.get("body"), "Ban co lead moi");
        String channelId = getChannelId(sound);

        createLeadChannel(channelId, getChannelName(sound));

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("OPEN_LEAD");
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() & 0xfffffff),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(Color.parseColor("#0f4d2a"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent);

        Uri soundUri = getSoundUri();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O && soundUri != null) {
            builder.setSound(soundUri);
        }

        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            return;
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception ignored) {
        }
    }

    private void createLeadChannel(String id, String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(id) != null) return;

        Uri soundUri = getSoundUri();
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Thong bao khi co lead moi trong CRM");
        channel.enableVibration(true);
        if (soundUri != null) {
            channel.setSound(soundUri, attrs);
        }
        manager.createNotificationChannel(channel);
    }

    private Uri getSoundUri() {
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    }

    private String getChannelId(String sound) {
        if ("sale".equals(sound)) return "lead_notifications_sale_v4";
        return "lead_notifications_manager_v4";
    }

    private String getChannelName(String sound) {
        if ("sale".equals(sound)) return "Lead moi sale";
        return "Lead moi quan ly";
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am == null) return false;
        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;
        String packageName = getPackageName();
        for (ActivityManager.RunningAppProcessInfo info : processes) {
            if (packageName.equals(info.processName)
                && info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                return true;
            }
        }
        return false;
    }
}
