# Executive Schedule Management System

役員スケジュール管理システム - 週単位で役員のスケジュールを管理し、Google Calendarへ一方向同期するWebアプリケーション

## 機能概要

- 📅 週次カレンダー表示（日曜日スタート）
- 👥 5名の役員管理（局長、事務次長、病院次長、総務課長、総務課副課長）
- ✏️ イベント作成・編集・削除（シングルクリックで作成、ダブルクリックで編集）
- 🎨 種類別色分け（会議=青、出張=緑、外出=赤、年休=オレンジ、その他=グレー）
- 📝 年休の自動タイトル入力
- 🎨 土日の背景色表示（土曜=薄いブルー、日曜=薄いレッド）
- ⚙️ ブラウザ内設定画面で役員情報を管理
- 🔄 Google Calendarへ即時同期（一方向、オプション）
- 🖨️ 印刷機能
- 📊 Excelエクスポート
- 💾 LocalStorageによる自動保存

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` ファイルを編集して、Google Calendar APIの認証情報を設定:

```bash
VITE_GOOGLE_CLIENT_ID=あなたのクライアントID.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=あなたのAPIキー
```

### 3. Google Calendar API設定

#### Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. Google Calendar APIを有効化
4. APIキーを作成:
   - 「認証情報」→「認証情報を作成」→「APIキー」
   - キーを制限して、Google Calendar APIのみ許可を推奨
5. OAuth 2.0 クライアントIDを作成:
   - 「認証情報」→「認証情報を作成」→「OAuth クライアントID」
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのJavaScript生成元: `http://localhost:5173`（開発時）
   - 承認済みのリダイレクトURI: `http://localhost:5173`（開発時）
6. 取得したクライアントIDとAPIキーを `.env` ファイルに設定

### 4. 幹部のメールアドレス設定

初回起動後、「⚙️ 設定」ボタンから役員のメールアドレスとカレンダーIDを設定できます。

または、ブラウザの開発者ツールから直接編集:

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

1. カレンダーのセル（空白部分）をクリック
2. ダイアログでイベント情報を入力:
   - タイトル（必須、年休の場合は自動入力）
   - 種類（会議/出張/外出/年休/その他）
   - 日付（必須、クリックしたセルの日付がデフォルト）
   - 時間（15分刻み）または終日
   - 場所（年休の場合は非表示）
3. 「保存」をクリック

### イベントの編集

1. イベントカードをダブルクリック
2. 情報を編集
3. 「保存」または「削除」をクリック

### 役員情報の設定

1. ツールバーの「⚙️ 設定」ボタンをクリック
2. 各役員のメールアドレスとカレンダーIDを入力
3. 「保存」をクリック

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
  type: 'meeting' | 'trip' | 'outing' | 'annualLeave' | 'other';
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
- Google Calendar連携は**オプション**です。設定しなくてもローカルでスケジュール管理は可能です
- `.env` ファイルは `.gitignore` に含まれており、Gitにコミットされません
- 複数の総務スタッフが同時編集する場合、最後に保存した内容が優先されます
- Google Calendar APIのクォータ制限に注意してください

## トラブルシューティング

### Google API設定エラー

コンソールに以下のメッセージが表示される場合：
```
Google Calendar APIの設定が不完全です
```

対処法：
- `.env` ファイルが存在するか確認
- `.env` ファイルに `VITE_GOOGLE_CLIENT_ID` と `VITE_GOOGLE_API_KEY` が正しく設定されているか確認
- 開発サーバーを再起動（`npm run dev`）

**注意**: `.env` ファイルの変更後は必ず開発サーバーを再起動してください。

### Google認証エラー

- ブラウザのCookieとキャッシュをクリア
- Google Cloud Consoleで承認済みのURLを確認
- ポップアップブロッカーを無効化
- 認証トークンが期限切れの場合は再度「Google連携」ボタンをクリック

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
