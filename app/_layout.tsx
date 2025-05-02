import { Stack } from "expo-router";
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { loading, error } = useAuth();

  useEffect(() => {
    if (error) {
      console.error('Auth error detected:', error);
    }
  }, [error]);

  // If still loading auth state, show a loading indicator
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#5561F5" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If there's an auth error, display it
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error initializing app:</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.helpText}>Please restart the app or check your internet connection.</Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="bookmarks" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="comments/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="follow-requests" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="messages" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FD',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1A1D3F',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#1A1D3F',
    marginBottom: 20,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#6E7191',
    textAlign: 'center',
  }
});

