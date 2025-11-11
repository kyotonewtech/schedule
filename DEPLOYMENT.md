# 本番環境デプロイ手順書

局次長スケジュール管理システムを学内サーバーにデプロイする手順です。

## 前提条件

- Node.js 18以上がインストールされている（ビルド時のみ必要）
- 学内サーバーでApacheまたはNginxが稼働している
- **HTTPS対応が必須**（Google OAuth2の要件）
- サーバーへのSSHアクセス権限がある

---

## 手順1: プロダクションビルド

### 1-1. 依存関係のインストール（初回のみ）

```bash
cd /mnt/c/temp/claude_hands/project/Executive_Schedule_Management_System
npm install
```

### 1-2. ビルド実行

```bash
npm run build
```

**確認**:
- `dist/` フォルダが作成される
- `dist/index.html`, `dist/assets/` などが生成される

---

## 手順2: Google Cloud Consoleの設定

### 2-1. プロジェクトの選択

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 現在使用中のプロジェクトを選択

### 2-2. OAuth 2.0 クライアントIDの編集

1. 左メニュー「APIとサービス」→「認証情報」
2. OAuth 2.0 クライアントIDのリストから該当のClient IDをクリック
3. **承認済みのJavaScript生成元**に以下を追加：
   ```
   https://schedule.your-domain.wakayama-med.ac.jp
   ```
   ※実際のURLに置き換えてください

4. **承認済みのリダイレクトURI**に以下を追加：
   ```
   https://schedule.your-domain.wakayama-med.ac.jp
   ```

5. 「保存」をクリック

### 2-3. APIキーの制限（セキュリティ強化）

1. 「認証情報」ページでAPI Keyをクリック
2. 「アプリケーションの制限」で「HTTPリファラー」を選択
3. 許可するリファラーを追加：
   ```
   https://schedule.your-domain.wakayama-med.ac.jp/*
   ```
4. 「保存」

---

## 手順3: サーバーへのデプロイ

### 3-1. ファイルのアップロード

**SCPでアップロード**:
```bash
scp -r dist/* username@server-address:/var/www/html/schedule/
```

**または、学内ファイル共有を使用**:
1. `dist/` フォルダの内容をすべてコピー
2. サーバーの公開ディレクトリに配置

### 3-2. ディレクトリ構成

サーバー上のディレクトリ構成例：
```
/var/www/html/schedule/
├── index.html
├── assets/
│   ├── index-abc123.js
│   └── index-xyz789.css
└── .htaccess (Apacheの場合)
```

---

## 手順4: Webサーバー設定

### 4-1. Apache設定（推奨）

`/var/www/html/schedule/.htaccess` を作成：

