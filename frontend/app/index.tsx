import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if auth token exists
      const token = await AsyncStorage.getItem('niveli_auth_token');
      const deviceId = await AsyncStorage.getItem('niveli_device_id');

      if (!token || !deviceId) {
        // No auth - go to login
        router.replace('/login');
        return;
      }

      // Verify token with backend
      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!meRes.ok) {
        // Token invalid - clear and go to login
        await AsyncStorage.removeItem('niveli_auth_token');
        await AsyncStorage.removeItem('niveli_device_id');
        await AsyncStorage.removeItem('niveli_user_name');
        router.replace('/login');
        return;
      }

      // Token valid - check if profile exists
      const profileRes = await fetch(`${BACKEND_URL}/api/device/${deviceId}/profile`);
      const profileData = await profileRes.json();

      if (profileData.exists) {
        router.replace('/(tabs)');
      } else {
        router.replace('/setup');
      }
    } catch (e) {
      console.error('Auth check error:', e);
      // On error, go to login
      router.replace('/login');
    } finally {
      setChecking(false);
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
