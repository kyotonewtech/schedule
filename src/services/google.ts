import type { ScheduleEvent, SyncResult } from '../types';
import { EVENT_TYPE_LABELS } from '../types';
import { storage } from '../models/storage';

// Google Calendar API設定
const GOOGLE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.readonly',
};

// 環境変数の読み込み確認（デバッグ用）
console.log('=== Google API 環境変数の確認 ===');
console.log('Client ID:', GOOGLE_CONFIG.clientId ? `${GOOGLE_CONFIG.clientId.substring(0, 20)}...` : '未設定');
console.log('API Key:', GOOGLE_CONFIG.apiKey ? `${GOOGLE_CONFIG.apiKey.substring(0, 10)}...` : '未設定');
console.log('================================');

let gapiInitialized = false;
let gisInitialized = false;
let tokenClient: any = null;

// Google API初期化
export async function initGoogleAPI(): Promise<void> {
  // 環境変数チェック
  if (!GOOGLE_CONFIG.clientId || !GOOGLE_CONFIG.apiKey) {
    console.warn(
      'Google Calendar APIの設定が不完全です。.envファイルにVITE_GOOGLE_CLIENT_IDとVITE_GOOGLE_API_KEYを設定してください。\n' +
      'Google連携機能は無効になりますが、ローカル保存は正常に動作します。'
    );
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (gapiInitialized && gisInitialized) {
      resolve();
      return;
    }

    // gapi script load
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            apiKey: GOOGLE_CONFIG.apiKey,
            discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
          });
          gapiInitialized = true;
          if (gisInitialized) resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
    document.head.appendChild(gapiScript);

    // gis script load
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.clientId,
        scope: GOOGLE_CONFIG.scopes,
        callback: '', // Will be set during auth
      });
      gisInitialized = true;
      if (gapiInitialized) resolve();
    };
    document.head.appendChild(gisScript);
  });
}

// OAuth 2.0認証
export async function authenticateGoogle(): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API not initialized'));
      return;
    }

    tokenClient.callback = async (response: any) => {
      if (response.error) {
        reject(response);
        return;
      }

      // Save token
      storage.saveAuthToken(response.access_token);
      console.log('[Auth] New token saved');

      // Get primary calendar ID for auto-detection
      try {
        (window as any).gapi.client.setToken({ access_token: response.access_token });
        const calendarListResponse = await (window as any).gapi.client.calendar.calendarList.list();
        const primaryCalendar = calendarListResponse.result.items.find((cal: any) => cal.primary === true);

        if (primaryCalendar && primaryCalendar.id) {
          storage.saveUserEmail(primaryCalendar.id);
          console.log('[Auth] Primary calendar ID saved:', primaryCalendar.id);
        }
      } catch (error) {
        console.warn('[Auth] Failed to get primary calendar ID:', error);
        // Continue even if calendar list fetch fails
      }

      resolve(true);
    };

    // Check if already has valid token
    const token = storage.getAuthToken();
    if (token) {
      console.log('[Auth] Existing token found, validating...');
      try {
        (window as any).gapi.client.setToken({ access_token: token });

        // Validate token by making a small API call
        await (window as any).gapi.client.calendar.calendarList.list({
          maxResults: 1
        });

        console.log('[Auth] Existing token is valid');

        // Get primary calendar ID if not already saved
        if (!storage.getUserEmail()) {
          try {
            const calendarListResponse = await (window as any).gapi.client.calendar.calendarList.list();
            const primaryCalendar = calendarListResponse.result.items.find((cal: any) => cal.primary === true);

            if (primaryCalendar && primaryCalendar.id) {
              storage.saveUserEmail(primaryCalendar.id);
              console.log('[Auth] Primary calendar ID saved:', primaryCalendar.id);
            }
          } catch (error) {
            console.warn('[Auth] Failed to get primary calendar ID:', error);
          }
        }

        resolve(true);
        return;
      } catch (error: any) {
        console.warn('[Auth] Existing token is invalid:', error);
        if (error?.status === 401) {
          // Token is expired, clear it
          storage.clearAuthToken();
          console.log('[Auth] Cleared expired token, requesting new one...');
        }
        // Fall through to request new token
      }
    }

    // Request new token
    console.log('[Auth] Requesting new token...');
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// 認証状態チェック
export function isAuthenticated(): boolean {
  const token = storage.getAuthToken();
  if (!token) return false;

  // gapiが初期化されているかチェック
  if (!gapiInitialized || typeof (window as any).gapi === 'undefined') {
    console.warn('[isAuthenticated] gapi is not initialized');
    return false;
  }

  try {
    // 現在セットされているトークンを確認
    const currentToken = (window as any).gapi.client.getToken();

    // トークンが正しくセットされているか確認
    if (!currentToken || currentToken.access_token !== token) {
      (window as any).gapi.client.setToken({ access_token: token });
    }

    return true;
  } catch (error) {
    console.warn('[isAuthenticated] Failed to set token:', error);
    return false;
  }
}

// カレンダーIDの正規化（プライマリカレンダーの自動検出）
export function normalizeCalendarId(calendarId: string): string {
  if (!calendarId) return calendarId;

  // 既に "primary" の場合はそのまま返す
  if (calendarId.toLowerCase() === 'primary') {
    return 'primary';
  }

  // ユーザーのメールアドレスと一致する場合は "primary" に変換
  const userEmail = storage.getUserEmail();
  if (userEmail && calendarId.toLowerCase() === userEmail.toLowerCase()) {
    console.log(`[normalizeCalendarId] Converting "${calendarId}" to "primary" (matches user email)`);
    return 'primary';
  }

  // それ以外はそのまま返す（共有カレンダーなど）
  return calendarId;
}

