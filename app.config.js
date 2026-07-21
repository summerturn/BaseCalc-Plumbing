const baseExpoConfig = {
  name: 'BaseCalc Plumbing',
  slug: 'basecalc-plumbing',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  newArchEnabled: true,
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.basemapped.basecalcplumbing',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.basemapped.basecalcplumbing',
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    adaptiveIcon: {
      backgroundColor: '#0A0C11',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-sqlite',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0A0C11',
      },
    ],
    'expo-font',
    'expo-sharing',
    './plugins/withAndroidLaunchMode',
  ],
  owner: 'basemapped-llc',
  extra: {
    eas: {
      projectId: '4a036a42-e953-434d-afd1-4c06c504fdd5',
    },
  },
};

module.exports = () => baseExpoConfig;
