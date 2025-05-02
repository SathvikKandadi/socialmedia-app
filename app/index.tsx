import { Text, View, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Link, useRootNavigationState, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [appIsReady, setAppIsReady] = useState(false);
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Prepare to hide splash screen once everything is ready
    async function prepare() {
      try {
        // Artificial delay for smoother transition
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (e) {
        console.warn('Error preparing app:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    // Only hide splash when both navigation is ready and our app-level ready state is true
    if (appIsReady && navigationState?.key && !loading) {
      // Hide splash screen
      SplashScreen.hideAsync();
      
      // Auto-redirect to home if already logged in
      if (session) {
        router.replace('/home');
      }
    }
  }, [appIsReady, navigationState?.key, loading, session]);

  // Show loading indicator if still initializing
  if (!appIsReady || loading || !navigationState?.key) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5561F5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/pylogo.jpg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.tagline}>Connecting talented people</Text>
        
        <TouchableOpacity style={styles.primaryButton}>
          <Link href="/signup" style={styles.fullWidth}>
            <View style={styles.buttonContent}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          </Link>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton}>
            <Link href="/login" style={styles.fullWidth}>
              <View style={styles.buttonContent}>
                <Ionicons name="log-in-outline" size={20} color="#5561F5" />
                <Text style={styles.secondaryButtonText}>Login</Text>
              </View>
            </Link>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButtonAlt}>
            <Link href="/signup" style={styles.fullWidth}>
              <View style={styles.buttonContent}>
                <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                <Text style={styles.secondaryButtonAltText}>Sign Up</Text>
              </View>
            </Link>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FD',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 36,
    borderRadius: 30,
    padding: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logo: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 32,
    color: '#1A1D3F',
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#6E7191',
    marginBottom: 40,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#5561F5',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#5561F5',
    shadowColor: '#8A64F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#5561F5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryButtonAlt: {
    flex: 1,
    backgroundColor: '#5561F5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#5561F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButtonAltText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  fullWidth: {
    width: '100%',
  }
});
