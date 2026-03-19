import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TimelineDay {
  date: string;
  day: number;
  type: 'past' | 'today' | 'future';
  spent?: number;
  balance_after?: number;
  predicted_allowance?: number;
  projected_balance?: number;
  warning?: boolean;
}

export default function TimelineTab() {
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTimeline = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline);
        setCurrentDay(data.current_day);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchTimeline(); }, []));

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const now = new Date();
  const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return dayNames[d.getDay()];
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#F5C518" /></View></SafeAreaView>;
  }

  // Show relevant days: 3 past + today + 7 future
  const todayIdx = timeline.findIndex(d => d.type === 'today');
  const startIdx = Math.max(0, todayIdx - 3);
  const endIdx = Math.min(timeline.length, todayIdx + 8);
  const visible = timeline.slice(startIdx, endIdx);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTimeline(); }} tintColor="#F5C518" />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Linha do Tempo</Text>
        <Text style={styles.monthLabel}>{monthLabel}</Text>

        <View style={styles.timelineContainer}>
          {visible.map((day, idx) => {
            const isToday = day.type === 'today';
            const isFuture = day.type === 'future';
            const isPast = day.type === 'past';
            const isWarning = isFuture && day.warning;

            return (
              <View key={day.date} style={styles.timelineRow}>
                {/* Line */}
                <View style={styles.lineCol}>
                  {idx > 0 && <View style={[styles.lineSegment, isFuture && styles.lineDashed]} />}
                  <View style={[
                    styles.dot,
                    isToday && styles.dotToday,
                    isFuture && styles.dotFuture,
                    isWarning && styles.dotWarning,
                  ]}>
                    {isToday && <Ionicons name="today" size={14} color="#FFFFFF" />}
                    {isWarning && <Ionicons name="alert" size={12} color="#FFFFFF" />}
                  </View>
                  {idx < visible.length - 1 && <View style={[styles.lineSegment, isFuture && styles.lineDashed]} />}
                </View>

                {/* Card */}
                <View style={[
                  styles.dayCard,
                  isToday && styles.dayCardToday,
                  isWarning && styles.dayCardWarning,
                  isPast && day.spent === 0 && styles.dayCardClean,
                ]}>
                  <View style={styles.dayHeader}>
                    <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                      {day.day}
                    </Text>
                    <Text style={styles.dayName}>{getDayName(day.date)}</Text>
                    {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Hoje</Text></View>}
                    {isFuture && <Text style={styles.futureLabel}>Previsão</Text>}
                  </View>

                  {(isPast || isToday) && (
                    <View style={styles.dayBody}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>Gasto</Text>
                        <Text style={[styles.dayValue, (day.spent ?? 0) > 0 && { color: '#E65100' }]}>
                          R$ {fmt(day.spent ?? 0)}
                        </Text>
                      </View>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>Saldo após</Text>
                        <Text style={[styles.dayValue, (day.balance_after ?? 0) < 0 && { color: '#D32F2F' }]}>
                          R$ {fmt(day.balance_after ?? 0)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {isFuture && (
                    <View style={styles.dayBody}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>Previsão diária</Text>
                        <Text style={styles.dayValue}>R$ {fmt(day.predicted_allowance ?? 0)}</Text>
                      </View>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>Saldo projetado</Text>
                        <Text style={[styles.dayValue, isWarning && { color: '#D32F2F' }]}>
                          R$ {fmt(day.projected_balance ?? 0)}
                        </Text>
                      </View>
                      {isWarning && (
                        <View style={styles.warningBox}>
                          <Ionicons name="warning" size={14} color="#D32F2F" />
                          <Text style={styles.warningText}>Saldo pode zerar!</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  title: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#1A2E1A', marginBottom: 4 },
  monthLabel: { fontSize: 15, color: '#8C9E8C', marginBottom: 24 },
  timelineContainer: {},
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  lineCol: { width: 32, alignItems: 'center' },
  lineSegment: { flex: 1, width: 2, backgroundColor: '#1A2E1A20' },
  lineDashed: { backgroundColor: '#1A2E1A10' },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  dotToday: { backgroundColor: '#F5C518' },
  dotFuture: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#1A2E1A20' },
  dotWarning: { backgroundColor: '#D32F2F' },
  dayCard: {
    flex: 1, marginLeft: 12, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
  },
  dayCardToday: { borderColor: '#F5C518', borderWidth: 2 },
  dayCardWarning: { borderColor: '#D32F2F40', backgroundColor: '#FFF5F5' },
  dayCardClean: { opacity: 0.6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayNum: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, fontWeight: '700', color: '#1A2E1A' },
  dayNumToday: { color: '#F5C518' },
  dayName: { fontSize: 13, color: '#8C9E8C' },
  todayBadge: { backgroundColor: '#F5C518', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  todayBadgeText: { fontSize: 11, fontWeight: '700', color: '#1A2E1A' },
  futureLabel: { fontSize: 11, color: '#8C9E8C', fontStyle: 'italic' },
  dayBody: { gap: 4 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayLabel: { fontSize: 13, color: '#8C9E8C' },
  dayValue: { fontSize: 13, fontWeight: '600', color: '#1A2E1A' },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#D32F2F10', padding: 8, borderRadius: 8 },
  warningText: { fontSize: 12, color: '#D32F2F', fontWeight: '600' },
});
