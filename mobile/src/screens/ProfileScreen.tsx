import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { StorageService } from "../services/storageService";
import { FiratApi } from "../services/firatApi";

interface ProfileScreenProps {
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const [studentNo, setStudentNo] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [deviceUuid, setDeviceUuid] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [attendanceInfo, setAttendanceInfo] = useState<any>(null);
  const [fetchingAttendance, setFetchingAttendance] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const storedToken = await StorageService.getAuthToken();
      const storedUuid = await StorageService.getOrCreateDeviceUuid();
      const storedNo = await StorageService.getStudentNo();
      const storedName = await StorageService.getFullName();

      setToken(storedToken || "");
      setDeviceUuid(storedUuid);
      setStudentNo(storedNo || "Belirtilmemiş");
      setFullName(storedName || "Öğrenci");

      if (storedToken) {
        // Canlı kullanıcı sorgusu
        const userRes = await FiratApi.getUser(storedToken, storedUuid);
        if (userRes.success && userRes.data) {
          if (userRes.data.name) setFullName(userRes.data.name);
          if (userRes.data.username) setStudentNo(userRes.data.username);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAttendance = async () => {
    setFetchingAttendance(true);
    try {
      const res = await FiratApi.getAttendanceShow(token, deviceUuid);
      setAttendanceInfo(res);
      Alert.alert("Yoklama Durumu", res ? JSON.stringify(res, null, 2) : "Ders yoklama kaydı bulunamadı.");
    } catch {
      Alert.alert("Hata", "Yoklama bilgisi alınamadı.");
    } finally {
      setFetchingAttendance(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "Oturumunuz kapatılsın mı?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          await StorageService.clearSession();
          onLogout();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profil Başlığı */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName.charAt(0).toUpperCase() || "Ö"}
            </Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.studentNo}>Öğrenci No: {studentNo}</Text>
          <View style={styles.badgeBox}>
            <Text style={styles.badgeText}>Fırat CAS Oturumu Aktif</Text>
          </View>
        </View>

        {/* Cihaz ve Token Bilgileri */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cihaz & Yetkilendirme Bilgisi</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>X-Device-UUID:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {deviceUuid}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Aktif Token:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {token ? `${token.slice(0, 18)}...` : "Yok"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User-Agent:</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              FiratMobil/2 CFNetwork/3896.100.1.2.1
            </Text>
          </View>
        </View>

        {/* İşlemler */}
        <TouchableOpacity
          style={styles.actionBtn}
          disabled={fetchingAttendance}
          onPress={handleFetchAttendance}
        >
          {fetchingAttendance ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.actionBtnText}>Ders Yoklama Durumunu Sorgula</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Oturumu Kapat (Çıkış Yap)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f5",
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffe4e6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#e11d48",
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#18181b",
    marginBottom: 2,
  },
  studentNo: {
    fontSize: 12,
    color: "#71717a",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 8,
  },
  badgeBox: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "bold",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: "#71717a",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
    color: "#27272a",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#fafafa",
    padding: 6,
    borderRadius: 6,
  },
  actionBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  logoutBtn: {
    backgroundColor: "#fee2e2",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutBtnText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "bold",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
