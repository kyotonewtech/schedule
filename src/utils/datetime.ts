export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sunday) - 6 (Saturday)
  const diff = day; // 日曜日スタートなので、そのまま差分
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)}T${formatTime(date)}:00`;
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = weekStart.getMonth() + 1;
  const startDay = weekStart.getDate();
  const endMonth = weekEnd.getMonth() + 1;
  const endDay = weekEnd.getDate();
  const year = weekStart.getFullYear();

  if (startMonth === endMonth) {
    return `${year}年${startMonth}月${startDay}日 〜 ${endDay}日`;
  }
  return `${year}年${startMonth}月${startDay}日 〜 ${endMonth}月${endDay}日`;
}

export function getDayLabel(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = days[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}(${dayOfWeek})`;
}

export function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

export function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): { hours: number; minutes: number } {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return { hours, minutes: mins };
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function combineDateAndTime(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// 日付文字列(YYYY-MM-DD)からローカル日付を作成
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// 時間文字列から分を取得 (例: "13:45" -> 825分)
export function timeStringToMinutes(timeString: string): number {
  const { hours, minutes } = parseTime(timeString);
  return timeToMinutes(hours, minutes);
}

// 分から時間文字列を取得 (例: 825分 -> "13:45")
export function minutesToTimeString(minutes: number): string {
  const { hours, minutes: mins } = minutesToTime(minutes);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
