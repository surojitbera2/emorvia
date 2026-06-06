package com.emorvia.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Block screenshots and screen recording for the whole app.
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );

        // Create FCM notification channels on first launch.
        NotificationChannels.ensure(this);

        // If launched via Accept-call deep-link, forward extras to JS via JSEvent.
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        boolean acceptCall = intent.getBooleanExtra("acceptCall", false);
        boolean openChat   = intent.getBooleanExtra("openChat",   false);
        if (!acceptCall && !openChat) return;

        // We post to the bridge after a short delay so the WebView is ready.
        getBridge().getWebView().postDelayed(() -> {
            try {
                String callerId   = String.valueOf(intent.getStringExtra("callerId"));
                String callerName = String.valueOf(intent.getStringExtra("callerName"));
                String callType   = String.valueOf(intent.getStringExtra("callType"));
                String event = acceptCall ? "emorviaAcceptCall" : "emorviaOpenChat";
                String js = "window.dispatchEvent(new CustomEvent('" + event + "', { detail: {"
                        + "callerId: " + jsonStr(callerId) + ","
                        + "callerName: " + jsonStr(callerName) + ","
                        + "callType: " + jsonStr(callType)
                        + "} }));";
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        }, 800);
    }

    private String jsonStr(String s) {
        if (s == null || "null".equals(s)) return "''";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
