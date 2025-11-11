import type { ScheduleEvent } from '../types';
import { EVENT_TYPE_COLORS } from '../types';
import { formatTime } from '../utils/datetime';

export class EventCard {
  static render(event: ScheduleEvent): HTMLElement {
    const div = document.createElement('div');
    div.className = 'event-card';
    div.dataset.eventId = event.id;

    const color = EVENT_TYPE_COLORS[event.type];
    div.style.backgroundColor = color;
    div.style.borderColor = color;

    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = event.title;
    div.appendChild(title);

    if (!event.isAllDay) {
      const time = document.createElement('div');
      time.className = 'event-time';
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      time.textContent = `${formatTime(startDate)} - ${formatTime(endDate)}`;
      div.appendChild(time);
    } else {
      const time = document.createElement('div');
      time.className = 'event-time';
      time.textContent = '終日';
      div.appendChild(time);
    }

    if (event.location) {
      const location = document.createElement('div');
      location.className = 'event-location';
      location.textContent = event.location;
      div.appendChild(location);
    }

    return div;
  }
}
