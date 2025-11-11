export type EventType = 'meeting' | 'trip' | 'outing' | 'annualLeave' | 'other';

export interface Executive {
  id: string;
  title: string;        // 職位（局長、事務次長、病院次長、総務課長、総務課副課長）
  email: string;        // Google Calendar識別用
  calendarId: string;   // Google Calendar ID
  order: number;        // 表示順
}

export interface ScheduleEvent {
  id: string;
  executiveId: string;
  title: string;
  type: EventType;
  startDate: string;    // ISO 8601形式 (YYYY-MM-DDTHH:mm:ss)
  endDate: string;      // ISO 8601形式 (YYYY-MM-DDTHH:mm:ss)
  isAllDay: boolean;
  location?: string;
  googleEventId?: string;  // Google Calendar同期用
  createdAt: string;
  updatedAt: string;
}

export interface EventPosition {
  top: number;
  height: number;
  column: number;  // 0-6 (日-土)
}

export interface CalendarState {
  currentWeekStart: Date;
  selectedEvent: ScheduleEvent | null;
  isDialogOpen: boolean;
  isAuthenticated: boolean;
}

export interface SyncResult {
  success: boolean;
  message?: string;
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: '#004986',      // 会議：濃い青
  trip: '#00736D',         // 出張：濃い緑
  outing: '#F39800',       // 外出：オレンジ
  annualLeave: '#A40000',  // 年休：濃い赤
  other: '#6b7280',        // その他：グレー
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: '会議',
  trip: '出張',
  outing: '外出',
  annualLeave: '年休',
  other: 'その他',
};

// 営業時間: 8:00-20:00
export const BUSINESS_HOURS = {
  start: 8,
  end: 20,
} as const;

// 時間刻み: 15分
export const TIME_SLOT_MINUTES = 15;
