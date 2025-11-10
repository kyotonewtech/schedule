import './styles/main.css';
import { Calendar } from './components/calendar';
import { EventDialog } from './components/eventDialog';
import { SettingsDialog } from './components/settingsDialog';
// import { DragDropManager } from './components/dragDrop'; // ドラッグ&ドロップ機能は一旦停止
import { getWeekStart, formatWeekLabel } from './utils/datetime';
import { printCalendar, exportToExcel } from './utils/export';
import { initGoogleAPI, authenticateGoogle, isAuthenticated } from './services/google';

class App {
  private currentWeekStart: Date;
  private calendar: Calendar | null = null;
  private eventDialog: EventDialog;
  private settingsDialog: SettingsDialog;
  // private dragDropManager: DragDropManager; // ドラッグ&ドロップ機能は一旦停止
  private calendarContainer: HTMLElement;

  constructor() {
    this.currentWeekStart = getWeekStart();
    this.calendarContainer = document.getElementById('calendar-container')!;

    // Initialize components
    this.eventDialog = new EventDialog(() => this.refreshCalendar());
    this.settingsDialog = new SettingsDialog();
    // this.dragDropManager = new DragDropManager(() => this.refreshCalendar()); // ドラッグ&ドロップ機能は一旦停止

    this.init();
  }

  private async init(): Promise<void> {
    // Initialize Google API
    try {
      await initGoogleAPI();
      this.updateAuthButton();
    } catch (error) {
      console.error('Failed to initialize Google API:', error);
    }

    // Attach event listeners
    this.attachEventListeners();

    // Render initial calendar
    this.renderCalendar();
  }

  private attachEventListeners(): void {
    // Week navigation
    document.getElementById('prevWeek')!.addEventListener('click', () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      this.refreshCalendar();
    });

    document.getElementById('nextWeek')!.addEventListener('click', () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      this.refreshCalendar();
    });

    // Settings
    document.getElementById('settingsBtn')!.addEventListener('click', () => {
      this.settingsDialog.open();
    });

    // Google authentication
    document.getElementById('googleAuth')!.addEventListener('click', async () => {
      try {
        await authenticateGoogle();
        this.updateAuthButton();
        alert('Google認証が完了しました');
      } catch (error) {
        console.error('Authentication failed:', error);
        alert('Google認証に失敗しました');
      }
    });

    // Print
    document.getElementById('printBtn')!.addEventListener('click', () => {
      printCalendar();
    });

    // Excel export
    document.getElementById('excelBtn')!.addEventListener('click', async () => {
      try {
        await exportToExcel(this.currentWeekStart);
      } catch (error) {
        console.error('Export failed:', error);
        alert('Excelエクスポートに失敗しました');
      }
    });
  }

  private renderCalendar(): void {
    // Update week label
    const weekLabel = document.getElementById('currentWeek')!;
    weekLabel.textContent = formatWeekLabel(this.currentWeekStart);

    // Render calendar
    this.calendar = new Calendar(
      this.calendarContainer,
      this.currentWeekStart,
      (event) => {
        this.eventDialog.openForEdit(event);
      },
      (executiveId, date) => {
        this.eventDialog.openForCreate(executiveId, date);
      }
    );
    this.calendar.render();

    // Attach drag & drop
    // this.dragDropManager.attachToCalendar(this.calendarContainer); // ドラッグ&ドロップ機能は一旦停止
  }

  private refreshCalendar(): void {
    if (this.calendar) {
      this.calendar.update(this.currentWeekStart);
    } else {
      this.renderCalendar();
    }

    // Re-attach drag & drop
    // this.dragDropManager.attachToCalendar(this.calendarContainer); // ドラッグ&ドロップ機能は一旦停止

    // Update week label
    const weekLabel = document.getElementById('currentWeek')!;
    weekLabel.textContent = formatWeekLabel(this.currentWeekStart);
  }

  private updateAuthButton(): void {
    const authButton = document.getElementById('googleAuth')!;
    if (isAuthenticated()) {
      authButton.textContent = 'Google連携済み';
      authButton.classList.add('btn-success');
    } else {
      authButton.textContent = 'Google連携';
      authButton.classList.remove('btn-success');
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
