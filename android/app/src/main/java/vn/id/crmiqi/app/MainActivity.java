package vn.id.crmiqi.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 901;
    private boolean notificationPermissionRequested = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createLeadNotificationChannels();
    }

    @Override
    protected void onResume() {
        super.onResume();
        requestNotificationPermissionAfterFirstFrame();
    }

    private void requestNotificationPermissionAfterFirstFrame() {
        if (notificationPermissionRequested) return;
        notificationPermissionRequested = true;
        new Handler(Looper.getMainLooper()).postDelayed(this::requestNotificationPermissionIfNeeded, 600);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;

        ActivityCompat.requestPermissions(
            this,
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            NOTIFICATION_PERMISSION_REQUEST_CODE
        );
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
