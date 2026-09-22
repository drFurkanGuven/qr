import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { FiratApi } from "../services/firatApi";
import { StorageService } from "../services/storageService";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<"cas" | "manual">("cas");
  const [loading, setLoading] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [studentNo, setStudentNo] = useState("");

  const handleNavigationStateChange = async (navState: any) => {
    const url = navState.url || "";
    // CAS oturumundan sonra gelen ST-... biletini yakala
    if (url.includes("ticket=ST-") || url.includes("ticket=")) {
      const match = url.match(/ticket=([a-zA-Z0-9_\-]+)/);
      if (match && match[1]) {
        const ticket = match[1];
        setLoading(true);
        try {
          const deviceUuid = await StorageService.getOrCreateDeviceUuid();
          const res = await FiratApi.exchangeCasTicket(ticket, deviceUuid);

          if (res.success && res.token) {
            await StorageService.setAuthToken(res.token);

            // Kullanıcı bilgilerini çekip kaydet
            const userRes = await FiratApi.getUser(res.token, deviceUuid);
            if (userRes.success && userRes.data) {
              if (userRes.data.name) await StorageService.setFullName(userRes.data.name);
              if (userRes.data.username) await StorageService.setStudentNo(userRes.data.username);
            }

            Alert.alert("Başarılı", "Fırat CAS oturumunuz açıldı!");
            onLoginSuccess();
          } else {
            Alert.alert("Hata", res.error || "Token takası yapılamadı.");
          }
        } catch (e: any) {
          Alert.alert("Hata", e.message || "Giriş işlemi sırasında hata oluştu.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleManualLogin = async () => {
    if (!manualToken.trim()) {
      Alert.alert("Uyarı", "Lütfen Bearer token yapıştırın.");
      return;
    }

    setLoading(true);
    try {
      const deviceUuid = await StorageService.getOrCreateDeviceUuid();
      const userRes = await FiratApi.getUser(manualToken, deviceUuid);

      if (!userRes.success) {
        Alert.alert("Doğrulama Başarısız", "Girilen token Fırat API tarafından reddedildi.");
        return;
      }

      await StorageService.setAuthToken(manualToken);
      if (studentNo.trim()) await StorageService.setStudentNo(studentNo);
      if (userRes.data?.name) await StorageService.setFullName(userRes.data.name);

      Alert.alert("Başarılı", `Hoş geldiniz, ${userRes.data?.name || "Öğrenci"}`);
      onLoginSuccess();
    } catch (e: any) {
      Alert.alert("Hata", e.message || "Token doğrulanırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & Tabs */}
      <View style={styles.header}>
        <Text style={styles.title}>Fırat Üniversitesi Yoklama</Text>
        <Text style={styles.subtitle}>Resmi CAS Girişi & Yoklama Portalı</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === "cas" && styles.activeTab]}
            onPress={() => setMode("cas")}
          >
            <Text style={[styles.tabText, mode === "cas" && styles.activeTabText]}>
              Resmi CAS Girişi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "manual" && styles.activeTab]}
            onPress={() => setMode("manual")}
          >
            <Text style={[styles.tabText, mode === "manual" && styles.activeTabText]}>
              Hazır Token ile Giriş
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#e11d48" />
          <Text style={styles.loadingText}>Oturum onaylanıyor, lütfen bekleyin...</Text>
        </View>
      ) : mode === "cas" ? (
        <View style={styles.webContainer}>
          <WebView
            source={{ uri: "https://jasig.firat.edu.tr/cas/login?service=https://qr.firat.edu.tr" }}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webLoading}>
                <ActivityIndicator size="large" color="#e11d48" />
                <Text style={styles.webLoadingText}>Fırat CAS Yükleniyor...</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.manualContainer}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Manuel Bearer Token Girişi</Text>
            <Text style={styles.cardDesc}>
              Mobil uygulamadan veya Burp&apos;ten yakalanan aktif Sanctum Bearer token&apos;ınızı girerek CAS şifresine gerek kalmadan anında giriş yapabilirsiniz.
            </Text>

            <Text style={styles.inputLabel}>Öğrenci Numarası (Opsiyonel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: 210101001"
              value={studentNo}
              onChangeText={setStudentNo}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Bearer Token (Zorunlu)</Text>
            <TextInput
              style={[styles.input, styles.tokenInput]}
              placeholder="Örn: 437|PSv45Rwff7JYbi7ekv0Q9SNbAreq9uFSRuHm1PBIf700a002"
              value={manualToken}
              onChangeText={setManualToken}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleManualLogin}>
              <Text style={styles.submitBtnText}>Token ile Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f5",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#18181b",
  },
  subtitle: {
    fontSize: 12,
    color: "#71717a",
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: "row",
    marginTop: 14,
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  activeTabText: {
    color: "#e11d48",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#52525b",
  },
  webContainer: {
    flex: 1,
  },
  webLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  webLoadingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#71717a",
  },
  manualContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: "#71717a",
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3f3f46",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 14,
    color: "#18181b",
  },
  tokenInput: {
    height: 70,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
  },
  submitBtn: {
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
