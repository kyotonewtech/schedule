import ExcelJS from 'exceljs';
import type { ScheduleEvent } from '../types';
import { EVENT_TYPE_LABELS } from '../types';
import { storage } from '../models/storage';
import { getWeekDates, getDayLabel, formatTime, formatWeekLabel } from './datetime';

// 印刷機能
export function printCalendar(): void {
  window.print();
}

// Excelエクスポート
export async function exportToExcel(weekStart: Date): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('局次長スケジュール');

  const executives = storage.getExecutives().sort((a, b) => a.order - b.order);
  const weekDates = getWeekDates(weekStart);
  const events = storage.getEventsByWeek(weekStart);

  // タイトル行
  worksheet.mergeCells('A1', 'H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `局次長スケジュール - ${formatWeekLabel(weekStart)}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // ヘッダー行
  const headerRow = worksheet.getRow(3);
  headerRow.values = ['職位', ...weekDates.map(d => getDayLabel(d))];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // スタイル設定
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // データ行
  let currentRow = 4;
  executives.forEach((executive) => {
    const row = worksheet.getRow(currentRow);
    const rowData: any[] = [executive.title];
    let maxEventsInDay = 0;

    weekDates.forEach((date) => {
      const dayEvents = events.filter(
        (event) =>
          event.executiveId === executive.id &&
          isEventOnDate(event, date)
      );

      maxEventsInDay = Math.max(maxEventsInDay, dayEvents.length);

      const eventText = dayEvents
        .map((event) => {
          const type = EVENT_TYPE_LABELS[event.type];
          if (event.isAllDay) {
            return `${event.title} [${type}] (終日)`;
          }
          const start = formatTime(new Date(event.startDate));
          const end = formatTime(new Date(event.endDate));
          return `${event.title} [${type}]\n${start}-${end}${
            event.location ? `\n場所: ${event.location}` : ''
          }`;
        })
        .join('\n\n');

      rowData.push(eventText);
    });

    row.values = rowData;
    row.height = Math.max(60, maxEventsInDay * 40);
    row.alignment = { vertical: 'top', wrapText: true };

    // セルスタイル
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      if (colNumber === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    currentRow++;
  });

  // 列幅設定
  worksheet.getColumn(1).width = 15; // 職位
  for (let i = 2; i <= 8; i++) {
    worksheet.getColumn(i).width = 25; // 日付列
  }

  // ダウンロード
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `局次長スケジュール_${formatWeekLabel(weekStart).replace(/\s/g, '_')}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function isEventOnDate(event: ScheduleEvent, date: Date): boolean {
  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return eventStart < dayEnd && eventEnd >= dayStart;
}
