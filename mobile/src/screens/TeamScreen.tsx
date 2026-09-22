import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Crypto from "expo-crypto";
import { StorageService } from "../services/storageService";
import { FiratApi } from "../services/firatApi";
import { StudentAccount } from "../types";

export const TeamScreen: React.FC = () => {
  const [team, setTeam] = useState<StudentAccount[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form State
  const [studentNo, setStudentNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [deviceUuid, setDeviceUuid] = useState("");
  const [token, setToken] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    const list = await StorageService.getTeamAccounts();
    setTeam(list);
  };

  const handleOpenAdd = () => {
    setStudentNo("");
    setFullName("");
    setDeviceUuid(Crypto.randomUUID().toUpperCase());
    setToken("");
    setIsActive(true);
    setModalVisible(true);
  };

  const handleSaveMember = async () => {
    if (!studentNo.trim() || !fullName.trim() || !token.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen Öğrenci No, İsim ve Bearer Token alanlarını doldurun.");
      return;
    }

    const newAccount: StudentAccount = {
      id: Crypto.randomUUID(),
      student_no: studentNo.trim(),
      full_name: fullName.trim(),
      device_uuid: (deviceUuid.trim() || Crypto.randomUUID()).toUpperCase(),
      token: token.trim(),
      is_active: isActive,
      created_at: new Date().toISOString(),
    };

    await StorageService.addTeamAccount(newAccount);
    setModalVisible(false);
    await loadTeam();
    Alert.alert("Başarılı", `${fullName} ekibe eklendi.`);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Ekip Üyesini Sil", `${name} ekipten silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await StorageService.removeTeamAccount(id);
          await loadTeam();
        },
      },
    ]);
  };

  const handleTestToken = async (item: StudentAccount) => {
    setTestingId(item.id);
    try {
      const res = await FiratApi.getUser(item.token, item.device_uuid);
      if (res.success) {
        Alert.alert("Token Geçerli ✅", `Fırat API Doğrulandı!\nİsim: ${res.data?.name || item.full_name}`);
      } else {
        Alert.alert("Token Geçersiz ❌", res.error || "Token süresi dolmuş veya geçersiz.");
      }
    } catch (e: any) {
      Alert.alert("Hata", e.message || "Test sırasında hata oluştu.");
    } finally {
      setTestingId(null);
    }
  };

  const renderItem = ({ item }: { item: StudentAccount }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.studentNo}>No: {item.student_no}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id, item.full_name)}
        >
          <Text style={styles.deleteBtnText}>Sil</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.uuidText} numberOfLines={1}>
        UUID: {item.device_uuid}
      </Text>
      <Text style={styles.tokenText} numberOfLines={1}>
        Token: {item.token.slice(0, 16)}...
      </Text>

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.testBtn}
          disabled={testingId === item.id}
          onPress={() => handleTestToken(item)}
        >
          {testingId === item.id ? (
            <ActivityIndicator size="small" color="#e11d48" />
          ) : (
            <Text style={styles.testBtnText}>Token Test Et</Text>
          )}
        </TouchableOpacity>

        <View style={styles.statusBox}>
          <Text style={[styles.statusText, item.is_active ? styles.statusActive : styles.statusInactive]}>
            {item.is_active ? "● Aktif" : "○ Pasif"}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>TÜBİTAK Ekip Yönetimi</Text>
          <Text style={styles.subtitle}>Tek QR ile yoklamaya dahil edilecek öğrenciler</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
          <Text style={styles.addBtnText}>+ Öğrenci Ekle</Text>
        </TouchableOpacity>
      </View>

      {team.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Henüz Ekip Üyesi Eklenmedi</Text>
          <Text style={styles.emptyText}>
            Yukarıdaki &quot;+ Öğrenci Ekle&quot; butonuna basarak TÜBİTAK ekip üyelerinizin token ve bilgilerini ekleyebilirsiniz.
          </Text>
        </View>
      ) : (
        <FlatList
          data={team}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Üye Ekleme Modalı */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Ekip Üyesi Ekle</Text>

            <Text style={styles.label}>Öğrenci Numarası</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: 210101002"
              value={studentNo}
              onChangeText={setStudentNo}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Adı Soyadı</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Mehmet Demir"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Telefon Device UUID</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={deviceUuid}
                onChangeText={setDeviceUuid}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.genBtn}
                onPress={() => setDeviceUuid(Crypto.randomUUID().toUpperCase())}
              >
                <Text style={styles.genBtnText}>Üret</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Fırat Mobil Bearer Token</Text>
            <TextInput
              style={[styles.input, styles.tokenArea]}
              placeholder="437|PSv45Rwff7JYbi7ekv0Q9SNbAreq9uFSRuHm1PBIf700a002"
              value={token}
              onChangeText={setToken}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Toplu yoklamaya dahil et (Aktif)</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: "#e11d48", false: "#d4d4d8" }} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveMember}
              >
                <Text style={styles.saveBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#18181b",
  },
  subtitle: {
    fontSize: 11,
    color: "#71717a",
  },
  addBtn: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#18181b",
  },
  studentNo: {
    fontSize: 11,
    color: "#71717a",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontSize: 10,
    fontWeight: "bold",
  },
  uuidText: {
    fontSize: 10,
    color: "#a1a1aa",
    marginTop: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  tokenText: {
    fontSize: 10,
    color: "#a1a1aa",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
  },
  testBtn: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  testBtnText: {
    fontSize: 11,
    color: "#3f3f46",
    fontWeight: "600",
  },
  statusBox: {
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusActive: {
    color: "#16a34a",
  },
  statusInactive: {
    color: "#a1a1aa",
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#3f3f46",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 18,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#18181b",
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3f3f46",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 10,
    color: "#18181b",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  genBtn: {
    backgroundColor: "#e4e4e7",
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
  },
  genBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#27272a",
  },
  tokenArea: {
    height: 60,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 12,
    color: "#27272a",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: "#71717a",
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "bold",
  },
});
