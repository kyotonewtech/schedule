import type { Executive, ScheduleEvent } from '../types';
import { storage } from '../models/storage';

interface ExportData {
  version: string;
  exportDate: string;
  executives: Executive[];
  events: ScheduleEvent[];
}

/**
 * 予定と役員設定をJSON形式でエクスポート
 */
export function exportData(): void {
  const data: ExportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    executives: storage.getExecutives(),
    events: storage.getEvents(),
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-backup-${formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[Export] データをエクスポートしました:', {
    executives: data.executives.length,
    events: data.events.length,
  });
}

/**
 * JSONファイルからデータをインポート（マージ方式）
 */
export async function importData(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const data: ExportData = JSON.parse(jsonString);

        // バージョンチェック
        if (!data.version || data.version !== '1.0') {
          const proceed = confirm(
            'このファイルのバージョンが異なる可能性があります。\n' +
            '続行しますか？'
          );
          if (!proceed) {
            reject(new Error('インポートがキャンセルされました'));
            return;
          }
        }

        // データ構造の検証
        if (!Array.isArray(data.executives) || !Array.isArray(data.events)) {
          throw new Error('データ形式が不正です');
        }

        // 役員設定のインポート（メールアドレスとカレンダーIDのみ更新）
        const currentExecutives = storage.getExecutives();
        data.executives.forEach(importedExec => {
          const existing = currentExecutives.find(e => e.id === importedExec.id);
          if (existing) {
            storage.updateExecutive(importedExec.id, {
              email: importedExec.email,
              calendarId: importedExec.calendarId,
            });
          }
        });

        // 予定のインポート（マージ方式）
        const currentEvents = storage.getEvents();
        const existingIds = new Set(currentEvents.map(e => e.id));
        let importedCount = 0;

        data.events.forEach(event => {
          // IDが重複する場合は新しいIDを生成
          if (existingIds.has(event.id)) {
            const newEvent = {
              ...event,
              id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              googleEventId: '', // Google Calendar IDはクリア（再同期が必要）
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            const allEvents = storage.getEvents();
            allEvents.push(newEvent);
            storage.saveEvents(allEvents);
            importedCount++;
          } else {
            // IDが重複しない場合はそのまま追加
            const newEvent = {
              ...event,
              googleEventId: '', // Google Calendar IDはクリア
            };
            const allEvents = storage.getEvents();
            allEvents.push(newEvent);
            storage.saveEvents(allEvents);
            importedCount++;
          }
        });

        console.log('[Import] データをインポートしました:', {
          executives: data.executives.length,
          eventsImported: importedCount,
        });

        alert(
          `インポートが完了しました。\n\n` +
          `役員設定: ${data.executives.length}件\n` +
          `予定: ${importedCount}件を追加しました。\n\n` +
          `※ Google Calendarとの同期が必要な場合は、\n` +
          `各予定を編集して再度保存してください。`
        );

        resolve();
      } catch (error) {
        console.error('[Import] エラー:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsText(file);
  });
}

/**
 * ファイル選択ダイアログを開いてインポートを実行
 */
export function openImportDialog(onComplete: () => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      await importData(file);
      onComplete();
    } catch (error: any) {
      alert(`インポートに失敗しました。\n\n${error?.message || error}`);
    }
  };

  input.click();
}

/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
