import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleEntry();
  }, []);

  const handleEntry = async () => {
    try {
      // Check for Google Auth callback (web only)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        if (hash.includes('session_id=')) {
          const sessionId = hash.split('session_id=')[1]?.split('&')[0];
          if (sessionId) {
            // Clear hash
            window.history.replaceState(null, '', window.location.pathname);
            await processGoogleSession(sessionId);
            return;
          }
        }
      }

      // Check if auth token exists
      const token = await AsyncStorage.getItem('niveli_auth_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      // Verify token
      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!meRes.ok) {
        await AsyncStorage.removeItem('niveli_auth_token');
        router.replace('/login');
        return;
      }

      // Token valid - check if profile exists
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      if (!deviceId) {
        router.replace('/login');
        return;
      }

      const profileRes = await fetch(`${BACKEND_URL}/api/device/${deviceId}/profile`);
      const profileData = await profileRes.json();
      if (profileData.exists) {
        router.replace('/(tabs)');
      } else {
        router.replace('/setup');
      }
    } catch (e) {
      console.error('Error in entry:', e);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const processGoogleSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('niveli_auth_token', data.session_token);
        await AsyncStorage.setItem('niveli_device_id', data.user_id);
        await AsyncStorage.setItem('niveli_user_name', data.name || '');
        const profileRes = await fetch(`${BACKEND_URL}/api/device/${data.user_id}/profile`);
        const profileData = await profileRes.json();
        if (profileData.exists) {
          router.replace('/(tabs)');
        } else {
          router.replace('/setup');
        }
      } else {
        router.replace('/login');
      }
    } catch (e) {
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F5C518" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFCF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
