import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { StudentAccount } from "../types";

const KEY_CURRENT_TOKEN = "firat_current_token";
const KEY_DEVICE_UUID = "firat_device_uuid";
const KEY_CURRENT_STUDENT_NO = "firat_current_student_no";
const KEY_CURRENT_NAME = "firat_current_name";
const KEY_TEAM_ACCOUNTS = "firat_team_accounts";

export const StorageService = {
  // Device UUID alma veya yoksa yeni üretip kalıcı kaydetme
  async getOrCreateDeviceUuid(): Promise<string> {
    try {
      const stored = await SecureStore.getItemAsync(KEY_DEVICE_UUID);
      if (stored) return stored;

      // iOS formatına uygun büyük harfli UUID
      const newUuid = Crypto.randomUUID().toUpperCase();
      await SecureStore.setItemAsync(KEY_DEVICE_UUID, newUuid);
      return newUuid;
    } catch {
      return Crypto.randomUUID().toUpperCase();
    }
  },

  async setDeviceUuid(uuid: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_DEVICE_UUID, uuid.toUpperCase());
  },

  // Aktif Öğrenci Token İşlemleri
  async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_CURRENT_TOKEN);
  },

  async setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_CURRENT_TOKEN, token.trim());
  },

  async getStudentNo(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_CURRENT_STUDENT_NO);
  },

  async setStudentNo(studentNo: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_CURRENT_STUDENT_NO, studentNo.trim());
  },

  async getFullName(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_CURRENT_NAME);
  },

  async setFullName(name: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_CURRENT_NAME, name.trim());
  },

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_CURRENT_TOKEN);
    await SecureStore.deleteItemAsync(KEY_CURRENT_STUDENT_NO);
    await SecureStore.deleteItemAsync(KEY_CURRENT_NAME);
  },

  // Ekip / Çoklu Öğrenci Hesapları Listesi (TÜBİTAK Toplu Gönderim)
  async getTeamAccounts(): Promise<StudentAccount[]> {
    try {
      const raw = await SecureStore.getItemAsync(KEY_TEAM_ACCOUNTS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async saveTeamAccounts(accounts: StudentAccount[]): Promise<void> {
    await SecureStore.setItemAsync(KEY_TEAM_ACCOUNTS, JSON.stringify(accounts));
  },

  async addTeamAccount(account: StudentAccount): Promise<void> {
    const list = await this.getTeamAccounts();
    const filtered = list.filter((a) => a.student_no !== account.student_no);
    filtered.push(account);
    await this.saveTeamAccounts(filtered);
  },

  async removeTeamAccount(id: string): Promise<void> {
    const list = await this.getTeamAccounts();
    const filtered = list.filter((a) => a.id !== id);
    await this.saveTeamAccounts(filtered);
  },
};
