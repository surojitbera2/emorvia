import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emorvia.app',
  appName: 'Emorvia',
  webDir: 'build',
  server: {
    // Use production API
    url: undefined,
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    // Block screenshots and screen recording
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    // Local Notifications for incoming calls
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6FA8FF',
      sound: 'beep.wav'
    }
  }
};

export default config;
