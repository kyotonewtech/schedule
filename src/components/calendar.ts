import type { Executive, ScheduleEvent } from '../types';
import { EVENT_TYPE_COLORS } from '../types';
import { storage } from '../models/storage';
import {
  getWeekDates,
  getDayLabel,
  formatTime,
  formatDate,
  parseLocalDate,
} from '../utils/datetime';

export class Calendar {
  private container: HTMLElement;
  private executives: Executive[];
  private weekStart: Date;
  private onEventClick: (event: ScheduleEvent) => void;
  private onCellDoubleClick: (executiveId: string, date: Date) => void;

  constructor(
    container: HTMLElement,
    weekStart: Date,
    onEventClick: (event: ScheduleEvent) => void,
    onCellDoubleClick: (executiveId: string, date: Date) => void
  ) {
    this.container = container;
    this.weekStart = weekStart;
    this.executives = storage.getExecutives();
    this.onEventClick = onEventClick;
    this.onCellDoubleClick = onCellDoubleClick;
  }

  render(): void {
    const weekDates = getWeekDates(this.weekStart);
    const events = storage.getEventsByWeek(this.weekStart);

    const calendarHTML = `
      <div class="calendar">
        ${this.renderHeader(weekDates)}
        ${this.renderBody(weekDates, events)}
      </div>
    `;

    this.container.innerHTML = calendarHTML;
    this.attachEventListeners(weekDates);
  }

  private renderHeader(weekDates: Date[]): string {
    return `
      <div class="calendar-header">
        <div class="header-cell position-header">職位</div>
        ${weekDates.map(date => `
          <div class="header-cell">${getDayLabel(date)}</div>
        `).join('')}
      </div>
    `;
  }

  private renderBody(weekDates: Date[], events: ScheduleEvent[]): string {
    return this.executives
      .sort((a, b) => a.order - b.order)
      .map(executive => this.renderRow(executive, weekDates, events))
      .join('');
  }

  private renderRow(executive: Executive, weekDates: Date[], allEvents: ScheduleEvent[]): string {
    return `
      <div class="time-row" data-executive-id="${executive.id}">
        <div class="position-cell">
          ${executive.title}
        </div>
        ${weekDates.map((date, dayIndex) => {
          const dayEvents = allEvents.filter(event =>
            event.executiveId === executive.id &&
            this.isEventOnDate(event, date)
          );
          return this.renderDayCell(executive.id, date, dayIndex, dayEvents);
        }).join('')}
      </div>
    `;
  }

  private renderDayCell(executiveId: string, date: Date, dayIndex: number, events: ScheduleEvent[]): string {
    const dateStr = formatDate(date);
    const eventCount = events.length;
    // 基本3セル、4つ以上のイベントがある場合は行を追加
    const minSlots = 3;
    const displaySlots = Math.max(minSlots, eventCount);

    return `
      <div
        class="day-cell list-layout"
        data-executive-id="${executiveId}"
        data-date="${dateStr}"
        data-day-index="${dayIndex}"
        data-event-count="${eventCount}"
        style="--event-slots: ${displaySlots};"
      >
        ${events.map(event => this.renderEvent(event)).join('')}
      </div>
    `;
  }

  private renderEvent(event: ScheduleEvent): string {
    const color = EVENT_TYPE_COLORS[event.type];
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    const timeText = event.isAllDay
      ? '終日'
      : `${formatTime(startDate)} - ${formatTime(endDate)}`;

    // 時間と場所を同一行に表示
    const timeLocationText = event.location
      ? `${timeText} ${this.escapeHtml(event.location)}`
      : timeText;

    return `
      <div
        class="event-card list-style"
        data-event-id="${event.id}"
        style="background-color: ${color}; border-color: ${color};"
      >
        <div class="event-title">${this.escapeHtml(event.title)}</div>
        <div class="event-time">${timeLocationText}</div>
      </div>
    `;
  }

  private isEventOnDate(event: ScheduleEvent, date: Date): boolean {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return eventStart < dayEnd && eventEnd >= dayStart;
  }

  private attachEventListeners(_weekDates: Date[]): void {
    // Event card click
    this.container.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const eventId = (card as HTMLElement).dataset.eventId;
        if (eventId) {
          const event = storage.getEvent(eventId);
          if (event) {
            this.onEventClick(event);
          }
        }
      });
    });

    // Day cell click (create new event)
    this.container.querySelectorAll('.day-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // イベントカードやその内部要素がクリックされた場合は無視
        if (target.closest('.event-card')) {
          return;
        }
        // セル自体がクリックされた場合
        if (target.classList.contains('day-cell')) {
          const executiveId = target.dataset.executiveId!;
          const dateStr = target.dataset.date!;
          const date = parseLocalDate(dateStr);
          this.onCellDoubleClick(executiveId, date);
        }
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  update(weekStart: Date): void {
    this.weekStart = weekStart;
    this.render();
  }
}
