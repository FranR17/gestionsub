import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.notifyra.app',
  appName: 'Notifyra',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
      sound: 'default',
    },
  },
  server: {
    url: 'http://172.20.10.11:5174',
    cleartext: true,
  },
};

export default config;
