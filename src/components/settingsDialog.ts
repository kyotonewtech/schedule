import type { Executive } from '../types';
import { storage } from '../models/storage';

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
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
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

  private handleSubmit(): void {
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