// イベントをGoogle Calendarに同期
export async function syncEventToGoogle(event: ScheduleEvent): Promise<SyncResult> {
  console.log('[Google Sync] 同期開始:', { executiveId: event.executiveId, title: event.title });

  if (!isAuthenticated()) {
    const message = '認証されていません。「Google連携」ボタンをクリックして認証してください。';
    console.warn('[Google Sync]', message);
    return { success: false, message };
  }

  console.log('[Google Sync] 認証OK');

  const executive = storage.getExecutives().find(e => e.id === event.executiveId);
  console.log('[Google Sync] 役員情報:', executive ? {
    id: executive.id,
    title: executive.title,
    calendarId: executive.calendarId || '(未設定)'
  } : '(役員が見つかりません)');

  if (!executive?.calendarId) {
    const message = 'カレンダーIDが設定されていません。設定画面で設定してください。';
    console.warn('[Google Sync]', message);
    return { success: false, message };
  }

  // カレンダーIDを正規化（プライマリカレンダーの自動検出）
  const normalizedCalendarId = normalizeCalendarId(executive.calendarId);
  console.log('[Google Sync] カレンダーIDあり、同期を実行します...',
    normalizedCalendarId !== executive.calendarId
      ? `(正規化: ${executive.calendarId} → ${normalizedCalendarId})`
      : ''
  );

  try {
    const calendarEvent = convertToGoogleEvent(event);

    if (event.googleEventId) {
      // Update existing event
      console.log('[Google Sync] 既存イベントを更新:', event.googleEventId);
      await updateEventInGoogle(normalizedCalendarId, event.googleEventId, calendarEvent);
      console.log('[Google Sync] 更新成功！');
    } else {
      // Create new event
      console.log('[Google Sync] 新規イベントを作成:', normalizedCalendarId);
      const googleEventId = await createEventInGoogle(normalizedCalendarId, calendarEvent);
      console.log('[Google Sync] 作成成功！Google Event ID:', googleEventId);
      // Save Google event ID back to local storage
      storage.updateEvent(event.id, { googleEventId });
    }

    return { success: true };
  } catch (error: any) {
    // Check for 401 Unauthorized - token expired
    if (error?.status === 401 || error?.result?.error?.code === 401) {
      console.error('[Google Sync] 認証トークンが期限切れです');
      storage.clearAuthToken();
      const message = 'Google認証が期限切れです。再度「Google連携」ボタンをクリックしてください。';
      return { success: false, message };
    }
    console.error('[Google Sync] 同期エラー:', error);
    const message = error?.result?.error?.message || error?.message || 'Google Calendar同期に失敗しました。';
    return { success: false, message };
  }
}

// Google Calendarイベント作成
async function createEventInGoogle(calendarId: string, event: any): Promise<string> {
  const response = await (window as any).gapi.client.calendar.events.insert({
    calendarId,
    resource: event,
  });

  return response.result.id;
}

// Google Calendarイベント更新
async function updateEventInGoogle(calendarId: string, eventId: string, event: any): Promise<void> {
  await (window as any).gapi.client.calendar.events.update({
    calendarId,
    eventId,
    resource: event,
  });
}

// Google Calendarイベント削除
export async function deleteEventFromGoogle(calendarId: string, eventId: string): Promise<void> {
  if (!isAuthenticated()) {
    console.warn('Not authenticated. Skipping Google Calendar deletion.');
    return;
  }

  try {
    await (window as any).gapi.client.calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    console.error('Failed to delete event from Google Calendar:', error);
    throw error;
  }
}

// ScheduleEventをGoogle Calendar形式に変換
function convertToGoogleEvent(event: ScheduleEvent): any {
  const googleEvent: any = {
    summary: `${event.title} [${EVENT_TYPE_LABELS[event.type]}]`,
    description: event.location ? `場所: ${event.location}` : '',
    extendedProperties: {
      private: {
        app: 'exec-schedule',
        eventId: event.id,
      },
    },
  };

  if (event.isAllDay) {
    // ISO文字列をDateオブジェクトに変換してローカル日付を取得
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    // YYYY-MM-DD形式に整形（ローカルタイムゾーン基準）
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    googleEvent.start = {
      date: formatLocalDate(startDate),
    };
    googleEvent.end = {
      date: formatLocalDate(endDate),
    };
  } else {
    googleEvent.start = {
      dateTime: event.startDate,
      timeZone: 'Asia/Tokyo',
    };
    googleEvent.end = {
      dateTime: event.endDate,
      timeZone: 'Asia/Tokyo',
    };
  }

  if (event.location) {
    googleEvent.location = event.location;
  }

  return googleEvent;
}

// FreeBusy APIで競合をチェック
export async function checkConflicts(
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  if (!isAuthenticated()) {
    return false;
  }

  try {
    const response = await (window as any).gapi.client.calendar.freebusy.query({
      resource: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const calendar = response.result.calendars[calendarId];
    return calendar && calendar.busy && calendar.busy.length > 0;
  } catch (error) {
    console.error('Failed to check conflicts:', error);
    return false;
  }
}

// 競合チェックとユーザーへの警告
export async function checkAndWarnConflicts(event: ScheduleEvent): Promise<boolean> {
  const executive = storage.getExecutives().find(e => e.id === event.executiveId);
  if (!executive?.calendarId) {
    return true; // Calendar ID not set, proceed without check
  }

  const hasConflict = await checkConflicts(
    executive.calendarId,
    new Date(event.startDate),
    new Date(event.endDate)
  );

  if (hasConflict) {
    return confirm(
      `${executive.title}の予定が重複しています。\n` +
      '続行しますか？'
    );
  }

  return true;
}
