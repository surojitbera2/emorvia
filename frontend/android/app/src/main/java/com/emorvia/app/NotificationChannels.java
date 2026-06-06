package com.emorvia.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/**
 * Creates the two notification channels used by Emorvia:
 *   - emorvia_calls : MAX importance, default ringtone, full-screen call intent
 *   - emorvia_chat  : DEFAULT importance, default notification sound
 * Channels are created once and persist for the app's lifetime.
 */
public class NotificationChannels {
    public static final String CALL_CHANNEL_ID = "emorvia_calls";
    public static final String CHAT_CHANNEL_ID = "emorvia_chat";

    public static void ensure(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Calls channel — full-screen, default system ringtone.
        if (nm.getNotificationChannel(CALL_CHANNEL_ID) == null) {
            NotificationChannel call = new NotificationChannel(
                    CALL_CHANNEL_ID,
                    "Incoming calls",
                    NotificationManager.IMPORTANCE_HIGH);
            call.setDescription("Notifications for incoming calls from users");
            call.enableVibration(true);
            call.setVibrationPattern(new long[]{0, 1000, 1000, 1000, 1000, 1000});
            call.enableLights(true);
            call.setBypassDnd(true);
            call.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            call.setShowBadge(true);

            Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            call.setSound(ringtone, audioAttrs);

            nm.createNotificationChannel(call);
        }

        // Chat channel.
        if (nm.getNotificationChannel(CHAT_CHANNEL_ID) == null) {
            NotificationChannel chat = new NotificationChannel(
                    CHAT_CHANNEL_ID,
                    "Chat messages",
                    NotificationManager.IMPORTANCE_HIGH);
            chat.setDescription("New chat requests and messages");
            chat.enableVibration(true);
            chat.enableLights(true);
            chat.setShowBadge(true);
            Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            chat.setSound(ringtone, audioAttrs);
            nm.createNotificationChannel(chat);
        }
    }
}
