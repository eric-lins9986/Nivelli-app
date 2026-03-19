import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Summary {
  income: number;
  fixed_expenses: number;
  free_money: number;
  total_spent: number;
  remaining: number;
  days_left: number;
  daily_available: number;
  streak: number;
  today_spent: number;
  feedback: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingNoSpend, setLoggingNoSpend] = useState(false);

  const fetchSummary = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      if (!deviceId) return;

      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error('Error fetching summary:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSummary();
  };

  const handleNoSpend = async () => {
    setLoggingNoSpend(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      await fetch(`${BACKEND_URL}/api/device/${deviceId}/no-spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchSummary();
    } catch (e) {
      console.error('Error logging no spend:', e);
    } finally {
      setLoggingNoSpend(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getDailyColor = () => {
    if (!summary) return '#1A2E1A';
    if (summary.daily_available <= 0) return '#D32F2F';
    if (summary.daily_available < 20) return '#E65100';
    return '#1A2E1A';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C518" />
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Não foi possível carregar os dados.</Text>
          <TouchableOpacity testID="retry-button" style={styles.retryButton} onPress={fetchSummary}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5C518" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>Niveli</Text>
          <TouchableOpacity
            testID="settings-button"
            onPress={() => router.push('/setup')}
            style={styles.settingsBtn}
          >
            <Ionicons name="settings-outline" size={24} color="#4A5D4A" />
          </TouchableOpacity>
        </View>

        {/* Streak */}
        {summary.streak > 0 && (
          <View style={styles.streakContainer}>
            <Ionicons name="flame" size={18} color="#F5C518" />
            <Text style={styles.streakText}>
              {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'} seguidos
            </Text>
          </View>
        )}

        {/* Daily Allowance - HERO */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Você pode gastar hoje</Text>
          <View style={styles.heroAmountRow}>
            <Text style={[styles.heroCurrency, { color: getDailyColor() }]}>R$</Text>
            <Text style={[styles.heroAmount, { color: getDailyColor() }]}>
              {formatCurrency(Math.max(summary.daily_available, 0))}
            </Text>
          </View>
          {summary.today_spent > 0 && (
            <Text style={styles.todaySpent}>
              Já gastou hoje: R$ {formatCurrency(summary.today_spent)}
            </Text>
          )}
        </View>

        {/* Feedback */}
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{summary.feedback}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Restante no mês</Text>
            <Text style={[styles.statValue, summary.remaining < 0 && styles.statNegative]}>
              R$ {formatCurrency(summary.remaining)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Dias restantes</Text>
            <Text style={styles.statValue}>{summary.days_left}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            testID="add-expense-button"
            style={styles.primaryButton}
            onPress={() => router.push('/add-expense')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#1A2E1A" />
            <Text style={styles.primaryButtonText}>Adicionar gasto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="no-spend-button"
            style={styles.secondaryButton}
            onPress={handleNoSpend}
            disabled={loggingNoSpend}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#1A2E1A" />
            <Text style={styles.secondaryButtonText}>
              {loggingNoSpend ? 'Registrando...' : 'Não gastei nada hoje'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FEFCF5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#4A5D4A',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F5C518',
    borderRadius: 9999,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2E1A',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 16,
  },
  brandName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 197, 24, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    marginBottom: 24,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2E1A',
    marginLeft: 6,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.15)',
  },
  heroLabel: {
    fontSize: 16,
    color: '#4A5D4A',
    marginBottom: 12,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroCurrency: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 24,
    fontWeight: '700',
    marginRight: 4,
  },
  heroAmount: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
  },
  todaySpent: {
    fontSize: 14,
    color: '#8C9E8C',
    marginTop: 12,
  },
  feedbackContainer: {
    backgroundColor: 'rgba(245, 197, 24, 0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  feedbackText: {
    fontSize: 15,
    color: '#1A2E1A',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(26, 46, 26, 0.06)',
  },
  statLabel: {
    fontSize: 13,
    color: '#8C9E8C',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  statNegative: {
    color: '#D32F2F',
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#F5C518',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2E1A',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#1A2E1A',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2E1A',
  },
});
