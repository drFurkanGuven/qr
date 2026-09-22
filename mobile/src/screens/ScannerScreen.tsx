import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { FiratApi } from "../services/firatApi";
import { StorageService } from "../services/storageService";
import { VerifyResult, StudentAccount } from "../types";

export const ScannerScreen: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(0);
  const [qrToken, setQrToken] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [dispatchMode, setDispatchMode] = useState<"self" | "team">("self");
  const [teamAccounts, setTeamAccounts] = useState<StudentAccount[]>([]);
  const [lastResults, setLastResults] = useState<VerifyResult[] | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    const list = await StorageService.getTeamAccounts();
    setTeamAccounts(list.filter((a) => a.is_active));
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanningRef.current || !data) return;
    scanningRef.current = true;
    setQrToken(data);
    setCameraActive(false);

    Alert.alert(
      "QR Kod Algılandı",
      `Kod: ${data.slice(0, 30)}...\nYoklama hemen gönderilsin mi?`,
      [
        {
          text: "İptal",
          style: "cancel",
          onPress: () => {
            scanningRef.current = false;
            setCameraActive(true);
          },
        },
        {
          text: "Gönder",
          onPress: () => {
            executeVerify(data);
          },
        },
      ]
    );
  };

  const executeVerify = async (tokenToUse?: string) => {
    const rawQr = (tokenToUse || qrToken).trim();
    if (!rawQr) {
      Alert.alert("Uyarı", "Lütfen önce bir QR kod okutun veya metin kutusuna girin.");
      return;
    }

    setSending(true);
    setLastResults(null);

    try {
      if (dispatchMode === "self") {
        // Tekli (Kendi Hesabım)
        const myToken = await StorageService.getAuthToken();
        const myUuid = await StorageService.getOrCreateDeviceUuid();
        const myName = (await StorageService.getFullName()) || "Hesabım";
        const myNo = (await StorageService.getStudentNo()) || "-";

        if (!myToken) {
          Alert.alert("Hata", "Oturum bulunamadı. Lütfen önce giriş yapın.");
          setSending(false);
          return;
        }

        const start = Date.now();
        const res = await FiratApi.verifyAttendance(rawQr, myToken, myUuid);
        const duration = Date.now() - start;

        const singleResult: VerifyResult = {
          student_no: myNo,
          full_name: myName,
          device_uuid: myUuid,
          success: res.success,
          status_code: res.statusCode,
          message: res.message,
          response_data: res.data,
          duration_ms: duration,
        };

        setLastResults([singleResult]);
        if (res.success) {
          Alert.alert("Başarılı 🎉", "Yoklamanız Fırat sistemine işlendi!");
        } else {
          Alert.alert("Sonuç", `${res.message} (HTTP ${res.statusCode})`);
        }
      } else {
        // Çoklu (Tüm TÜBİTAK Ekibi)
        if (teamAccounts.length === 0) {
          Alert.alert("Bilgi", "Kayıtlı aktif ekip üyesi bulunamadı. 'Ekip' sekmesinden öğrenci ekleyebilirsiniz.");
          setSending(false);
          return;
        }

        const results = await FiratApi.dispatchTeamAttendance(rawQr, teamAccounts);
        setLastResults(results);

        const successCount = results.filter((r) => r.success).length;
        Alert.alert(
          "Toplu Gönderim Tamamlandı",
          `${teamAccounts.length} öğrenciden ${successCount} tanesi başarıyla onaylandı.`
        );
      }
    } catch (e: any) {
      Alert.alert("Hata", e.message || "Yoklama iletilirken hata oluştu.");
    } finally {
      setSending(false);
      scanningRef.current = false;
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#e11d48" />
        <Text style={styles.helperText}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.helperText}>
          Tahtadaki ders QR kodunu tarayabilmek için kamera erişimine izin vermelisiniz.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Kamera İzni Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Mod Seçici (Kendi Hesabım vs Ekip) */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[styles.modeBtn, dispatchMode === "self" && styles.activeModeBtn]}
            onPress={() => setDispatchMode("self")}
          >
            <Text style={[styles.modeBtnText, dispatchMode === "self" && styles.activeModeBtnText]}>
              Kendim İçin Gönder
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, dispatchMode === "team" && styles.activeModeBtn]}
            onPress={() => {
              loadTeam();
              setDispatchMode("team");
            }}
          >
            <Text style={[styles.modeBtnText, dispatchMode === "team" && styles.activeModeBtnText]}>
              TÜBİTAK Ekibine Gönder ({teamAccounts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Kamera Kadrajı */}
        <View style={styles.cameraBox}>
          {cameraActive ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              enableTorch={torch}
              zoom={zoom}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            />
          ) : (
            <View style={styles.cameraPausedBox}>
              <Text style={styles.cameraPausedText}>Kamera Duraklatıldı</Text>
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => {
                  scanningRef.current = false;
                  setCameraActive(true);
                }}
              >
                <Text style={styles.resumeBtnText}>Kamerayı Aç</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Kadraj Çerçevesi */}
          {cameraActive && (
            <View style={styles.overlay}>
              <View style={styles.scanTarget} />
              <Text style={styles.scanHint}>Tahtadaki QR kodu karenin içine hizalayın</Text>
            </View>
          )}
        </View>

        {/* Kamera Kontrolleri */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={[styles.controlBtn, torch && styles.controlBtnActive]}
            onPress={() => setTorch(!torch)}
          >
            <Text style={[styles.controlBtnText, torch && styles.controlBtnTextActive]}>
              {torch ? "Flaş Açık" : "Flaş / Fener"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, zoom > 0 && styles.controlBtnActive]}
            onPress={() => setZoom(zoom === 0 ? 0.25 : zoom === 0.25 ? 0.5 : 0)}
          >
            <Text style={styles.controlBtnText}>
              Zoom: {zoom === 0 ? "1x" : zoom === 0.25 ? "2x" : "3x"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR Kod Metin Kutusu & Elle Gönderme */}
        <View style={styles.inputCard}>
          <Text style={styles.inputTitle}>Taranan / Girilen QR Metni</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.qrInput}
              value={qrToken}
              onChangeText={setQrToken}
              placeholder="QR kameradan otomatik okunur veya buraya yapıştırılır..."
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, sending && styles.verifyBtnDisabled]}
            disabled={sending}
            onPress={() => executeVerify()}
          >
            {sending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>
                {dispatchMode === "self" ? "Yoklamayı Gönder" : `Tüm Ekibe Gönder (${teamAccounts.length} Kişi)`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sonuç Tablosu */}
        {lastResults && lastResults.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Gönderim Sonuçları</Text>
            {lastResults.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.resultItem,
                  r.success ? styles.resultItemSuccess : styles.resultItemFailed,
                ]}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultName}>{r.full_name}</Text>
                  <Text
                    style={[
                      styles.resultBadge,
                      r.success ? styles.badgeSuccess : styles.badgeFailed,
                    ]}
                  >
                    {r.success ? "ONAYLANDI (200)" : `HATA (${r.status_code})`}
                  </Text>
                </View>
                <Text style={styles.resultMsg}>{r.message}</Text>
                <Text style={styles.resultMeta}>
                  Öğrenci No: {r.student_no} • Süre: {r.duration_ms}ms
                </Text>
              </View>
            ))}
          </View>
        )}
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
    paddingBottom: 40,
  },
  modeContainer: {
    flexDirection: "row",
    backgroundColor: "#e4e4e7",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  activeModeBtn: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  activeModeBtnText: {
    color: "#e11d48",
  },
  cameraBox: {
    height: 280,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000000",
    position: "relative",
    borderWidth: 2,
    borderColor: "#e11d48",
  },
  cameraPausedBox: {
    flex: 1,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraPausedText: {
    color: "#a1a1aa",
    fontSize: 14,
    marginBottom: 12,
  },
  resumeBtn: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanTarget: {
    width: 190,
    height: 190,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  scanHint: {
    color: "#ffffff",
    fontSize: 11,
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  controlBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d8",
  },
  controlBtnActive: {
    backgroundColor: "#e11d48",
    borderColor: "#e11d48",
  },
  controlBtnText: {
    fontSize: 12,
    color: "#3f3f46",
    fontWeight: "600",
  },
  controlBtnTextActive: {
    color: "#ffffff",
  },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 16,
  },
  inputTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 10,
  },
  qrInput: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#18181b",
  },
  verifyBtn: {
    backgroundColor: "#e11d48",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  resultsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 12,
  },
  resultItem: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultItemSuccess: {
    backgroundColor: "#f0fdf4",
    borderLeftColor: "#16a34a",
  },
  resultItemFailed: {
    backgroundColor: "#fff1f2",
    borderLeftColor: "#e11d48",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resultName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#18181b",
  },
  resultBadge: {
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSuccess: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  badgeFailed: {
    backgroundColor: "#ffe4e6",
    color: "#be123c",
  },
  resultMsg: {
    fontSize: 12,
    color: "#3f3f46",
    marginBottom: 4,
  },
  resultMeta: {
    fontSize: 10,
    color: "#71717a",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#18181b",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: "#71717a",
    textAlign: "center",
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  grantBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
