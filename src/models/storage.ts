import type { Executive, ScheduleEvent } from '../types';

const STORAGE_KEYS = {
  EXECUTIVES: 'exec-schedule:executives',
  EVENTS: 'exec-schedule:events',
  AUTH: 'exec-schedule:auth',
  USER_EMAIL: 'exec-schedule:user-email',
} as const;

// 初期データ: 5名の幹部
const DEFAULT_EXECUTIVES: Executive[] = [
  {
    id: 'exec-1',
    title: '局長',
    email: '',  // ユーザーが設定
    calendarId: '',
    order: 1,
  },
  {
    id: 'exec-2',
    title: '事務次長',
    email: '',
    calendarId: '',
    order: 2,
  },
  {
    id: 'exec-3',
    title: '病院次長',
    email: '',
    calendarId: '',
    order: 3,
  },
  {
    id: 'exec-4',
    title: '総務課長',
    email: '',
    calendarId: '',
    order: 4,
  },
  {
    id: 'exec-5',
    title: '総務課副課長',
    email: '',
    calendarId: '',
    order: 5,
  },
];

class StorageManager {
  // Executives
  getExecutives(): Executive[] {
    const data = localStorage.getItem(STORAGE_KEYS.EXECUTIVES);
    if (!data) {
      this.saveExecutives(DEFAULT_EXECUTIVES);
      return DEFAULT_EXECUTIVES;
    }
    return JSON.parse(data);
  }

  saveExecutives(executives: Executive[]): void {
    localStorage.setItem(STORAGE_KEYS.EXECUTIVES, JSON.stringify(executives));
  }

  updateExecutive(id: string, updates: Partial<Executive>): Executive | null {
    const executives = this.getExecutives();
    const index = executives.findIndex(e => e.id === id);
    if (index === -1) return null;

    executives[index] = { ...executives[index], ...updates };
    this.saveExecutives(executives);
    return executives[index];
  }

  // Events
  getEvents(): ScheduleEvent[] {
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return data ? JSON.parse(data) : [];
  }

  saveEvents(events: ScheduleEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  getEvent(id: string): ScheduleEvent | null {
    const events = this.getEvents();
    return events.find(e => e.id === id) || null;
  }

  createEvent(event: Omit<ScheduleEvent, 'id' | 'createdAt' | 'updatedAt'>): ScheduleEvent {
    const events = this.getEvents();
    const now = new Date().toISOString();
    const newEvent: ScheduleEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    events.push(newEvent);
    this.saveEvents(events);
    return newEvent;
  }

  updateEvent(id: string, updates: Partial<ScheduleEvent>): ScheduleEvent | null {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    if (index === -1) return null;

    events[index] = {
      ...events[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveEvents(events);
    return events[index];
  }

  deleteEvent(id: string): boolean {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return false;
    this.saveEvents(filtered);
    return true;
  }

  getEventsByWeek(weekStart: Date): ScheduleEvent[] {
    const events = this.getEvents();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      // イベントが週の範囲内にあるかチェック
      return eventStart < weekEnd && eventEnd >= weekStart;
    });
  }

  getEventsByExecutiveAndDate(executiveId: string, date: Date): ScheduleEvent[] {
    const events = this.getEvents();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return events.filter(event => {
      if (event.executiveId !== executiveId) return false;

      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      return eventStart < dayEnd && eventEnd >= dayStart;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  // Auth
  getAuthToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AUTH);
  }

  saveAuthToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.AUTH, token);
  }

  clearAuthToken(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  }

  // User Email (for primary calendar detection)
  getUserEmail(): string | null {
    return localStorage.getItem(STORAGE_KEYS.USER_EMAIL);
  }

  saveUserEmail(email: string): void {
    localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);
  }

  clearUserEmail(): void {
    localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
  }

  // Clear all data
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

export const storage = new StorageManager();
