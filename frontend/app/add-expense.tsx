import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const QUICK_AMOUNTS = [10, 20, 50];

export default function AddExpenseScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleQuickAdd = (value: number) => {
    setAmount(String(value));
  };

  const handleSave = async () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }

    setSaving(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num }),
      });

      if (res.ok) {
        router.back();
      } else {
        Alert.alert('Erro', 'Não foi possível salvar o gasto.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na conexão.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              testID="back-button"
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#1A2E1A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Adicionar gasto</Text>
            <View style={styles.backBtn} />
          </View>

          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencyLabel}>R$</Text>
            <TextInput
              testID="expense-amount-input"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#8C9E8C"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>

          {/* Quick Buttons */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                testID={`quick-add-${val}-button`}
                style={[
                  styles.quickButton,
                  amount === String(val) && styles.quickButtonActive,
                ]}
                onPress={() => handleQuickAdd(val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    amount === String(val) && styles.quickButtonTextActive,
                  ]}
                >
                  +{val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save Button */}
          <View style={styles.bottom}>
            <TouchableOpacity
              testID="save-expense-button"
              style={[styles.saveButton, saving && styles.saveDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FEFCF5',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2E1A',
  },
  amountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  currencyLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#8C9E8C',
    marginBottom: 4,
  },
  amountInput: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 64,
    fontWeight: '900',
    color: '#1A2E1A',
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 8,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 48,
  },
  quickButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(26, 46, 26, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  quickButtonActive: {
    backgroundColor: '#F5C518',
    borderColor: '#F5C518',
  },
  quickButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  quickButtonTextActive: {
    color: '#1A2E1A',
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  saveButton: {
    backgroundColor: '#F5C518',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
    letterSpacing: 0.5,
  },
});
