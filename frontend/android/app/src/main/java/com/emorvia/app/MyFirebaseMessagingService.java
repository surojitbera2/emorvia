package com.emorvia.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Receives data-only FCM messages from the Emorvia backend and routes them:
 *   type == "incoming_call"   -> launches IncomingCallActivity (full-screen) +
 *                                 high-priority notification with default ringtone.
 *   type == "incoming_chat"   -> heads-up chat notification with tap-to-open.
 *   type == "chat_message"    -> bundled chat message notification.
 *
 * Fires even when the app is in background or killed (FCM high-priority data msg).
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "EmorviaFCM";
    private static final int CALL_NOTIF_ID = 1001;
    private static final int CHAT_NOTIF_ID_BASE = 2000;

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        // The token is also surfaced to the WebView via @capacitor/push-notifications
        // 'registration' event, so the React layer handles the upload.
        // Persist locally so React can pick it up on next launch if needed.
        getSharedPreferences("emorvia_fcm", Context.MODE_PRIVATE)
                .edit()
                .putString("fcm_token", token)
                .apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        NotificationChannels.ensure(this);

        Map<String, String> data = remoteMessage.getData();
        if (data == null || data.isEmpty()) {
            Log.w(TAG, "FCM message has no data payload — ignoring");
            return;
        }
        String type = data.get("type");
        if (type == null) type = "";
        Log.d(TAG, "FCM received type=" + type);

        switch (type) {
            case "incoming_call":
                showIncomingCallNotification(data);
                break;
            case "incoming_chat":
            case "chat_message":
                showChatNotification(data);
                break;
            default:
                // Generic fallback — show a basic notification.
                showChatNotification(data);
                break;
        }
    }

    private void showIncomingCallNotification(Map<String, String> data) {
        String callerName = orDefault(data.get("callerName"), "Someone");
        String callerId   = orDefault(data.get("callerId"),   "");
        String callType   = orDefault(data.get("callType"),   "video");

        // Full-screen activity intent — shows over lock screen.
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callerId", callerId);
        fullScreenIntent.putExtra("callType", callType);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPI = PendingIntent.getActivity(
                this, 0, fullScreenIntent, piFlags);

        // Accept intent -> opens app via main activity, deep-link to call screen.
        Intent acceptIntent = new Intent(this, CallActionReceiver.class);
        acceptIntent.setAction(CallActionReceiver.ACTION_ACCEPT);
        acceptIntent.putExtra("callerName", callerName);
        acceptIntent.putExtra("callerId", callerId);
        acceptIntent.putExtra("callType", callType);
        PendingIntent acceptPI = PendingIntent.getBroadcast(
                this, 1, acceptIntent, piFlags);

        // Reject intent -> just dismisses notification, server times out call.
        Intent rejectIntent = new Intent(this, CallActionReceiver.class);
        rejectIntent.setAction(CallActionReceiver.ACTION_REJECT);
        rejectIntent.putExtra("callerId", callerId);
        PendingIntent rejectPI = PendingIntent.getBroadcast(
                this, 2, rejectIntent, piFlags);

        // Start the full-screen activity directly (works on most modern Android).
        try {
            startActivity(fullScreenIntent);
        } catch (Exception e) {
            Log.w(TAG, "Could not launch IncomingCallActivity directly: " + e.getMessage());
        }

        Notification notif = new NotificationCompat.Builder(this, NotificationChannels.CALL_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Incoming " + callType + " call")
                .setContentText(callerName + " is calling you")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(true)
                .setFullScreenIntent(fullScreenPI, true)
                .setContentIntent(fullScreenPI)
                .addAction(R.mipmap.ic_launcher, "Reject", rejectPI)
                .addAction(R.mipmap.ic_launcher, "Accept", acceptPI)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(CALL_NOTIF_ID, notif);
    }

    private void showChatNotification(Map<String, String> data) {
        String title = orDefault(data.get("title"), "New message");
        String body  = orDefault(data.get("body"),  "You have a new message");
        String callerId = orDefault(data.get("callerId"), "");

        // Tap → open MainActivity, React layer routes to chat.
        Intent tapIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (tapIntent == null) tapIntent = new Intent(this, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        tapIntent.putExtra("openChat", true);
        tapIntent.putExtra("callerId", callerId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent tapPI = PendingIntent.getActivity(this, 3, tapIntent, piFlags);

        Notification notif = new NotificationCompat.Builder(this, NotificationChannels.CHAT_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(tapPI)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();

        int id = CHAT_NOTIF_ID_BASE + (callerId.isEmpty() ? 0 : Math.abs(callerId.hashCode()) % 1000);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, notif);
    }

    private static String orDefault(String s, String d) {
        return (s == null || s.isEmpty()) ? d : s;
    }
}
