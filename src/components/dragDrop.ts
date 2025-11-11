import { storage } from '../models/storage';
import { syncEventToGoogle } from '../services/google';
import { BUSINESS_HOURS } from '../types';
import { combineDateAndTime } from '../utils/datetime';

export class DragDropManager {
  private draggedElement: HTMLElement | null = null;
  private draggedEventId: string | null = null;
  private isDragging = false;
  private isResizing = false;
  private resizeDirection: 'top' | 'bottom' | null = null;
  private initialY = 0;
  private initialHeight = 0;
  private initialTop = 0;
  private onUpdate: () => void;

  constructor(onUpdate: () => void) {
    this.onUpdate = onUpdate;
  }

  attachToCalendar(calendarContainer: HTMLElement): void {
    // Event card drag
    calendarContainer.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const eventCard = target.closest('.event-card') as HTMLElement;

      if (!eventCard) return;

      // Check if clicking resize handle
      if (target.classList.contains('resize-handle')) {
        this.startResize(e, eventCard, target);
        return;
      }

      // Start drag
      if (!eventCard.classList.contains('all-day')) {
        this.startDrag(e, eventCard);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.onDrag(e);
      } else if (this.isResizing) {
        this.onResize(e);
      }
    });

    document.addEventListener('mouseup', async (e) => {
      if (this.isDragging) {
        await this.endDrag(e, calendarContainer);
      } else if (this.isResizing) {
        await this.endResize();
      }
    });
  }

  private startDrag(e: MouseEvent, eventCard: HTMLElement): void {
    this.isDragging = true;
    this.draggedElement = eventCard;
    this.draggedEventId = eventCard.dataset.eventId || null;
    eventCard.classList.add('dragging');
    e.preventDefault();
  }

  private onDrag(_e: MouseEvent): void {
    if (!this.draggedElement) return;
    // Visual feedback only - actual position update happens on drop
  }

  private async endDrag(e: MouseEvent, _calendarContainer: HTMLElement): Promise<void> {
    if (!this.draggedElement || !this.draggedEventId) {
      this.isDragging = false;
      return;
    }

    this.draggedElement.classList.remove('dragging');

    // Find target day cell
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    const dayCell = target?.closest('.day-cell') as HTMLElement;

    if (dayCell) {
      const newExecutiveId = dayCell.dataset.executiveId!;
      const newDateStr = dayCell.dataset.date!;

      // Get event and update date/executive
      const event = storage.getEvent(this.draggedEventId);
      if (event) {
        const oldStart = new Date(event.startDate);
        const oldEnd = new Date(event.endDate);
        const newDate = new Date(newDateStr);

        // Keep the same time, change only the date and executive
        const newStart = new Date(newDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);

        const newEnd = new Date(newDate);
        newEnd.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);

        const updatedEvent = storage.updateEvent(this.draggedEventId, {
          executiveId: newExecutiveId,
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        });

        if (updatedEvent) {
          await syncEventToGoogle(updatedEvent);
          this.onUpdate();
        }
      }
    }

    this.isDragging = false;
    this.draggedElement = null;
    this.draggedEventId = null;
  }

  private startResize(e: MouseEvent, eventCard: HTMLElement, handle: HTMLElement): void {
    this.isResizing = true;
    this.draggedElement = eventCard;
    this.draggedEventId = eventCard.dataset.eventId || null;
    this.resizeDirection = handle.classList.contains('resize-handle-top') ? 'top' : 'bottom';
    this.initialY = e.clientY;

    const rect = eventCard.getBoundingClientRect();
    this.initialHeight = rect.height;
    this.initialTop = parseFloat(eventCard.style.top) || 0;

    e.preventDefault();
    e.stopPropagation();
  }

  private onResize(e: MouseEvent): void {
    if (!this.draggedElement || !this.draggedEventId || !this.resizeDirection) return;

    const deltaY = e.clientY - this.initialY;
    const parentHeight = this.draggedElement.parentElement!.offsetHeight;
    const deltaPercent = (deltaY / parentHeight) * 100;

    if (this.resizeDirection === 'bottom') {
      // Resize from bottom
      const newHeight = this.initialHeight + deltaY;
      const newHeightPercent = (newHeight / parentHeight) * 100;
      this.draggedElement.style.height = `${Math.max(5, newHeightPercent)}%`;
    } else {
      // Resize from top
      const newTop = this.initialTop + deltaPercent;
      const newHeight = this.initialHeight - deltaY;
      const newHeightPercent = (newHeight / parentHeight) * 100;

      this.draggedElement.style.top = `${Math.max(0, Math.min(95, newTop))}%`;
      this.draggedElement.style.height = `${Math.max(5, newHeightPercent)}%`;
    }
  }

  private async endResize(): Promise<void> {
    if (!this.draggedElement || !this.draggedEventId) {
      this.isResizing = false;
      return;
    }

    const event = storage.getEvent(this.draggedEventId);
    if (!event) {
      this.isResizing = false;
      return;
    }

    // Calculate new times based on position
    const topPercent = parseFloat(this.draggedElement.style.top) || 0;
    const heightPercent = parseFloat(this.draggedElement.style.height) || 0;

    const businessStartMinutes = BUSINESS_HOURS.start * 60;
    const businessEndMinutes = BUSINESS_HOURS.end * 60;
    const businessDuration = businessEndMinutes - businessStartMinutes;

    const startMinutes = businessStartMinutes + (topPercent / 100) * businessDuration;
    const endMinutes = startMinutes + (heightPercent / 100) * businessDuration;

    // Round to 15 minute increments
    const roundedStartMinutes = Math.round(startMinutes / 15) * 15;
    const roundedEndMinutes = Math.round(endMinutes / 15) * 15;

    const eventDate = new Date(event.startDate);
    const startHours = Math.floor(roundedStartMinutes / 60);
    const startMins = roundedStartMinutes % 60;
    const endHours = Math.floor(roundedEndMinutes / 60);
    const endMins = roundedEndMinutes % 60;

    const newStart = combineDateAndTime(eventDate, startHours, startMins);
    const newEnd = combineDateAndTime(eventDate, endHours, endMins);

    if (newEnd > newStart) {
      const updatedEvent = storage.updateEvent(this.draggedEventId, {
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
      });

      if (updatedEvent) {
        await syncEventToGoogle(updatedEvent);
        this.onUpdate();
      }
    }

    this.isResizing = false;
    this.draggedElement = null;
    this.draggedEventId = null;
    this.resizeDirection = null;
  }
}
