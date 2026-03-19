import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      let deviceId = await AsyncStorage.getItem('niveli_device_id');
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await AsyncStorage.setItem('niveli_device_id', deviceId);
      }

      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/profile`);
      const data = await res.json();

      if (data.exists) {
        router.replace('/(tabs)');
      } else {
        router.replace('/setup');
      }
    } catch (e) {
      console.error('Error checking setup:', e);
      router.replace('/setup');
    } finally {
      setLoading(false);
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
