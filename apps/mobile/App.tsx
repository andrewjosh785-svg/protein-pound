import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { AuthProvider, useAuth } from './src/lib/auth/AuthContext';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { SubscriptionGate } from './src/features/billing/SubscriptionGate';
import { useSubscription, hasActiveAccess } from './src/lib/queries/useSubscription';
import { AppShell } from './src/navigation/AppShell';
import { registerForPushNotifications } from './src/lib/pushNotifications';
import { colors } from './src/theme/tokens';

const queryClient = new QueryClient();

function Root() {
  const { user, loading } = useAuth();
  const subscription = useSubscription(user?.id);

  // Registration failing (e.g. no EAS project set up yet) never blocks using the app —
  // see pushNotifications.ts, which silently no-ops rather than throwing.
  useEffect(() => {
    if (user?.id) registerForPushNotifications(user.id);
  }, [user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.fill} edges={['top']}>
        <LoginScreen />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (subscription.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!hasActiveAccess(subscription.data ?? null)) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <SubscriptionGate />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return <AppShell userEmail={user.email} />;
}

export default function App() {
  // The Barlow Condensed display font is only used on LoginScreen's wordmark, but every
  // screen renders behind the same font-load gate — otherwise a signed-in user with a
  // slow font load would flash the system-font fallback for a frame on cold start.
  const [fontsLoaded] = useFonts({ BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
});
