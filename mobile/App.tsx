import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { StorageService } from "./src/services/storageService";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { TeamScreen } from "./src/screens/TeamScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"scanner" | "team" | "profile">("scanner");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await StorageService.getAuthToken();
      setIsLoggedIn(Boolean(token));
    } catch {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.splashBox}>
        <ActivityIndicator size="large" color="#e11d48" />
        <Text style={styles.splashText}>Fırat Yoklama Yükleniyor...</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.appContainer}>
      <ExpoStatusBar style="dark" />

      {/* Ekran İçeriği */}
      <View style={styles.screenContainer}>
        {activeTab === "scanner" && <ScannerScreen />}
        {activeTab === "team" && <TeamScreen />}
        {activeTab === "profile" && <ProfileScreen onLogout={() => setIsLoggedIn(false)} />}
      </View>

      {/* Alt Navigasyon Çubuğu (Bottom Navigation Bar) */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab("scanner")}
        >
          <Text style={[styles.navIcon, activeTab === "scanner" && styles.activeNavIcon]}>
            📷
          </Text>
          <Text style={[styles.navLabel, activeTab === "scanner" && styles.activeNavLabel]}>
            QR Tara
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab("team")}
        >
          <Text style={[styles.navIcon, activeTab === "team" && styles.activeNavIcon]}>
            👥
          </Text>
          <Text style={[styles.navLabel, activeTab === "team" && styles.activeNavLabel]}>
            TÜBİTAK Ekip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab("profile")}
        >
          <Text style={[styles.navIcon, activeTab === "profile" && styles.activeNavIcon]}>
            👤
          </Text>
          <Text style={[styles.navLabel, activeTab === "profile" && styles.activeNavLabel]}>
            Profil
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  screenContainer: {
    flex: 1,
  },
  splashBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  splashText: {
    marginTop: 12,
    fontSize: 14,
    color: "#71717a",
    fontWeight: "600",
  },
  navBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingVertical: 8,
    paddingBottom: 16,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.5,
  },
  activeNavIcon: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    color: "#71717a",
    fontWeight: "600",
  },
  activeNavLabel: {
    color: "#e11d48",
    fontWeight: "bold",
  },
});
