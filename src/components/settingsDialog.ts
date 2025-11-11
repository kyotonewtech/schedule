import type { Executive } from '../types';
import { storage } from '../models/storage';
import { isAuthenticated, normalizeCalendarId } from '../services/google';

export class SettingsDialog {
  private overlay: HTMLElement;
  private form: HTMLFormElement;
  private tableBody: HTMLElement;
  private executives: Executive[];

  constructor() {
    this.overlay = document.getElementById('settingsDialog')!;
    this.form = document.getElementById('settingsForm') as HTMLFormElement;
    this.tableBody = document.getElementById('executivesTableBody')!;
    this.executives = [];
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close dialog
    document.getElementById('closeSettings')!.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('cancelSettings')!.addEventListener('click', () => {
      this.close();
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Form submit
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  open(): void {
    this.executives = storage.getExecutives();
    this.renderTable();
    this.show();
  }

  private renderTable(): void {
    this.tableBody.innerHTML = this.executives
      .sort((a, b) => a.order - b.order)
      .map(exec => `
        <tr>
          <td class="exec-title">${this.escapeHtml(exec.title)}</td>
          <td>
            <input
              type="email"
              class="form-input"
              data-exec-id="${exec.id}"
              data-field="email"
              value="${this.escapeHtml(exec.email)}"
              placeholder="example@wakayama-med.ac.jp"
            />
          </td>
          <td>
            <input
              type="text"
              class="form-input"
              data-exec-id="${exec.id}"
              data-field="calendarId"
              value="${this.escapeHtml(exec.calendarId)}"
              placeholder="通常はメールアドレスと同じ"
            />
          </td>
        </tr>
      `).join('');
  }

  private async handleSubmit(): Promise<void> {
    const inputs = this.tableBody.querySelectorAll('input');
    const updates: { [key: string]: Partial<Executive> } = {};

    inputs.forEach(input => {
      const execId = (input as HTMLInputElement).dataset.execId!;
      const field = (input as HTMLInputElement).dataset.field! as 'email' | 'calendarId';
      const value = (input as HTMLInputElement).value.trim();

      if (!updates[execId]) {
        updates[execId] = {};
      }
      updates[execId][field] = value;
    });

    // カレンダーIDの検証（認証済みの場合のみ）
    if (isAuthenticated()) {
      const validationResults: string[] = [];

      for (const [execId, update] of Object.entries(updates)) {
        if (update.calendarId) {
          const executive = this.executives.find(e => e.id === execId);
          const isValid = await this.validateCalendarId(update.calendarId);

          if (!isValid) {
            validationResults.push(`${executive?.title || execId}: カレンダーID「${update.calendarId}」の検証に失敗しました`);
          }
        }
      }

      if (validationResults.length > 0) {
        const proceed = confirm(
          '以下のカレンダーIDの検証に失敗しました:\n' +
          '（カレンダーが存在しないか、アクセス権限がない可能性があります）\n\n' +
          validationResults.join('\n') +
          '\n\nこのまま保存しますか？\n' +
          '※保存後、実際の予定登録時にエラーが発生する可能性があります。'
        );
        if (!proceed) {
          return;
        }
      }
    } else {
      // 認証していない場合は検証をスキップして警告
      const hasCalendarIds = Object.values(updates).some(u => u.calendarId);
      if (hasCalendarIds) {
        const proceed = confirm(
          'Google認証がされていないため、カレンダーIDの検証ができません。\n\n' +
          'カレンダーIDが正しいか確認してください。このまま保存しますか？'
        );
        if (!proceed) {
          return;
        }
      }
    }

    // Save updates
    Object.entries(updates).forEach(([execId, update]) => {
      storage.updateExecutive(execId, update);
    });

    alert('設定を保存しました');
    this.close();
  }

  private show(): void {
    this.overlay.style.display = 'flex';
  }

  private close(): void {
    this.overlay.style.display = 'none';
  }

  private async validateCalendarId(calendarId: string): Promise<boolean> {
    try {
      // カレンダーIDを正規化（プライマリカレンダーの自動検出）
      const normalizedId = normalizeCalendarId(calendarId);

      // FreeBusy APIを使用してカレンダーへのアクセス権限をテスト
      // このAPIは、イベント作成権限があれば成功する
      const now = new Date();
      const oneMinuteLater = new Date(now.getTime() + 60000);

      const response = await (window as any).gapi.client.calendar.freebusy.query({
        resource: {
          timeMin: now.toISOString(),
          timeMax: oneMinuteLater.toISOString(),
          items: [{ id: normalizedId }]
        }
      });

      // レスポンスにエラーがないか確認
      const calendarResult = response.result.calendars[normalizedId];
      if (calendarResult && calendarResult.errors && calendarResult.errors.length > 0) {
        console.warn('カレンダーID検証失敗:', calendarId, '(正規化:', normalizedId, ')', calendarResult.errors);
        return false;
      }

      console.log('カレンダーID検証成功:', calendarId, normalizedId !== calendarId ? `(正規化: ${normalizedId})` : '');
      return true;
    } catch (error: any) {
      console.warn('カレンダーID検証失敗:', calendarId, error);
      // 403エラーの場合は権限不足の可能性
      if (error?.status === 403) {
        console.warn('権限不足の可能性があります。カレンダーに「予定の変更」権限が必要です。');
      }
      return false;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