```apache
# SPAルーティング対応
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /schedule/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /schedule/index.html [L]
</IfModule>

# キャッシュ制御
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Gzip圧縮
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

**パーミッション設定**:
```bash
chmod 644 /var/www/html/schedule/.htaccess
chmod 644 /var/www/html/schedule/index.html
chmod -R 755 /var/www/html/schedule/assets/
```

### 4-2. Nginx設定（代替案）

`/etc/nginx/sites-available/default` または専用設定ファイルに追加：

```nginx
location /schedule/ {
    alias /var/www/html/schedule/;
    try_files $uri $uri/ /schedule/index.html;

    # キャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTMLはキャッシュしない
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

設定後、Nginxをリロード：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 手順5: HTTPS設定

### 5-1. Let's Encrypt（無料SSL証明書）

```bash
# Certbotのインストール（未インストールの場合）
sudo apt update
sudo apt install certbot python3-certbot-apache

# 証明書の取得とApache設定の自動化
sudo certbot --apache -d schedule.your-domain.wakayama-med.ac.jp

# 自動更新の確認
sudo certbot renew --dry-run
```

### 5-2. 学内認証局の証明書を使用

情報システム部門に以下を依頼：
- SSL証明書の発行
- サーバーへのインストール手順

---

## 手順6: 動作確認

### 6-1. 基本動作確認

1. ブラウザで `https://schedule.your-domain.wakayama-med.ac.jp` にアクセス
2. カレンダーが正しく表示されることを確認
3. 週の移動ができることを確認

### 6-2. Google連携確認

1. 「Google連携」ボタンをクリック
2. Googleログイン画面が表示される
3. 権限を許可
4. 「Google連携済み」と表示される

**エラーが出る場合**:
- ブラウザのコンソールでエラーメッセージを確認
- Google Cloud Consoleの承認済みURLが正しいか再確認

### 6-3. 予定登録・同期確認

1. 設定画面で役員のカレンダーIDを登録
2. テスト予定を1件作成
3. Google Calendarで予定が反映されていることを確認

### 6-4. 印刷機能確認

1. 「印刷」ボタンをクリック
2. 印刷プレビューでA4横1枚に収まることを確認
3. モノクロ印刷で文字が読めることを確認

### 6-5. エクスポート/インポート確認

1. 「設定」→「エクスポート」でJSONファイルをダウンロード
2. 「設定」→「インポート」でファイルを読み込み
3. 予定が正しく復元されることを確認

---

## トラブルシューティング

### 問題1: 「Google連携」ボタンをクリックしてもログイン画面が出ない

**原因**: リダイレクトURIの設定ミス

**解決**:
1. Google Cloud Consoleの「承認済みのリダイレクトURI」を確認
2. URLが完全一致しているか確認（末尾のスラッシュ有無も含む）
3. ブラウザのキャッシュをクリア

### 問題2: 予定がGoogle Calendarに反映されない

**原因1**: カレンダーIDの設定ミス
- 設定画面で正しいメールアドレスが入力されているか確認

**原因2**: カレンダー共有設定がされていない
- 各役員が管理者に「予定の変更」権限で共有しているか確認

**原因3**: 認証トークンの期限切れ
- 一度「Google連携」ボタンをクリックして再認証

### 問題3: 404エラーが表示される

**原因**: .htaccessまたはNginx設定の不備

**解決**:
- Apacheの場合: `mod_rewrite`が有効か確認
  ```bash
  sudo a2enmod rewrite
  sudo systemctl restart apache2
  ```
- Nginxの場合: `try_files`の設定を確認

### 問題4: ファイルが正しく読み込まれない

**原因**: パーミッション設定の問題

**解決**:
```bash
# ディレクトリ: 755
find /var/www/html/schedule -type d -exec chmod 755 {} \;

# ファイル: 644
find /var/www/html/schedule -type f -exec chmod 644 {} \;
```

---

## バックアップ・復元

### バックアップ方法

**自動バックアップ（推奨）**:
1. 「設定」→「エクスポート」を定期実行
2. ダウンロードしたJSONファイルを学内共有フォルダに保存

**手動バックアップ**:
ブラウザのコンソールで以下を実行：
```javascript
const backup = {
  executives: localStorage.getItem('exec-schedule:executives'),
  events: localStorage.getItem('exec-schedule:events'),
  exportDate: new Date().toISOString()
};
console.log(JSON.stringify(backup, null, 2));
```

出力されたJSONをテキストファイルとして保存。

### 復元方法

1. 「設定」→「インポート」でJSONファイルを選択
2. 既存データにマージされる

---

## セキュリティ対策

### 1. APIキーの制限

- Google Cloud Consoleで「HTTPリファラー」制限を設定済み
- 定期的にAPIキーの使用状況を確認

### 2. アクセス制限（オプション）

学内ネットワークのみアクセス可能にする場合：

**.htaccess に追加**:
```apache
Order deny,allow
Deny from all
Allow from 192.168.xxx.0/24
```

### 3. データバックアップ

- **週次**: 金曜日にエクスポート実行
- **月次**: 月末にバックアップファイルを別の場所に保管
- **年次**: 年度末に1年分のデータをアーカイブ

---

## 更新手順（新バージョンのデプロイ）

1. 開発環境で更新・テスト
2. `npm run build` で再ビルド
3. サーバー上の既存ファイルをバックアップ：
   ```bash
   cp -r /var/www/html/schedule /var/www/html/schedule.backup.$(date +%Y%m%d)
   ```
4. 新しい`dist/`の内容をアップロード
5. ブラウザでキャッシュクリア（Ctrl+Shift+R）して動作確認

---

## 問い合わせ先

- Google Cloud Console設定: 情報システム部門
- サーバー設定: 情報システム部門
- アプリケーション機能: 総務課

---

---

## Vercelを使用したデプロイ（推奨）

Vercelを使用した簡易デプロイ方法です。学内限定アクセスはGoogle Workspaceのドメイン制限で実現します。

### メリット

- ✅ **サーバー管理不要**: Vercelが自動でホスティング
- ✅ **無料プラン利用可能**: 小規模利用なら追加コストなし
- ✅ **自動デプロイ**: GitHubにpushするだけで自動更新
- ✅ **HTTPS自動対応**: SSL証明書の設定不要
- ✅ **高速CDN**: グローバルなコンテンツ配信ネットワーク
- ✅ **学内限定アクセス**: Google Workspaceドメイン制限で実現

### 前提条件

- GitHubアカウント（リポジトリが必要）
- Vercelアカウント（無料で作成可能）
- Google Workspaceアカウント（@wakayama-med.ac.jp等）
- Google Cloud Consoleへのアクセス権限

---

### 手順V-1: 設定ファイルの確認

プロジェクトルートに以下のファイルが既に作成されています：

#### vercel.json
```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

#### .vercelignore
デプロイに不要なファイルを除外する設定です。

---

### 手順V-2: Google Cloud Console設定（学内限定アクセス）

#### 重要: OAuth同意画面を「内部」に設定

これにより、Google Workspaceドメイン（@wakayama-med.ac.jp等）のユーザーのみがログイン可能になります。

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「APIとサービス」→「OAuth同意画面」を開く
3. **User Type**を「内部」に変更
   - **内部**: Google Workspaceドメイン内のユーザーのみ
   - 外部: 誰でもログイン可能（使用しない）
4. 「保存」をクリック

**この設定により**:
- ✅ @wakayama-med.ac.jpドメインのユーザーのみログイン可能
- ✅ 外部ユーザーはログインボタンをクリックしてもエラーになる
- ✅ 追加コスト・複雑な実装なしで学内限定を実現

---

### 手順V-3: GitHubリポジトリの準備

1. GitHubで新しいリポジトリを作成（privateでも可）
2. プロジェクトをGitリポジトリとして初期化：
   ```bash
   cd /mnt/c/temp/claude_hands/project/Executive_Schedule_Management_System
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/executive-schedule.git
   git push -u origin main
   ```

---

### 手順V-4: Vercelプロジェクトの作成

1. [Vercel](https://vercel.com)にアクセス
2. 「Sign Up」または「Log in」（GitHubアカウントでログイン推奨）
3. 「New Project」をクリック
4. GitHubリポジトリを選択
5. **プロジェクト設定**:
   - **Framework Preset**: Vite（自動検出される）
   - **Root Directory**: `./`（デフォルト）
   - **Build Command**: `npm run build`（自動設定）
   - **Output Directory**: `dist`（自動設定）

---

### 手順V-5: 環境変数の設定

Vercelプロジェクトの設定画面で環境変数を追加：

1. Vercelダッシュボードでプロジェクトを開く
2. 「Settings」→「Environment Variables」
3. 以下の2つの変数を追加：

| 変数名 | 値 | 環境 |
|--------|-----|------|
| `VITE_GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Production, Preview, Development |
| `VITE_GOOGLE_API_KEY` | `AIza...` | Production, Preview, Development |

**取得方法**:
- `.env`ファイルまたは`.env.example`を参照
- Google Cloud Consoleの「認証情報」から確認可能

4. 「Save」をクリック

---

### 手順V-6: デプロイ実行

1. 「Deploy」ボタンをクリック（または自動デプロイが開始）
2. ビルドログを確認（2-3分で完了）
3. デプロイ完了後、URLが表示される：
   ```
   https://your-project-name.vercel.app
   ```

---

### 手順V-7: Google Cloud ConsoleにVercel URLを追加

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「APIとサービス」→「認証情報」
3. OAuth 2.0 クライアントIDをクリック
4. **承認済みのJavaScript生成元**に追加：
   ```
   https://your-project-name.vercel.app
   ```
5. **承認済みのリダイレクトURI**に追加：
   ```
   https://your-project-name.vercel.app
   ```
6. 「保存」をクリック

---

### 手順V-8: 動作確認

#### 8-1. 基本動作確認（学内から）

1. ブラウザで `https://your-project-name.vercel.app` にアクセス
2. カレンダーが正しく表示されることを確認
3. 週の移動ができることを確認

#### 8-2. Google連携確認（学内ユーザー）

1. 「Google連携」ボタンをクリック
2. Googleログイン画面が表示される
3. **@wakayama-med.ac.jpアカウント**でログイン
4. 権限を許可
5. 「Google連携済み」と表示される

#### 8-3. 学内限定アクセスの確認

**テスト方法**:
- 学内ユーザー（@wakayama-med.ac.jp）: ✅ ログイン成功
- 外部ユーザー（Gmail等）: ❌ ログイン時にエラー表示

**期待される動作**:
- サイト自体は誰でも閲覧可能
- Google連携ボタンをクリックすると：
  - 学内ドメインユーザー: ログイン可能
  - 外部ユーザー: 「アクセスがブロックされました」エラー

---

### Vercelのトラブルシューティング

#### 問題V-1: ビルドエラーが発生する

**症状**: Vercelでのビルドが失敗する

**解決**:
1. ローカルで `npm run build` を実行してエラーを確認
2. `package.json` の依存関係を確認
3. Node.jsバージョンをVercel設定で指定：
   - Settings → General → Node.js Version → 18.x

#### 問題V-2: 環境変数が読み込まれない

**症状**: Google連携ボタンが動作しない、API Keyエラー

**解決**:
1. Vercelの「Settings」→「Environment Variables」を確認
2. 変数名が正確か確認（`VITE_` プレフィックス必須）
3. すべての環境（Production, Preview, Development）にチェックが入っているか確認
4. 再デプロイ（Deployments → 最新のデプロイ → "Redeploy"）

#### 問題V-3: 外部ユーザーがログインできてしまう

**症状**: 学内限定のはずが、外部のGoogleアカウントでもログイン可能

**原因**: OAuth同意画面が「外部」になっている

**解決**:
1. Google Cloud Console → OAuth同意画面
2. User Typeが「内部」になっているか確認
3. 「外部」の場合は「内部」に変更
4. Google Workspaceの管理者権限が必要な場合あり

#### 問題V-4: ページが404エラーになる

**症状**: トップページ以外でリロードすると404エラー

**原因**: `vercel.json` のrewrite設定が機能していない

**解決**:
1. `vercel.json` の内容を確認：
   ```json
   "rewrites": [
     {
       "source": "/(.*)",
       "destination": "/index.html"
     }
   ]
   ```
2. ファイルがGitHubにコミット・プッシュされているか確認
3. 再デプロイ

---

### カスタムドメインの設定（オプション）

学内ドメイン（例: `schedule.wakayama-med.ac.jp`）を使用する場合：

1. Vercelプロジェクトの「Settings」→「Domains」
2. 「Add Domain」でドメインを追加
3. DNS設定（情報システム部門に依頼）：
   - CNAMEレコード: `schedule` → `cname.vercel-dns.com`
4. Google Cloud ConsoleのOAuth URLも更新

---

### デプロイ後の更新手順

Vercelは**GitHubへのpushで自動デプロイ**されます：

1. ローカルで開発・修正
2. ローカルでテスト（`npm run dev`）
3. Gitにコミット＆プッシュ：
   ```bash
   git add .
   git commit -m "機能追加: XXX"
   git push origin main
   ```
4. Vercelが自動でビルド・デプロイ（2-3分）
5. デプロイ通知がメールで届く

---

### Vercel vs 学内サーバー比較

| 項目 | Vercel | 学内サーバー |
|------|--------|-------------|
| **コスト** | 無料〜 | サーバー維持費 |
| **サーバー管理** | 不要 | 必要 |
| **HTTPS設定** | 自動 | 手動設定必要 |
| **更新作業** | Git pushのみ | SCP/FTPアップロード |
| **学内限定** | OAuth制限 | IP制限 |
| **バックアップ** | Git履歴 | 手動バックアップ |
| **ダウンタイム** | ほぼなし | メンテナンス時あり |

---

**最終更新**: 2025-11-11
