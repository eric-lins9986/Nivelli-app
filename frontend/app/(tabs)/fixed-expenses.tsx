import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  RefreshControl, Platform, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FixedItem {
  id: string;
  name: string;
  amount: number;
  is_paid: boolean;
}

interface FixedData {
  items: FixedItem[];
  total: number;
  paid_total: number;
  pending_total: number;
  income_percentage: number;
  health: string;
}

export default function FixedExpensesTab() {
  const [data, setData] = useState<FixedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      const res = await fetch(`${BACKEND_URL}/api/device/${deviceId}/fixed-expenses`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleAdd = async () => {
    const amt = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim()) { Alert.alert('Atenção', 'Informe o nome da despesa.'); return; }
    if (isNaN(amt) || amt <= 0) { Alert.alert('Atenção', 'Informe um valor válido.'); return; }

    setSaving(true);
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      await fetch(`${BACKEND_URL}/api/device/${deviceId}/fixed-expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), amount: amt }),
      });
      setNewName('');
      setNewAmount('');
      setShowAdd(false);
      await fetchData();
    } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (item: FixedItem) => {
    try {
      const deviceId = await AsyncStorage.getItem('niveli_device_id');
      await fetch(`${BACKEND_URL}/api/device/${deviceId}/fixed-expenses/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paid: !item.is_paid }),
      });
      await fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (item: FixedItem) => {
    Alert.alert('Remover', `Remover "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          try {
            const deviceId = await AsyncStorage.getItem('niveli_device_id');
            await fetch(`${BACKEND_URL}/api/device/${deviceId}/fixed-expenses/${item.id}`, { method: 'DELETE' });
            await fetchData();
          } catch (e) { console.error(e); }
        }
      },
    ]);
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#F5C518" /></View></SafeAreaView>;
  }

  const pct = data?.income_percentage ?? 0;
  const isHealthy = (data?.health ?? 'healthy') === 'healthy';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#F5C518" />}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Contas Fixas</Text>

          {/* Health Bar */}
          <View style={styles.healthCard}>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Comprometimento da renda</Text>
              <View style={[styles.healthBadge, { backgroundColor: isHealthy ? '#388E3C18' : '#D32F2F18' }]}>
                <Text style={{ fontSize: 14 }}>{isHealthy ? '🟢' : '🔴'}</Text>
                <Text style={[styles.healthBadgeText, { color: isHealthy ? '#388E3C' : '#D32F2F' }]}>
                  {pct}%
                </Text>
              </View>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: isHealthy ? '#388E3C' : '#D32F2F' }]} />
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalItem}>Pago: R$ {fmt(data?.paid_total ?? 0)}</Text>
              <Text style={styles.totalItem}>Pendente: R$ {fmt(data?.pending_total ?? 0)}</Text>
            </View>
          </View>

          {/* Items */}
          {(data?.items ?? []).map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <TouchableOpacity testID={`toggle-${item.id}`} style={styles.itemLeft} onPress={() => handleToggle(item)}>
                <Ionicons
                  name={item.is_paid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={item.is_paid ? '#388E3C' : '#8C9E8C'}
                />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, item.is_paid && styles.itemPaid]}>{item.name}</Text>
                  <Text style={styles.itemAmount}>R$ {fmt(item.amount)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-${item.id}`} onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ))}

          {(data?.items ?? []).length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={48} color="#8C9E8C" />
              <Text style={styles.emptyText}>Nenhuma conta fixa cadastrada.</Text>
            </View>
          )}

          {/* Add Form */}
          {showAdd ? (
            <View style={styles.addForm}>
              <TextInput testID="new-expense-name" style={styles.inputField} placeholder="Nome da despesa" placeholderTextColor="#8C9E8C" value={newName} onChangeText={setNewName} />
              <View style={styles.amountRow}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput testID="new-expense-amount" style={[styles.inputField, { flex: 1 }]} placeholder="0,00" placeholderTextColor="#8C9E8C" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} />
              </View>
              <View style={styles.addActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setNewName(''); setNewAmount(''); }}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="save-fixed-expense" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity testID="add-fixed-expense-button" style={styles.addButton} onPress={() => setShowAdd(true)}>
              <Ionicons name="add-circle" size={22} color="#1A2E1A" />
              <Text style={styles.addButtonText}>Adicionar conta fixa</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FEFCF5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  title: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 28, fontWeight: '700', color: '#1A2E1A', marginBottom: 20 },
  healthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
    shadowColor: '#1A2E1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  healthLabel: { fontSize: 14, color: '#4A5D4A', fontWeight: '500' },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9999 },
  healthBadgeText: { fontSize: 14, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: 'rgba(26,46,26,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 8, borderRadius: 4 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalItem: { fontSize: 13, color: '#8C9E8C' },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(26,46,26,0.06)',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1A2E1A' },
  itemPaid: { textDecorationLine: 'line-through', color: '#8C9E8C' },
  itemAmount: { fontSize: 14, color: '#4A5D4A', marginTop: 2 },
  deleteBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, color: '#8C9E8C' },
  addForm: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)' },
  inputField: { backgroundColor: '#FEFCF5', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(26,46,26,0.12)', padding: 14, fontSize: 16, color: '#1A2E1A', marginBottom: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyPrefix: { fontSize: 18, fontWeight: '700', color: '#1A2E1A' },
  addActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: '#1A2E1A' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#1A2E1A' },
  saveBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 9999, backgroundColor: '#F5C518' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#1A2E1A' },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, marginTop: 12, borderRadius: 9999, borderWidth: 1.5, borderColor: '#1A2E1A', borderStyle: 'dashed',
  },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#1A2E1A' },
});
