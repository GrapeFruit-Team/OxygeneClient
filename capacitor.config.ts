import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.grfruit.purplify',
  appName: 'Oxygène',
  webDir: 'www',
  bundledWebRuntime: false,

  server: {
    url: 'https://oxygene.grfruit.ru/mobile',
    cleartext: false,
    androidScheme: 'https'
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#0d0d0d',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#0d0d0d'
    }
  }
};

export default config;