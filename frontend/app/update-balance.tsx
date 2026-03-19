import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function UpdateBalanceScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/profile`);
      const data = await res.json();
      if (data.exists) {
        setCurrentBalance(data.current_balance);
        setBalance(String(data.current_balance));
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    const num = parseFloat(balance.replace(',', '.'));
    if (isNaN(num)) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    setSaving(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_balance: num }),
      });
      if (res.ok) {
        router.back();
      } else {
        Alert.alert('Erro', 'Não foi possível atualizar.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na conexão.');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity testID="balance-back-button" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="close" size={24} color="#1A2E1A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Atualizar saldo</Text>
            <View style={styles.backBtn} />
          </View>

          <View style={styles.currentBox}>
            <Text style={styles.currentLabel}>Saldo registrado</Text>
            <Text style={styles.currentValue}>R$ {fmt(currentBalance)}</Text>
          </View>

          <Text style={styles.newLabel}>Novo saldo</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currency}>R$</Text>
            <TextInput
              testID="new-balance-input"
              style={styles.input}
              keyboardType="numeric"
              value={balance}
              onChangeText={setBalance}
              autoFocus
              selectTextOnFocus
            />
          </View>

          <Text style={styles.hint}>
            Informe o saldo real da sua conta para manter os cálculos precisos.
          </Text>

          <View style={styles.bottom}>
            <TouchableOpacity
              testID="save-balance-button"
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Atualizar saldo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 32 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A2E1A' },
  currentBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)', alignItems: 'center',
  },
  currentLabel: { fontSize: 13, color: '#8C9E8C', marginBottom: 4 },
  currentValue: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#1A2E1A' },
  newLabel: { fontSize: 14, fontWeight: '600', color: '#1A2E1A', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 2, borderColor: '#F5C518', paddingHorizontal: 16,
  },
  currency: { fontSize: 20, fontWeight: '700', color: '#1A2E1A', marginRight: 8 },
  input: {
    flex: 1, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28, fontWeight: '700', color: '#1A2E1A', paddingVertical: 16,
  },
  hint: { fontSize: 13, color: '#8C9E8C', marginTop: 12, lineHeight: 18 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 24 },
  saveBtn: {
    backgroundColor: '#F5C518', borderRadius: 9999, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F5C518', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  saveBtnText: { fontSize: 18, fontWeight: '700', color: '#1A2E1A', letterSpacing: 0.5 },
});
