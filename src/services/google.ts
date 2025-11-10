import type { ScheduleEvent } from '../types';
import { EVENT_TYPE_LABELS } from '../types';
import { storage } from '../models/storage';

// Google Calendar API設定
// 注意: 本番環境では環境変数から読み込むべき
const GOOGLE_CONFIG = {
  clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  apiKey: 'YOUR_API_KEY',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  scopes: 'https://www.googleapis.com/auth/calendar.events',
};

let gapiInitialized = false;
let gisInitialized = false;
let tokenClient: any = null;

// Google API初期化
export async function initGoogleAPI(): Promise<void> {
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
  return new Promise((resolve, reject) => {
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
      resolve(true);
    };

    // Check if already has valid token
    const token = storage.getAuthToken();
    if (token) {
      (window as any).gapi.client.setToken({ access_token: token });
      resolve(true);
      return;
    }

    // Request new token
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// 認証状態チェック
export function isAuthenticated(): boolean {
  const token = storage.getAuthToken();
  if (!token) return false;

  try {
    (window as any).gapi.client.setToken({ access_token: token });
    return true;
  } catch {
    return false;
  }
}

// イベントをGoogle Calendarに同期
export async function syncEventToGoogle(event: ScheduleEvent): Promise<void> {
  if (!isAuthenticated()) {
    console.warn('Not authenticated. Skipping Google Calendar sync.');
    return;
  }

  const executive = storage.getExecutives().find(e => e.id === event.executiveId);
  if (!executive?.calendarId) {
    console.warn('Executive calendar ID not set. Skipping sync.');
    return;
  }

  try {
    const calendarEvent = convertToGoogleEvent(event);

    if (event.googleEventId) {
      // Update existing event
      await updateEventInGoogle(executive.calendarId, event.googleEventId, calendarEvent);
    } else {
      // Create new event
      const googleEventId = await createEventInGoogle(executive.calendarId, calendarEvent);
      // Save Google event ID back to local storage
      storage.updateEvent(event.id, { googleEventId });
    }
  } catch (error: any) {
    // Check for 401 Unauthorized - token expired
    if (error?.status === 401 || error?.result?.error?.code === 401) {
      console.warn('Access token expired. Clearing token. Please re-authenticate.');
      storage.clearAuthToken();
      throw new Error('Google認証が期限切れです。再度「Google連携」ボタンをクリックしてください。');
    }
    console.error('Failed to sync event to Google Calendar:', error);
    throw error;
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
    googleEvent.start = {
      date: event.startDate.split('T')[0],
    };
    googleEvent.end = {
      date: event.endDate.split('T')[0],
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
