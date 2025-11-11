import './styles/main.css';
import { Calendar } from './components/calendar';
import { EventDialog } from './components/eventDialog';
import { SettingsDialog } from './components/settingsDialog';
// import { DragDropManager } from './components/dragDrop'; // ドラッグ&ドロップ機能は一旦停止
import { getWeekStart, formatWeekLabel } from './utils/datetime';
import { printCalendar, exportToExcel } from './utils/export';
import { exportData, openImportDialog } from './utils/dataExport';
import { initGoogleAPI, authenticateGoogle, isAuthenticated } from './services/google';
import { storage } from './models/storage';

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

    // デバッグ情報の出力
    this.printDebugInfo();

    // Attach event listeners
    this.attachEventListeners();

    // Render initial calendar
    this.renderCalendar();
  }

  private printDebugInfo(): void {
    console.log('=== 局次長スケジュール デバッグ情報 ===');

    // gapi初期化状態
    const gapiExists = typeof (window as any).gapi !== 'undefined';
    const googleExists = typeof (window as any).google?.accounts !== 'undefined';
    console.log('gapi初期化:', gapiExists ? '✅' : '❌');
    console.log('Google Identity Services初期化:', googleExists ? '✅' : '❌');

    // 認証トークン状態
    const token = storage.getAuthToken();
    console.log('\n認証トークン:');
    console.log('  存在:', token ? '✅' : '❌');
    if (token) {
      console.log('  Token (first 20 chars):', token.substring(0, 20) + '...');
    }

    // 認証状態
    const authenticated = isAuthenticated();
    console.log('Google認証状態:', authenticated ? '✅ 認証済み' : '❌ 未認証');

    // トークンは存在するが認証状態がfalseの場合に警告
    if (token && !authenticated) {
      console.warn('\n⚠️ トークンは存在しますが、認証状態がfalseです。');
      console.warn('原因: トークンが無効か、gapiが初期化されていない可能性があります。');
      console.warn('対処: 「Google連携」ボタンをクリックして再認証してください。');
    }

    // 役員情報とカレンダーID設定状況
    const executives = storage.getExecutives();
    console.log('\n役員情報:');
    console.table(executives.map(exec => ({
      役職: exec.title,
      メール: exec.email || '(未設定)',
      カレンダーID: exec.calendarId || '(未設定)',
      'ID設定状況': exec.calendarId ? '✅' : '❌'
    })));

    // 設定されていない役員の警告
    const notConfigured = executives.filter(e => !e.calendarId);
    if (notConfigured.length > 0) {
      console.warn(
        '\n⚠️ 以下の役員のカレンダーIDが設定されていません:',
        notConfigured.map(e => e.title).join(', ')
      );
      console.warn('設定画面から設定してください。');
    }

    // Google連携が必要な場合の案内
    if (!authenticated) {
      console.warn('\n⚠️ Google認証が完了していません。');
      console.warn('「Google連携」ボタンをクリックして認証してください。');
    }

    console.log('============================================\n');
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

    // Settings dropdown menu
    const settingsBtn = document.getElementById('settingsBtn')!;
    const settingsMenu = document.getElementById('settingsMenu')!;

    // Toggle menu on settings button click
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = settingsMenu.style.display === 'block';
      settingsMenu.style.display = isVisible ? 'none' : 'block';
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      settingsMenu.style.display = 'none';
    });

    // Menu items
    document.getElementById('executiveSettingsBtn')!.addEventListener('click', () => {
      settingsMenu.style.display = 'none';
      this.settingsDialog.open();
    });

    document.getElementById('exportDataBtn')!.addEventListener('click', () => {
      settingsMenu.style.display = 'none';
      exportData();
    });

    document.getElementById('importDataBtn')!.addEventListener('click', () => {
      settingsMenu.style.display = 'none';
      openImportDialog(() => {
        this.refreshCalendar();
      });
    });

    // Google authentication
    document.getElementById('googleAuth')!.addEventListener('click', async () => {
      try {
        console.log('[Main] Starting authentication...');
        await authenticateGoogle();
        this.updateAuthButton();
        alert('Google認証が完了しました');
        console.log('[Main] Authentication successful, re-printing debug info...');
        this.printDebugInfo();
      } catch (error) {
        console.error('[Main] Authentication failed:', error);
        alert('Google認証に失敗しました');
        this.updateAuthButton();  // ボタン表示を更新
        this.printDebugInfo();  // デバッグ情報を再出力
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

    // Update print title
    const printTitle = document.getElementById('printTitle')!;
    printTitle.textContent = `局次長スケジュール - ${formatWeekLabel(this.currentWeekStart)}`;

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

    // Update print title
    const printTitle = document.getElementById('printTitle')!;
    printTitle.textContent = `局次長スケジュール - ${formatWeekLabel(this.currentWeekStart)}`;

    // Update auth button state (in case token expired)
    this.updateAuthButton();
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
