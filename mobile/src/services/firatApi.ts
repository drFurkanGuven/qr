import { FıratUser, VerifyResult, StudentAccount } from "../types";

const FIRAT_API_BASE = "https://qr.firat.edu.tr/api";

const getHeaders = (token?: string, deviceUuid?: string) => {
  const headers: Record<string, string> = {
    Host: "qr.firat.edu.tr",
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "FiratMobil/2 CFNetwork/3896.100.1.2.1 Darwin/27.0.0",
    "Accept-Language": "tr-TR,tr;q=0.9",
    Connection: "keep-alive",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }
  if (deviceUuid) {
    headers["X-Device-Uuid"] = deviceUuid.trim().toUpperCase();
  }
  return headers;
};

export const FiratApi = {
  // 1. Token ile Kullanıcı Bilgisi Sorgulama (Canlılık Testi)
  async getUser(token: string, deviceUuid: string): Promise<{ success: boolean; data?: FıratUser; error?: string }> {
    try {
      const res = await fetch(`${FIRAT_API_BASE}/user`, {
        method: "GET",
        headers: getHeaders(token, deviceUuid),
      });

      if (res.status === 200) {
        const data = await res.json();
        return { success: true, data };
      }
      return { success: false, error: `Sunucu yanıtı: HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e.message || "Ağ bağlantı hatası" };
    }
  },

  // 2. Yoklama Doğrulama ve Gönderme
  async verifyAttendance(
    qrToken: string,
    token: string,
    deviceUuid: string
  ): Promise<{ success: boolean; statusCode: number; message: string; data?: any }> {
    try {
      const res = await fetch(`${FIRAT_API_BASE}/attendance/verify`, {
        method: "POST",
        headers: getHeaders(token, deviceUuid),
        body: JSON.stringify({
          qr_token: qrToken.trim(),
        }),
      });

      const statusCode = res.status;
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      const isSuccess = statusCode === 200 || statusCode === 201;
      let msg = isSuccess ? "Yoklamanız başarıyla alındı." : `Hata (HTTP ${statusCode})`;
      if (data && typeof data === "object") {
        if (data.message) msg = data.message;
        else if (data.detail) msg = data.detail;
      }

      return {
        success: isSuccess,
        statusCode,
        message: msg,
        data,
      };
    } catch (e: any) {
      return {
        success: false,
        statusCode: 0,
        message: e.message || "Bağlantı hatası oluştu.",
      };
    }
  },

  // 3. Güncel Yoklama Durumunu Göster
  async getAttendanceShow(token: string, deviceUuid: string): Promise<any> {
    try {
      const res = await fetch(`${FIRAT_API_BASE}/attendance/show`, {
        method: "GET",
        headers: getHeaders(token, deviceUuid),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  // 4. CAS Bileti ile Token Takası (Exchange)
  async exchangeCasTicket(ticket: string, deviceUuid: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const res = await fetch(`${FIRAT_API_BASE}/auth/cas/token`, {
        method: "POST",
        headers: getHeaders(undefined, deviceUuid),
        body: JSON.stringify({
          ticket: ticket.trim(),
          service: "https://qr.firat.edu.tr",
          device_uuid: deviceUuid.trim().toUpperCase(),
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        if (data.access_token) {
          return { success: true, token: data.access_token };
        }
      }
      return { success: false, error: `Token takası başarısız (HTTP ${res.status})` };
    } catch (e: any) {
      return { success: false, error: e.message || "CAS Token takası ağ hatası" };
    }
  },

  // 5. Çoklu Öğrenci İçin Eşzamanlı Paralel Yoklama Gönderimi (Ekip Modu)
  async dispatchTeamAttendance(
    qrToken: string,
    accounts: StudentAccount[]
  ): Promise<VerifyResult[]> {
    const promises = accounts.map(async (acc) => {
      const start = Date.now();
      const res = await FiratApi.verifyAttendance(qrToken, acc.token, acc.device_uuid);
      const duration = Date.now() - start;

      return {
        student_no: acc.student_no,
        full_name: acc.full_name,
        device_uuid: acc.device_uuid,
        success: res.success,
        status_code: res.statusCode,
        message: res.message,
        response_data: res.data,
        duration_ms: duration,
      };
    });

    return Promise.all(promises);
  },
};
