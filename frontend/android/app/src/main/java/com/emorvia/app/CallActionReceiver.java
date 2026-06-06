package com.emorvia.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles the Accept / Reject button taps on the incoming-call notification
 * (used when the user is in the notification shade rather than the full-screen).
 * Accept -> launches MainActivity with deep-link extras so React routes to call.
 * Reject -> simply dismisses the notification; server-side timeout cancels the call.
 */
public class CallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_ACCEPT = "com.emorvia.app.CALL_ACCEPT";
    public static final String ACTION_REJECT = "com.emorvia.app.CALL_REJECT";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(1001);

        if (ACTION_ACCEPT.equals(action)) {
            Intent main = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            if (main == null) main = new Intent(ctx, MainActivity.class);
            main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            main.putExtra("acceptCall", true);
            main.putExtra("callerId", intent.getStringExtra("callerId"));
            main.putExtra("callerName", intent.getStringExtra("callerName"));
            main.putExtra("callType", intent.getStringExtra("callType"));
            ctx.startActivity(main);
        }
        // For REJECT we just dismiss; backend's deliver() timeout handles cleanup.
    }
}
