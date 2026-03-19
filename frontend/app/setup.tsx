import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SetupScreen() {
  const router = useRouter();
  const [income, setIncome] = useState('');
  const [fixedExpenses, setFixedExpenses] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const incomeNum = parseFloat(income.replace(',', '.'));
    const expensesNum = parseFloat(fixedExpenses.replace(',', '.'));

    if (isNaN(incomeNum) || incomeNum <= 0) {
      Alert.alert('Atenção', 'Informe uma renda válida.');
      return;
    }
    if (isNaN(expensesNum) || expensesNum < 0) {
      Alert.alert('Atenção', 'Informe um valor válido para despesas fixas.');
      return;
    }
    if (expensesNum >= incomeNum) {
      Alert.alert('Atenção', 'Suas despesas fixas devem ser menores que sua renda.');
      return;
    }

    setSaving(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          income: incomeNum,
          fixed_expenses: expensesNum,
        }),
      });

      if (res.ok) {
        router.replace('/home');
      } else {
        Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha na conexão. Verifique sua internet.');
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://customer-assets.emergentagent.com/job_139070e7-7fa6-4876-a39e-d250ffee7d34/artifacts/5084mvi5_Niveli%20LOGO%203.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Bem-vindo ao Niveli</Text>
          <Text style={styles.subtitle}>
            Vamos configurar seu orçamento mensal para você saber quanto pode gastar por dia.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Renda mensal</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currency}>R$</Text>
              <TextInput
                testID="income-input"
                style={styles.input}
                placeholder="5.000"
                placeholderTextColor="#8C9E8C"
                keyboardType="numeric"
                value={income}
                onChangeText={setIncome}
              />
            </View>

            <Text style={styles.label}>Despesas fixas mensais</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currency}>R$</Text>
              <TextInput
                testID="fixed-expenses-input"
                style={styles.input}
                placeholder="2.500"
                placeholderTextColor="#8C9E8C"
                keyboardType="numeric"
                value={fixedExpenses}
                onChangeText={setFixedExpenses}
              />
            </View>

            <Text style={styles.hint}>
              Inclua aluguel, contas, assinaturas e outros gastos recorrentes.
            </Text>
          </View>

          <TouchableOpacity
            testID="setup-save-button"
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Salvando...' : 'Começar'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 32,
    fontWeight: '700',
    color: '#1A2E1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#4A5D4A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2E1A',
    marginBottom: 8,
    marginTop: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(26, 46, 26, 0.12)',
    paddingHorizontal: 16,
  },
  currency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#1A2E1A',
    paddingVertical: 16,
  },
  hint: {
    fontSize: 13,
    color: '#8C9E8C',
    marginTop: 12,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#F5C518',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
    letterSpacing: 0.5,
  },
});
