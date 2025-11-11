# Executive Schedule Management System

役員スケジュール管理システム - 週単位で役員のスケジュールを管理し、Google Calendarへ一方向同期するWebアプリケーション

## 機能概要

- 📅 週次カレンダー表示（日曜日スタート、8:00-20:00）
- 👥 5名の幹部管理（局長、事務次長、病院次長、総務課長、総務課副課長）
- ✏️ イベント作成・編集・削除
- 🎨 種類別色分け（会議=赤、出張=緑、外出=青、その他=グレー）
- 🖱️ ドラッグ&ドロップでイベント移動
- 📏 リサイズでイベント時間変更
- 🔄 Google Calendarへ即時同期（一方向）
- ⚠️ スケジュール競合検出
- 🖨️ 印刷機能（A4横向き）
- 📊 Excelエクスポート
- 💾 LocalStorageによる自動保存

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Calendar API設定

#### Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. Google Calendar APIを有効化
4. 認証情報を作成:
   - OAuth 2.0 クライアントID
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのJavaScript生成元: `http://localhost:5173`（開発時）
   - 承認済みのリダイレクトURI: `http://localhost:5173`（開発時）

#### 認証情報の設定

`src/services/google.ts` の `GOOGLE_CONFIG` を更新:

```typescript
const GOOGLE_CONFIG = {
  clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  apiKey: 'YOUR_API_KEY',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
  scopes: 'https://www.googleapis.com/auth/calendar.events',
};
```

### 3. 幹部のメールアドレス設定

初回起動後、LocalStorageに保存された幹部データを編集:

1. ブラウザの開発者ツールを開く
2. Console タブで以下を実行:

```javascript
const executives = JSON.parse(localStorage.getItem('exec-schedule:executives'));
executives[0].email = 'director@example.com';      // 局長
executives[0].calendarId = 'director@example.com';
executives[1].email = 'admin-deputy@example.com';  // 事務次長
executives[1].calendarId = 'admin-deputy@example.com';
executives[2].email = 'hospital-deputy@example.com'; // 病院次長
executives[2].calendarId = 'hospital-deputy@example.com';
executives[3].email = 'ga-chief@example.com';      // 総務課長
executives[3].calendarId = 'ga-chief@example.com';
executives[4].email = 'ga-deputy-chief@example.com'; // 総務課副課長
executives[4].calendarId = 'ga-deputy-chief@example.com';
localStorage.setItem('exec-schedule:executives', JSON.stringify(executives));
```

## 開発

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開く

### ビルド

```bash
npm run build
```

### プレビュー

```bash
npm run preview
```

## 使い方

### イベントの作成

1. カレンダーのセルをダブルクリック
2. ダイアログでイベント情報を入力:
   - タイトル（必須）
   - 種類（会議/出張/外出/その他）
   - 日付（必須）
   - 時間（15分刻み）または終日
   - 場所
3. 「保存」をクリック

### イベントの編集

1. イベントカードをダブルクリック
2. 情報を編集
3. 「保存」または「削除」をクリック

### イベントの移動

- イベントカードをドラッグして別の日または別の幹部にドロップ

### イベントの時間変更

- イベントカードの上端または下端をドラッグしてリサイズ

### Google Calendar連携

1. 「Google連携」ボタンをクリック
2. Googleアカウントでログイン
3. カレンダーへのアクセス権限を許可
4. 以降、イベントの作成・更新・削除が自動的にGoogle Calendarに反映されます

### 印刷

- 「印刷」ボタンをクリック
- ブラウザの印刷ダイアログでA4横向きを選択

### Excelエクスポート

- 「Excel出力」ボタンをクリック
- 週次スケジュールがExcelファイルとしてダウンロードされます

## 技術スタック

- **TypeScript** - 型安全性
- **Vite** - 高速ビルドツール
- **Vanilla JS/TS** - フレームワークなし
- **Google Calendar API** - カレンダー連携
- **ExcelJS** - Excelエクスポート
- **LocalStorage** - データ永続化

## データ構造

### Executive（幹部）

```typescript
interface Executive {
  id: string;
  title: string;        // 職位
  email: string;        // メールアドレス
  calendarId: string;   // Google Calendar ID
  order: number;        // 表示順
}
```

### ScheduleEvent（イベント）

```typescript
interface ScheduleEvent {
  id: string;
  executiveId: string;
  title: string;
  type: 'meeting' | 'trip' | 'outing' | 'other';
  startDate: string;    // ISO 8601形式
  endDate: string;
  isAllDay: boolean;
  location?: string;
  googleEventId?: string;
  createdAt: string;
  updatedAt: string;
}
```

## LocalStorageキー

- `exec-schedule:executives` - 幹部データ
- `exec-schedule:events` - イベントデータ
- `exec-schedule:auth` - Google認証トークン

## 注意事項

- LocalStorageが主データソースです。ブラウザのデータを消去するとすべてのデータが失われます
- Google Calendarへの同期は一方向（システム→Google）のみです
- 複数の総務スタッフが同時編集する場合、最後に保存した内容が優先されます
- Google Calendar APIのクォータ制限に注意してください

## トラブルシューティング

### Google認証エラー

- ブラウザのCookieとキャッシュをクリア
- Google Cloud Consoleで承認済みのURLを確認
- ポップアップブロッカーを無効化

### イベントが同期されない

- Google認証が完了しているか確認
- 幹部のcalendarIdが正しく設定されているか確認
- ブラウザのコンソールでエラーを確認

### LocalStorageデータのバックアップ

```javascript
// エクスポート
const data = {
  executives: localStorage.getItem('exec-schedule:executives'),
  events: localStorage.getItem('exec-schedule:events'),
};
console.log(JSON.stringify(data));

// インポート
localStorage.setItem('exec-schedule:executives', data.executives);
localStorage.setItem('exec-schedule:events', data.events);
```

## ライセンス

MIT
