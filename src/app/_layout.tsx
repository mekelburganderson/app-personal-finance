import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { Feather } from '@expo/vector-icons';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/state/auth';
import { DataProvider } from '@/state/data';
import { OverlayProvider } from '@/ui/overlay';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator && !__DEV__) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DataProvider>
          <OverlayProvider>
            <Slot />
          </OverlayProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
