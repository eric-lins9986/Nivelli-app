import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CalendarData {
  year: number;
  month: number;
  days_in_month: number;
  active_dates: Record<string, string>;
  current_streak: number;
  best_streak: number;
  first_weekday: number;
}

export default function StreakTab() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/streak-calendar`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  if (loading || !data) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#F5C518" /></View></SafeAreaView>;
  }

  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = data.year === today.getFullYear() && data.month === today.getMonth() + 1;

  // Build calendar grid
  // first_weekday: 0=Monday from Python calendar
  const offset = data.first_weekday; // 0=Mon, 6=Sun
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= data.days_in_month; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const getDateStr = (day: number) => {
    return `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const activeDays = Object.keys(data.active_dates).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#F5C518" />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Streak</Text>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={28} color="#F5C518" />
            <Text style={styles.statNum}>{data.current_streak}</Text>
            <Text style={styles.statLabel}>Streak atual</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={28} color="#F5C518" />
            <Text style={styles.statNum}>{data.best_streak}</Text>
            <Text style={styles.statLabel}>Melhor streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={28} color="#F5C518" />
            <Text style={styles.statNum}>{activeDays}</Text>
            <Text style={styles.statLabel}>Dias ativos</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <Text style={styles.monthTitle}>{monthNames[data.month - 1]} {data.year}</Text>

          {/* Week header */}
          <View style={styles.weekRow}>
            {weekDays.map(d => (
              <View key={d} style={styles.weekCell}>
                <Text style={styles.weekText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Days */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.weekRow}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={styles.dayCell} />;

                const dateStr = getDateStr(day);
                const isActive = dateStr in data.active_dates;
                const isTodayCell = isCurrentMonth && day === todayDay;
                const isPast = isCurrentMonth ? day < todayDay : true;
                const isFuture = isCurrentMonth && day > todayDay;

                return (
                  <View key={ci} style={styles.dayCell}>
                    <View style={[
                      styles.dayCellInner,
                      isActive && styles.dayCellActive,
                      isTodayCell && styles.dayCellToday,
                    ]}>
                      {isActive ? (
                        <Text style={styles.fireIcon}>🔥</Text>
                      ) : (
                        <Text style={[
                          styles.dayText,
                          isFuture && styles.dayTextFuture,
                          isPast && !isActive && styles.dayTextMissed,
                          isTodayCell && styles.dayTextToday,
                        ]}>
                          {day}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 16 }}>🔥</Text>
            <Text style={styles.legendText}>Dia com atividade</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8C9E8C30' }]} />
            <Text style={styles.legendText}>Sem registro</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  title: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#1A2E1A', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  statNum: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '900', color: '#1A2E1A', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#8C9E8C', marginTop: 2 },
  calendarCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.15)',
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  monthTitle: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, fontWeight: '700', color: '#1A2E1A', textAlign: 'center', marginBottom: 16 },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekText: { fontSize: 12, fontWeight: '600', color: '#8C9E8C' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCellInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayCellActive: { backgroundColor: 'rgba(245,197,24,0.2)' },
  dayCellToday: { borderWidth: 2, borderColor: '#F5C518' },
  fireIcon: { fontSize: 18 },
  dayText: { fontSize: 15, fontWeight: '500', color: '#1A2E1A' },
  dayTextFuture: { color: '#8C9E8C' },
  dayTextMissed: { color: '#8C9E8C40' },
  dayTextToday: { fontWeight: '700', color: '#1A2E1A' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 16, height: 16, borderRadius: 8 },
  legendText: { fontSize: 12, color: '#8C9E8C' },
});
