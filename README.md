# QuickBill Pro

A fast, offline-first **billing & inventory app** for small retail stores, built with
React Native + Expo. Designed for a real shop counter: PIN login, quick billing with a
cart, product & stock management, and owner-only sales reports — all backed by a local
SQLite database so it works without internet.

## Features

- 🔐 **PIN-based login** with roles (Owner / Employee) and per-user discount limits
- 🧾 **Billing** — search products, build a cart, apply discounts, charge via Cash / UPI / Card / Credit
- 📦 **Products** — full create / edit / delete with buy & sell price, margin, category, barcode, expiry
- 🏷️ **Inventory** — live stock value, low-stock filter, quick +/- and bulk restock
- 📊 **Reports** (owner only) — 7-day sales trend chart, top products, weekly/monthly summaries
- 🌗 **Light / Dark / System** theme, remembered across launches
- ⚡ **Offline-first** SQLite storage with indexed queries and transactional checkout

## Default Accounts

| Role     | PIN  | Max Discount |
|----------|------|--------------|
| Owner    | 1234 | 100%         |
| Cashier  | 0000 | 10%          |

## Getting Started

```bash
npm install
npx expo start
```

Then press `a` for Android, or scan the QR code with the Expo Go / dev-client app.

## Tech Stack

- **Expo Router** (file-based routing in `src/app`)
- **expo-sqlite** (local database, see `src/database`)
- **TypeScript** with `@/*` path alias to `src/*`
- **react-native-chart-kit** for reports

## Project Structure

```
src/
  app/            # Expo Router routes (tabs, login, splash redirect)
  components/     # Reusable UI (Card, Button, Field…)
  context/        # Auth & Theme providers
  database/       # SQLite schema, singleton, data-access (repo.ts)
  hooks/          # useReload (refresh on focus)
  navigation/     # Tab navigator
  screens/        # Screen implementations
  types/          # Shared TypeScript types
  utils/          # id + formatting helpers
```

## Roadmap

- Barcode scanning (expo-camera)
- Excel export & Google Drive sync
- WhatsApp invoice sharing
- Customer credit (udhaar) management screen
- Employee shift open/close
