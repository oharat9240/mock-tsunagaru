# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

デジタルサイネージ管理システム「TSUNAGARU」のモック実装。コンテンツ、レイアウト、プレイリスト、スケジュールの管理機能を提供。

## Repository Structure

- **Frontend/** - React Router v7 SPA（Mantine UI）
- **Backend/** - Express + Drizzle ORM + PostgreSQL

## Development Commands

### Frontend (`Frontend/` ディレクトリ内)
```bash
pnpm dev          # 開発サーバー起動（http://localhost:5173）
pnpm build        # プロダクションビルド
pnpm check        # Biome lint/format（自動修正）
pnpm typecheck    # TypeScript型チェック（React Router typegen含む）
pnpm test         # Playwright E2Eテスト実行
pnpm test:ui      # Playwright UIモードでテスト実行
pnpm test:debug   # デバッグモードでテスト実行
```

### Backend (`Backend/` ディレクトリ内)
```bash
pnpm dev          # 開発サーバー起動（tsx watch）
pnpm db:generate  # Drizzle マイグレーション生成
pnpm db:push      # DBスキーマ反映
pnpm db:studio    # Drizzle Studio起動
```

## Architecture

### Frontend

- **Framework**: React Router v7（SSRオフ、SPAモード）
- **UI**: Mantine v8コンポーネント
- **状態管理**: Jotai（`app/states/`）- atoms + derived atoms パターン
- **型定義**: Zod スキーマ（`app/types/`）からTypeScript型を生成
- **パスエイリアス**: `~/*` → `./app/*`

主要なルート（`app/routes.ts`）:
- `/playlist` - プレイリスト管理
- `/schedule` - スケジュール管理
- `/layout` - レイアウト管理
- `/contents` - コンテンツ管理
- `/login`, `/settings` - 独立ページ

コンテンツタイプ: `video`, `image`, `text`, `youtube`, `url`, `weather`, `csv`

### Backend

- **Framework**: Express
- **ORM**: Drizzle ORM + PostgreSQL
- **DB Schema**: `Backend/src/db/schema.ts` - contents, layouts, playlists, schedules テーブル
- **ファイルアップロード**: Multer（`/uploads/` ディレクトリ）

主要なAPIエンドポイント:
- `/api/contents`, `/api/layouts`, `/api/playlists`, `/api/schedules` - CRUD操作
- `/api/files/upload` - ファイルアップロード
- `/api/download/content/:id` - ファイルダウンロード

### E2Eテスト

Playwright設定（`Frontend/playwright.config.ts`）:
- テストディレクトリ: `Frontend/e2e/`
- ページフィクスチャ: `Frontend/e2e/fixtures/`（base-page, content-page, layout-page等）
- 認証テストは並列、他のテストはシリアル実行

## Code Standards

- Biome: 120文字行幅、スペースインデント、import自動整理
- TypeScript strictモード
- Mantineコンポーネント優先（カスタムUI非推奨）
- React Router v7パターンに従う

## Environment Variables

`.env.example`を`.env`にコピーして設定:
- `VITE_API_URL` - Backend APIのURL
- `POSTGRES_*` - DB接続設定
- `WEATHER_API_URL`, `CSV_RENDERER_API_URL` - 外部サービスURL

## Performance and Tooling

Rust製高速ツールを優先使用:
- `fd` instead of `find`
- `rg` instead of `grep`
- `sd` instead of `sed`
