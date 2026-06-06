package com.emorvia.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * Full-screen WhatsApp-style incoming call screen.
 * Shows over the lock screen, plays the device's default ringtone, vibrates,
 * and offers Accept / Reject buttons. Accept opens MainActivity with deep-link
 * extras so the React layer can navigate to the provider call screen.
 */
public class IncomingCallActivity extends Activity {
    private Ringtone ringtone;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Block screenshots and screen recording even on this screen.
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE);

        // Show on lock screen + turn screen on.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK
                            | PowerManager.ACQUIRE_CAUSES_WAKEUP
                            | PowerManager.ON_AFTER_RELEASE,
                    "Emorvia:IncomingCallWakeLock");
            wakeLock.acquire(60 * 1000L);
        }

        setContentView(R.layout.activity_incoming_call);

        String callerName = getIntent().getStringExtra("callerName");
        if (callerName == null || callerName.isEmpty()) callerName = "Someone";
        final String callerId = getIntent().getStringExtra("callerId");
        final String callType = getIntent().getStringExtra("callType");

        TextView tvName = findViewById(R.id.tv_caller_name);
        TextView tvType = findViewById(R.id.tv_call_type);
        tvName.setText(callerName);
        tvType.setText("Incoming " + (callType != null ? callType : "video") + " call · EMORVIA");

        Button btnAccept = findViewById(R.id.btn_accept);
        Button btnReject = findViewById(R.id.btn_reject);

        btnAccept.setOnClickListener(v -> {
            stopRingtone();
            Intent main = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (main == null) main = new Intent(this, MainActivity.class);
            main.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            main.putExtra("acceptCall", true);
            main.putExtra("callerId", callerId);
            main.putExtra("callType", callType);
            startActivity(main);
            dismissCallNotification();
            finish();
        });

        btnReject.setOnClickListener(v -> {
            stopRingtone();
            dismissCallNotification();
            finish();
        });

        startRingtoneAndVibrate();
    }

    private void startRingtoneAndVibrate() {
        try {
            // Default system ringtone (TYPE_RINGTONE — the user's chosen ringer).
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ringtone = RingtoneManager.getRingtone(getApplicationContext(), uri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    ringtone.setLooping(true);
                }
                ringtone.play();
            }
        } catch (Exception ignored) {}

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {}
    }

    private void stopRingtone() {
        try { if (ringtone != null && ringtone.isPlaying()) ringtone.stop(); } catch (Exception ignored) {}
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) {}
    }

    private void dismissCallNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(1001);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRingtone();
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        // Prevent accidental dismiss with back button — user must Accept or Reject.
        // No-op.
    }
}
