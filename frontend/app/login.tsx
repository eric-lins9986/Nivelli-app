import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Atenção', 'Preencha seu nome.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { email: email.trim().toLowerCase(), password, name: name.trim() }
        : { email: email.trim().toLowerCase(), password };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Erro', data.detail || 'Falha na autenticação');
        return;
      }

      // Save auth data
      await AsyncStorage.setItem('niveli_auth_token', data.session_token);
      await AsyncStorage.setItem('niveli_device_id', data.user_id);
      await AsyncStorage.setItem('niveli_user_name', data.name || '');

      // Check if profile exists
      const profileRes = await fetch(`${BACKEND_URL}/api/device/${data.user_id}/profile`);
      const profileData = await profileRes.json();

      if (profileData.exists) {
        router.replace('/(tabs)');
      } else {
        router.replace('/setup');
      }
    } catch (e) {
      console.error('Auth error:', e);
      Alert.alert('Erro', 'Falha na conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_139070e7-7fa6-4876-a39e-d250ffee7d34/artifacts/5084mvi5_Niveli%20LOGO%203.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Niveli</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </Text>

          {/* Email Form */}
          <View style={styles.form}>
            {mode === 'register' && (
              <TextInput
                testID="name-input"
                style={styles.inputField}
                placeholder="Nome"
                placeholderTextColor="#8C9E8C"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              testID="email-input"
              style={styles.inputField}
              placeholder="Email"
              placeholderTextColor="#8C9E8C"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              testID="password-input"
              style={styles.inputField}
              placeholder="Senha (mínimo 6 caracteres)"
              placeholderTextColor="#8C9E8C"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            testID="email-auth-button"
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1A2E1A" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Entrar' : 'Criar conta'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            testID="toggle-mode-button" 
            style={styles.toggleLink} 
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setName('');
              setEmail('');
              setPassword('');
            }}
          >
            <Text style={styles.toggleText}>
              {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
              <Text style={styles.toggleBold}>{mode === 'login' ? 'Criar conta' : 'Entrar'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 100, height: 100, borderRadius: 50 },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 36, fontWeight: '700', color: '#1A2E1A', textAlign: 'center', marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: '#4A5D4A', textAlign: 'center', marginBottom: 32 },
  form: { gap: 12, marginBottom: 24 },
  inputField: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(26,46,26,0.12)',
    padding: 16, fontSize: 16, color: '#1A2E1A',
  },
  primaryBtn: {
    backgroundColor: '#F5C518', borderRadius: 9999, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center', minHeight: 56,
    shadowColor: '#F5C518', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 18, fontWeight: '700', color: '#1A2E1A', letterSpacing: 0.5 },
  toggleLink: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  toggleText: { fontSize: 15, color: '#4A5D4A' },
  toggleBold: { fontWeight: '700', color: '#1A2E1A' },
});
