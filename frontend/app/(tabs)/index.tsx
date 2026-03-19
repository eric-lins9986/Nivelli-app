import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Summary {
  income: number;
  fixed_expenses: number;
  current_balance: number;
  free_money: number;
  total_spent: number;
  remaining: number;
  days_left: number;
  daily_available: number;
  streak: number;
  today_spent: number;
  feedback: string;
  health_status: string;
}

export default function HomeTab() {
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
      if (res.ok) setSummary(await res.json());
    } catch (e) {
      console.error('Error fetching summary:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchSummary(); }, []));

  const handleNoSpend = async () => {
    setLoggingNoSpend(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      await fetch(`${BACKEND_URL}/api/device/${deviceId}/no-spend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      await fetchSummary();
    } catch (e) { console.error(e); }
    finally { setLoggingNoSpend(false); }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getDailyColor = () => {
    if (!summary) return '#1A2E1A';
    if (summary.daily_available <= 0) return '#D32F2F';
    if (summary.daily_available < 20) return '#E65100';
    return '#1A2E1A';
  };

  const getHealthIcon = () => {
    if (!summary) return null;
    if (summary.health_status === 'critical') return { icon: 'alert-circle' as const, color: '#D32F2F', label: 'Crítico' };
    if (summary.health_status === 'warning') return { icon: 'warning' as const, color: '#E65100', label: 'Atenção' };
    return { icon: 'checkmark-circle' as const, color: '#388E3C', label: 'Saudável' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#F5C518" /></View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Não foi possível carregar os dados.</Text>
          <TouchableOpacity testID="retry-button" style={styles.retryBtn} onPress={fetchSummary}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const health = getHealthIcon();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSummary(); }} tintColor="#F5C518" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>Niveli</Text>
          <TouchableOpacity testID="settings-button" onPress={() => router.push('/setup')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={24} color="#4A5D4A" />
          </TouchableOpacity>
        </View>

        {/* Health + Streak Row */}
        <View style={styles.badgeRow}>
          {health && (
            <View style={[styles.badge, { backgroundColor: health.color + '18' }]}>
              <Ionicons name={health.icon} size={16} color={health.color} />
              <Text style={[styles.badgeText, { color: health.color }]}>{health.label}</Text>
            </View>
          )}
          {summary.streak > 0 && (
            <View style={styles.badge}>
              <Ionicons name="flame" size={16} color="#F5C518" />
              <Text style={styles.badgeText}>{summary.streak} {summary.streak === 1 ? 'dia' : 'dias'}</Text>
            </View>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Saldo atual</Text>
              <Text style={[styles.balanceValue, summary.current_balance <= 0 && { color: '#D32F2F' }]}>
                R$ {fmt(summary.current_balance)}
              </Text>
            </View>
            <TouchableOpacity testID="update-balance-button" style={styles.updateBtn} onPress={() => router.push('/update-balance')}>
              <Ionicons name="refresh" size={16} color="#1A2E1A" />
              <Text style={styles.updateBtnText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero - Daily Available */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Você pode gastar hoje</Text>
          <View style={styles.heroAmountRow}>
            <Text style={[styles.heroCurrency, { color: getDailyColor() }]}>R$</Text>
            <Text style={[styles.heroAmount, { color: getDailyColor() }]}>
              {fmt(Math.max(summary.daily_available, 0))}
            </Text>
          </View>
          {summary.today_spent > 0 && (
            <Text style={styles.todaySpent}>Já gastou hoje: R$ {fmt(summary.today_spent)}</Text>
          )}
        </View>

        {/* Feedback */}
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{summary.feedback}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Restante no mês</Text>
            <Text style={[styles.statValue, summary.remaining < 0 && { color: '#D32F2F' }]}>
              R$ {fmt(summary.remaining)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Dias restantes</Text>
            <Text style={styles.statValue}>{summary.days_left}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity testID="add-expense-button" style={styles.primaryBtn} onPress={() => router.push('/add-expense')} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#1A2E1A" />
            <Text style={styles.primaryBtnText}>Adicionar gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="no-spend-button" style={styles.secondaryBtn} onPress={handleNoSpend} disabled={loggingNoSpend} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#1A2E1A" />
            <Text style={styles.secondaryBtnText}>{loggingNoSpend ? 'Registrando...' : 'Não gastei nada hoje'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#4A5D4A', marginBottom: 16 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#F5C518', borderRadius: 9999 },
  retryText: { fontSize: 16, fontWeight: '600', color: '#1A2E1A' },
  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 12 },
  brandName: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#1A2E1A' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,197,24,0.15)', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 9999, gap: 4 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#1A2E1A' },
  balanceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: '#8C9E8C', marginBottom: 4 },
  balanceValue: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 24, fontWeight: '700', color: '#1A2E1A' },
  updateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,197,24,0.2)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999 },
  updateBtnText: { fontSize: 13, fontWeight: '600', color: '#1A2E1A' },
  heroCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 12,
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)',
  },
  heroLabel: { fontSize: 15, color: '#4A5D4A', marginBottom: 10 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroCurrency: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 22, fontWeight: '700', marginRight: 4 },
  heroAmount: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  todaySpent: { fontSize: 13, color: '#8C9E8C', marginTop: 10 },
  feedbackBox: { backgroundColor: 'rgba(245,197,24,0.1)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, marginBottom: 16 },
  feedbackText: { fontSize: 14, color: '#1A2E1A', textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
  },
  statLabel: { fontSize: 12, color: '#8C9E8C', marginBottom: 6 },
  statValue: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, fontWeight: '700', color: '#1A2E1A' },
  actions: { gap: 10 },
  primaryBtn: {
    flexDirection: 'row', backgroundColor: '#F5C518', borderRadius: 9999, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#F5C518', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#1A2E1A' },
  secondaryBtn: {
    flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 9999, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#1A2E1A',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#1A2E1A' },
});
