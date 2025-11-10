import type { ScheduleEvent, EventType } from '../types';
import { storage } from '../models/storage';
import { formatDate, formatTime, combineDateAndTime, parseLocalDate } from '../utils/datetime';
import { syncEventToGoogle } from '../services/google';

export class EventDialog {
  private overlay: HTMLElement;
  private form: HTMLFormElement;
  private currentEvent: ScheduleEvent | null = null;
  private currentExecutiveId: string | null = null;
  private onSave: () => void;

  constructor(onSave: () => void) {
    this.overlay = document.getElementById('eventDialog')!;
    this.form = document.getElementById('eventForm') as HTMLFormElement;
    this.onSave = onSave;
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close dialog
    document.getElementById('closeDialog')!.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('cancelBtn')!.addEventListener('click', () => {
      this.close();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // All day checkbox
    const allDayCheckbox = document.getElementById('isAllDay') as HTMLInputElement;
    const timeInputs = document.getElementById('timeInputs')!;

    allDayCheckbox.addEventListener('change', () => {
      if (allDayCheckbox.checked) {
        timeInputs.style.display = 'none';
      } else {
        timeInputs.style.display = 'block';
      }
    });

    // Event type change (hide location for annual leave)
    const eventTypeSelect = document.getElementById('eventType') as HTMLSelectElement;
    const locationGroup = document.getElementById('locationGroup')!;
    const eventTitleInput = document.getElementById('eventTitle') as HTMLInputElement;

    eventTypeSelect.addEventListener('change', () => {
      if (eventTypeSelect.value === 'annualLeave') {
        locationGroup.style.display = 'none';
        // 年休を選択したらタイトルに自動入力
        if (!eventTitleInput.value || eventTitleInput.value === '年休') {
          eventTitleInput.value = '年休';
        }
      } else {
        locationGroup.style.display = 'block';
        // 年休から他の種類に変更した場合、タイトルが「年休」だったらクリア
        if (eventTitleInput.value === '年休') {
          eventTitleInput.value = '';
        }
      }
    });

    // Form submit
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    // Delete button
    document.getElementById('deleteEventBtn')!.addEventListener('click', async () => {
      if (this.currentEvent && confirm('このイベントを削除しますか？')) {
        await this.handleDelete();
      }
    });
  }

  openForCreate(executiveId: string, date: Date): void {
    this.currentEvent = null;
    this.currentExecutiveId = executiveId;

    document.getElementById('dialogTitle')!.textContent = '新規イベント';
    document.getElementById('deleteEventBtn')!.style.display = 'none';

    // Reset form
    this.form.reset();

    // Set default values
    const eventDate = document.getElementById('eventDate') as HTMLInputElement;
    eventDate.value = formatDate(date);

    const startTime = document.getElementById('startTime') as HTMLInputElement;
    const endTime = document.getElementById('endTime') as HTMLInputElement;
    startTime.value = '09:00';
    endTime.value = '10:00';

    const allDayCheckbox = document.getElementById('isAllDay') as HTMLInputElement;
    allDayCheckbox.checked = false;
    document.getElementById('timeInputs')!.style.display = 'block';
    document.getElementById('locationGroup')!.style.display = 'block';

    this.show();
  }

  openForEdit(event: ScheduleEvent): void {
    this.currentEvent = event;
    this.currentExecutiveId = event.executiveId;

    document.getElementById('dialogTitle')!.textContent = 'イベント編集';
    document.getElementById('deleteEventBtn')!.style.display = 'block';

    // Fill form with event data
    const eventTitle = document.getElementById('eventTitle') as HTMLInputElement;
    const eventType = document.getElementById('eventType') as HTMLSelectElement;
    const eventDate = document.getElementById('eventDate') as HTMLInputElement;
    const isAllDay = document.getElementById('isAllDay') as HTMLInputElement;
    const startTime = document.getElementById('startTime') as HTMLInputElement;
    const endTime = document.getElementById('endTime') as HTMLInputElement;
    const eventLocation = document.getElementById('eventLocation') as HTMLInputElement;

    eventTitle.value = event.title;
    eventType.value = event.type;
    eventDate.value = event.startDate.split('T')[0];
    isAllDay.checked = event.isAllDay;
    eventLocation.value = event.location || '';

    if (event.isAllDay) {
      document.getElementById('timeInputs')!.style.display = 'none';
    } else {
      document.getElementById('timeInputs')!.style.display = 'block';
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      startTime.value = formatTime(start);
      endTime.value = formatTime(end);
    }

    // Hide location field for annual leave
    if (event.type === 'annualLeave') {
      document.getElementById('locationGroup')!.style.display = 'none';
    } else {
      document.getElementById('locationGroup')!.style.display = 'block';
    }

    this.show();
  }

  private async handleSubmit(): Promise<void> {
    const eventTitle = (document.getElementById('eventTitle') as HTMLInputElement).value.trim();
    const eventType = (document.getElementById('eventType') as HTMLSelectElement).value as EventType;
    const eventDate = (document.getElementById('eventDate') as HTMLInputElement).value;
    const isAllDay = (document.getElementById('isAllDay') as HTMLInputElement).checked;
    const startTime = (document.getElementById('startTime') as HTMLInputElement).value;
    const endTime = (document.getElementById('endTime') as HTMLInputElement).value;
    const eventLocation = (document.getElementById('eventLocation') as HTMLInputElement).value.trim();

    if (!eventTitle || !eventDate) {
      alert('タイトルと日付は必須です');
      return;
    }

    const date = parseLocalDate(eventDate);
    let startDate: Date;
    let endDate: Date;

    if (isAllDay) {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    } else {
      if (!startTime || !endTime) {
        alert('開始時刻と終了時刻を入力してください');
        return;
      }

      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);

      startDate = combineDateAndTime(date, startHours, startMinutes);
      endDate = combineDateAndTime(date, endHours, endMinutes);

      if (endDate <= startDate) {
        alert('終了時刻は開始時刻より後である必要があります');
        return;
      }
    }

    try {
      let savedEvent: ScheduleEvent;

      // Annual leave does not have location
      const location = eventType === 'annualLeave' ? undefined : (eventLocation || undefined);

      if (this.currentEvent) {
        // Update existing event
        savedEvent = storage.updateEvent(this.currentEvent.id, {
          title: eventTitle,
          type: eventType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isAllDay,
          location,
        })!;
      } else {
        // Create new event
        savedEvent = storage.createEvent({
          executiveId: this.currentExecutiveId!,
          title: eventTitle,
          type: eventType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isAllDay,
          location,
        });
      }

      // Sync to Google Calendar (optional - don't fail if sync fails)
      try {
        await syncEventToGoogle(savedEvent);
      } catch (syncError) {
        console.warn('Google Calendar sync failed:', syncError);
        // Continue anyway - event is saved locally
      }

      this.close();
      this.onSave();
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('イベントの保存に失敗しました');
    }
  }

  private async handleDelete(): Promise<void> {
    if (!this.currentEvent) return;

    try {
      // Delete from Google Calendar first
      if (this.currentEvent.googleEventId) {
        const executive = storage.getExecutives().find(e => e.id === this.currentEvent!.executiveId);
        if (executive?.calendarId) {
          const { deleteEventFromGoogle } = await import('../services/google');
          await deleteEventFromGoogle(executive.calendarId, this.currentEvent.googleEventId);
        }
      }

      // Delete from local storage
      storage.deleteEvent(this.currentEvent.id);

      this.close();
      this.onSave();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('イベントの削除に失敗しました');
    }
  }

  private show(): void {
    this.overlay.style.display = 'flex';
  }

  private close(): void {
    this.overlay.style.display = 'none';
    this.form.reset();
    this.currentEvent = null;
    this.currentExecutiveId = null;
  }
}
