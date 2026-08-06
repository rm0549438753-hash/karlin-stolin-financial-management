import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android app shell (APK) configuration.
 * The app loads the live published site, so every update to the web app
 * appears in the installed APK immediately without rebuilding it.
 * This file has no effect on the browser/web build.
 */
const config: CapacitorConfig = {
  appId: 'app.karlinstolin.finance',
  appName: 'KarlinStolin',
  webDir: 'dist/client',
  server: {
    url: 'https://karlin-stolin-financial-management.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0d3b66',
  },
};

export default config;
