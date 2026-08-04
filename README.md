# QuickBill Platform

One offline-first POS codebase that produces two products:

| Product | Use case | Android package | App mode |
|---|---|---|---|
| **QuickBill Pro** | Retail, kirana, inventory and credit billing | `com.quickbill.pro` | `kirana` |
| **QuickServe POS** | Restaurants and hotels with table-based ordering | `com.quickbill.resto` | `restaurant` |

The project is built with React Native, Expo SDK 54, Expo Router, TypeScript and SQLite. Both products share the same stable billing, inventory, reporting, staff, invoice and offline data layers. A build-time flavor changes the app identity and business workflow without duplicating the codebase.

> **Current release stage:** controlled-customer/pilot MVP. Android and browser/PWA builds work. A native Windows Tauri package, desktop-to-mobile cloud sync, production iOS validation and commercial launch infrastructure remain on the roadmap.

---

## Table of contents

1. [Product overview](#product-overview)
2. [Feature matrix](#feature-matrix)
3. [Architecture](#architecture)
4. [Repository navigation](#repository-navigation)
5. [Local development](#local-development)
6. [Build flavors](#build-flavors)
7. [Android builds](#android-builds)
8. [Web and desktop preview](#web-and-desktop-preview)
9. [iOS status](#ios-status)
10. [Database and migrations](#database-and-migrations)
11. [Cloud sync and backup](#cloud-sync-and-backup)
12. [GST and service-charge calculations](#gst-and-service-charge-calculations)
13. [Invoices and exports](#invoices-and-exports)
14. [Authentication and permissions](#authentication-and-permissions)
15. [Verification before pushing](#verification-before-pushing)
16. [Known limitations](#known-limitations)
17. [Launch roadmap](#launch-roadmap)
18. [Team contribution workflow](#team-contribution-workflow)
19. [Troubleshooting](#troubleshooting)

---

## Product overview

### QuickBill Pro — retail and kirana

QuickBill Pro is a fast offline POS for Indian retail stores.

Core workflows:

- Product and barcode catalogue
- Mobile camera barcode scanning
- Desktop USB barcode scanner support
- Fast cart billing with Cash, UPI, Card or Credit/Udhaar
- Amount or percentage discounts with employee limits
- Optional GSTIN and additive CGST/SGST billing
- Customer accounts, credit limits, payments and WhatsApp reminders
- Inventory, low-stock limits, batches and expiry
- Suppliers, purchases, stock-in and supplier dues
- Sales history, returns, edits and owner-only deletion
- Staff PINs and granular permissions
- Shift open/close and Z-report reconciliation
- P&L, sales trends, hourly sales, best sellers and dead stock
- PDF invoices, WhatsApp invoice text and Excel exports
- Offline file backup plus Google Drive multi-device merge sync

### QuickServe POS — restaurants and hotels

QuickServe reuses the shared POS foundation and replaces retail cart billing with table-based service.

Core workflows:

- Tables grid with empty/occupied state and running totals
- Add, rename and remove tables
- Open a table, add dishes/items and change quantities
- Menu grouped by category (for example Starters, Main Course and Drinks)
- Optional inventory per item:
  - dishes are untracked by default;
  - bottles, cigarettes and packaged goods can track stock
- Table discount and settlement through Cash, UPI or Card
- Optional service charge followed by additive GST
- GSTIN, CGST/SGST and service-charge lines on invoices
- Shared inventory, supplier, staff, report, backup and invoice modules
- Separate Android identity and separate Drive snapshot from QuickBill Pro

Restaurant functionality is currently a strong MVP. Kitchen Order Tickets (KOT), kitchen display/printer integration, split bills, table transfer and merge-safe open-table synchronization are planned production features.

---

## Feature matrix

| Capability | QuickBill Pro | QuickServe POS |
|---|:---:|:---:|
| Offline SQLite operation | ✅ | ✅ |
| Retail cart billing | ✅ | — |
| Table-based ordering | — | ✅ |
| Product catalogue | ✅ | Shared as Menu |
| Category grouping | Product categories | Menu sections |
| Camera barcode scan | ✅ | Hidden by default |
| Desktop USB barcode scanner | ✅ | ✅ for packaged items |
| Optional per-item stock | Stock tracked | Dishes optional |
| Customers and Udhaar | ✅ | Shared |
| Suppliers and stock-in | ✅ | Shared |
| Staff roles and permissions | ✅ | ✅ |
| GSTIN and CGST/SGST | ✅ | ✅ |
| Optional service charge | — | ✅ |
| PDF invoice and WhatsApp text | ✅ | ✅ |
| Analytics and reports | ✅ | ✅ |
| Manual file backup/restore | ✅ | ✅ |
| Android Google Drive sync | ✅ | Code ready; OAuth credential required |
| Browser/PWA build | ✅ | ✅ |
| Native Windows installer | Planned | Planned |
| Production-tested iOS build | Planned | Planned |

---

## Architecture

### Offline-first data flow

```text
UI screen
   │
   ▼
database/repo.ts
   │
   ▼
local SQLite database
   │
   ├── immediate offline reads/writes
   ├── stock event ledger
   ├── append-only sales and transaction records
   └── debounced Google Drive snapshot upload (native mobile)

Every ~20 seconds / app foreground:
Google Drive snapshot → record-level merge → recompute stock/dues/payables → refresh screens
```

The application does not require an internet connection for day-to-day billing. Internet is only needed for Google authentication, Drive synchronization and online sharing.

### Flavor selection

[app.config.js](app.config.js) reads `APP_FLAVOR` at build time:

- no value / default → `kirana`
- `APP_FLAVOR=restaurant` → `restaurant`

Runtime checks are centralized in [src/utils/mode.ts](src/utils/mode.ts). Avoid scattering raw environment checks throughout the app.

### Shared versus flavor-specific code

Shared:

- SQLite schema and repository
- Authentication and staff permissions
- Products/menu definitions
- Inventory, purchases, suppliers and customers
- Checkout, sales, reports, invoices, backup and sync
- Theme and reusable UI components

Flavor-specific:

- Tab navigation (Billing versus Tables)
- Barcode scan visibility
- Product versus Menu terminology
- Default stock behavior
- Restaurant table/order screens
- Service-charge setting
- App name, package ID and cloud snapshot filename

---

## Repository navigation

```text
quickbill-pro/
├── app.json                   # Shared Expo base configuration
├── app.config.js              # Dynamic kirana/restaurant flavor overrides
├── eas.json                   # EAS Android build profiles
├── metro.config.js            # Metro + web WASM/COOP/COEP setup
├── package.json               # Commands and dependencies
├── assets/                    # App icons, adaptive icon and splash assets
├── scripts/
│   ├── serve-web.js           # Static server with SQLite-required headers
│   ├── gen-icons.js           # Original icon generator
│   └── icons-from-source.js   # Source-logo icon processing
└── src/
    ├── app/                    # Expo Router route wrappers
    │   ├── (tabs)/             # Home, Billing/Tables, Products/Menu, Stock, Reports, Settings
    │   ├── sale/[id].tsx       # Sale details route
    │   ├── table/[id].tsx      # Restaurant table order route
    │   ├── invoice/[id].tsx    # Invoice route
    │   └── _layout.tsx         # Providers, stack and sync initialization
    ├── screens/                # Main screen implementations
    │   ├── BillingScreen.tsx   # Retail cart and checkout
    │   ├── TablesScreen.tsx    # Restaurant tables grid
    │   ├── TableOrderScreen.tsx# Restaurant open order and settlement
    │   ├── ProductsScreen.tsx  # Retail Products / restaurant Menu
    │   ├── InventoryScreen.tsx # Tracked stock only
    │   ├── InvoiceScreen.tsx   # Invoice preview and sharing
    │   └── ...
    ├── database/
    │   ├── schema.ts           # CREATE TABLE statements and safe migrations
    │   ├── index.ts            # Database singleton and write hook
    │   ├── repo.ts             # Data-access and business transactions
    │   └── backup.ts           # Snapshot export, full restore and safe merge
    ├── context/
    │   ├── AuthContext.tsx     # Session, PIN requirement and roles
    │   ├── StoreContext.tsx    # Store profile, GST and service settings
    │   └── ThemeContext.tsx    # Light/dark/system theme
    ├── navigation/
    │   └── TabNavigator.tsx    # Flavor-aware tabs and header
    ├── components/
    │   ├── ui.tsx              # Card, Button, Field and EmptyState
    │   ├── Dialog.tsx          # App-themed alert/dialog host
    │   └── BarcodeScanner.tsx  # Camera scanner
    ├── hooks/
    │   ├── useReload.ts        # Focus and sync-triggered reload
    │   └── useBarcodeWedge.ts  # Desktop USB scanner keyboard capture
    ├── utils/
    │   ├── mode.ts             # Flavor helper
    │   ├── tax.ts              # Shared GST/service-charge calculations
    │   ├── invoice.ts          # Printable invoice HTML
    │   ├── drivesync.ts        # Google Drive REST integration
    │   ├── autosync.ts         # Debounced push + 20-second pull
    │   ├── syncbus.ts          # Refresh events after remote merge
    │   └── share.ts            # Native/web file sharing and downloads
    └── types/
        └── index.ts            # Shared domain interfaces
```

### Where to start for common tasks

| Task | Start here |
|---|---|
| Change retail billing | [src/screens/BillingScreen.tsx](src/screens/BillingScreen.tsx) |
| Change restaurant table billing | [src/screens/TableOrderScreen.tsx](src/screens/TableOrderScreen.tsx) |
| Change tables grid | [src/screens/TablesScreen.tsx](src/screens/TablesScreen.tsx) |
| Change products/menu | [src/screens/ProductsScreen.tsx](src/screens/ProductsScreen.tsx) |
| Add a database field/table | [src/database/schema.ts](src/database/schema.ts), then [src/database/repo.ts](src/database/repo.ts) |
| Change checkout math | [src/utils/tax.ts](src/utils/tax.ts), then [src/database/repo.ts](src/database/repo.ts) |
| Change invoices | [src/screens/InvoiceScreen.tsx](src/screens/InvoiceScreen.tsx), [src/utils/invoice.ts](src/utils/invoice.ts) |
| Change sync behavior | [src/database/backup.ts](src/database/backup.ts), [src/utils/autosync.ts](src/utils/autosync.ts) |
| Change app flavors | [app.config.js](app.config.js), [src/utils/mode.ts](src/utils/mode.ts) |
| Change navigation | [src/navigation/TabNavigator.tsx](src/navigation/TabNavigator.tsx), [src/app/](src/app/) |

---

## Local development

### Requirements

- Node.js 20 or newer
- npm
- Git
- Expo/EAS account for cloud builds
- Android phone/emulator for native testing
- Rust/Cargo only for the planned Tauri Windows package

### Install dependencies

```bash
git clone https://github.com/OjasJibhakate/Quickbill-pro.git
cd Quickbill-pro
npm install
```

The repository includes [.npmrc](.npmrc) with legacy peer dependency handling required by the current dependency tree.

### Start the default retail flavor

```bash
npm start
```

or:

```bash
npm run android
```

### Start the restaurant flavor in a browser

```bash
npm run web:restaurant
```

The flavor is embedded into the JavaScript bundle. Flavor-switching commands use `--clear` to prevent Metro from reusing a bundle generated for the other product.

### Default development accounts

| Role | PIN | Notes |
|---|---:|---|
| Owner | `1234` | Full access |
| Cashier | `0000` | Employee defaults |

These are development seeds. A production onboarding flow must require the owner to replace the default PINs before using the app commercially.

---

## Build flavors

### Retail / kirana

Default configuration:

```text
Name:       QuickBill Pro
Mode:       kirana
Android:    com.quickbill.pro
iOS:        com.quickbill.pro
Drive file: quickbill-snapshot.json
```

### Restaurant / hotel

Set by `APP_FLAVOR=restaurant` or an EAS restaurant profile:

```text
Name:       QuickServe POS
Mode:       restaurant
Android:    com.quickbill.resto
iOS:        com.quickbill.resto
Drive file: quickserve-snapshot.json
```

Both apps can be installed on the same device and can use the same Google account without mixing business data.

---

## Android builds

EAS profiles are defined in [eas.json](eas.json).

### Internal APK — retail

```bash
eas build -p android --profile preview
```

### Internal APK — restaurant

```bash
eas build -p android --profile restaurant
```

### Play Store AAB — retail

```bash
eas build -p android --profile production
```

### Play Store AAB — restaurant

```bash
eas build -p android --profile restaurant-production
```

After upload, the terminal can be closed safely; the EAS cloud build continues at the URL printed by the CLI.

### Restaurant Google OAuth credential

QuickServe's Android Google Sign-In requires an Android OAuth client in the same Google Cloud project:

```text
Package: com.quickbill.resto
SHA-1:   61:81:72:88:CF:CB:CA:57:97:54:42:27:1C:5F:DB:1B:9E:08:B4:AF
```

Create it in Google Cloud Console:

1. APIs & Services → Credentials
2. Create credentials → OAuth client ID
3. Application type: Android
4. Enter the package and SHA-1 above
5. Ensure the required Google account is an OAuth test user while the consent screen is in Testing

Never upload a keystore, `credentials.json`, OAuth client secret or service-account key to Git.

---

## Web and desktop preview

The web target uses `expo-sqlite` through WASM and OPFS. It requires cross-origin isolation headers; therefore use the supplied server instead of opening `dist/index.html` directly.

### Retail desktop preview

```bash
npm run desktop
```

### Restaurant desktop preview

```bash
npm run desktop:restaurant
```

Then open:

```text
http://localhost:8080
```

The command exports a static web build and starts [scripts/serve-web.js](scripts/serve-web.js), which supplies the required COOP/COEP headers.

### USB barcode scanners

Most USB scanners behave as keyboards. [src/hooks/useBarcodeWedge.ts](src/hooks/useBarcodeWedge.ts) captures the scanner's fast character burst followed by Enter and adds the matching item directly.

- Retail: active in Billing
- Restaurant: active in an open table order for packaged/barcoded items
- Mobile: camera scanning remains the native mechanism

### Desktop status

The browser/PWA version is working, but a native Windows `.exe` has not yet been packaged. Rust/Cargo is installed on the primary development machine. The planned desktop target is Tauri 2 with two product identities and signed installers.

---

## iOS status

The shared Expo code and iOS bundle identifiers exist, but production iOS delivery is not complete.

Remaining iOS work:

- Apple Developer account and App Store Connect applications
- iOS Google OAuth clients for both bundle identifiers
- EAS iOS credentials and provisioning
- Physical iPhone/iPad testing
- TestFlight validation
- Camera, sharing, printing, Drive and file-picker tests
- App Store privacy labels, screenshots and review metadata

Do not describe the current repository as production-tested on iOS until these checks are complete.

---

## Database and migrations

### Core tables

Definitions:

- `users`
- `products`
- `customers`
- `suppliers`
- `dining_tables`

Transactions/events:

- `sales`, `sale_items`
- `credit_transactions`
- `purchases`, `purchase_items`
- `product_batches`
- `stock_events`
- `supplier_payments`
- `shifts`
- `activity_logs`
- `tombstones`

Restaurant local working state:

- `table_orders`

### Migration rules

Existing customer databases must never be deleted to introduce a schema change.

When adding a field:

1. Add it to the `CREATE TABLE IF NOT EXISTS` definition for new installations.
2. Add an idempotent `addColumnIfMissing` migration in [src/database/schema.ts](src/database/schema.ts).
3. Update shared types.
4. Update repository inserts, updates, exports and merge behavior.
5. Verify both a fresh database and an upgraded database.

### Stock ledger

`products.stock` is a cached accumulator. Merge-safe stock truth is represented by immutable `stock_events` deltas.

Tracked items create events for:

- initial stock
- purchases/stock-in
- sales
- sale edits and deletions
- manual adjustments

Restaurant dishes with `trackStock = 0` do not create stock deductions.

---

## Cloud sync and backup

### Mobile Google Drive sync

The native Android app stores one snapshot in Google Drive's hidden `appDataFolder` using the `drive.appdata` scope.

Behavior:

- Local writes schedule a debounced upload after approximately 4 seconds.
- The app checks for remote changes approximately every 20 seconds.
- It also pulls when returning to the foreground.
- Remote data is merged, never blindly used to replace local data.
- Open screens refresh through the sync event bus.

### Safe merge strategy

- Append-only records are unioned by ID.
- Products, users, customers, suppliers and dining-table definitions use `updatedAt` last-write-wins.
- Deletes propagate through tombstones.
- Product stock is recomputed from stock events.
- Customer dues are recomputed from credit transactions.
- Supplier payables are recomputed from purchases minus supplier payments.

See:

- [src/database/backup.ts](src/database/backup.ts)
- [src/utils/drivesync.ts](src/utils/drivesync.ts)
- [src/utils/autosync.ts](src/utils/autosync.ts)

### Manual backup

File backup/restore remains available as an offline fallback. A file restore intentionally replaces the local database, while Drive restore uses the safe merge path.

### Important sync limitations

- `table_orders` (currently open restaurant orders) are intentionally device-local and are not live-merged yet.
- `product_batches.quantityRemaining` is best-effort across devices; total product stock is ledger-derived and is the authoritative value.
- Tombstones are not pruned yet.
- If two legacy devices independently changed the same pre-ledger product before upgrading, align them once using file backup/restore.
- Desktop/browser Google Drive OAuth is not implemented yet; desktop currently uses local OPFS plus manual files.

---

## GST and service-charge calculations

Shared calculations live in [src/utils/tax.ts](src/utils/tax.ts).

The current additive model is:

```text
Base amount     = Subtotal − Discount
Service charge  = Base amount × configured service-charge percentage
Taxable amount  = Base amount + Service charge
GST             = Taxable amount × configured GST percentage
CGST            = GST ÷ 2
SGST            = GST ÷ 2
Grand total     = Taxable amount + GST
```

- GST and service charge are optional.
- Restaurant settings expose both values.
- Retail settings expose GST; service charge remains unused by default.
- Amounts charged are stored on each sale so old invoices do not change when settings change later.
- Editing a sale reuses the original sale's effective rates.

Before marketing the app as fully GST-compliant, obtain review from an Indian CA for per-item GST rates, HSN/SAC, IGST, place of supply, invoice numbering and restaurant-specific tax treatment.

---

## Invoices and exports

Invoices support:

- Store name, address, phone and optional website
- GSTIN
- Customer details
- Line items, quantity and rate
- Discount
- Optional service charge
- CGST and SGST
- Payment method
- Website QR code
- PDF sharing on supported native platforms
- WhatsApp invoice text

Excel exports cover sales, inventory and customers.

The browser build can download files, but browser-native PDF/print behavior still needs final desktop packaging work.

---

## Authentication and permissions

### Roles

- Owner
- Employee

### Owner controls

- Employee PIN and discount limit
- Permission to record stock-in
- Permission to manage suppliers
- Permission to edit past bills
- PIN requirement on/off
- Google-verified PIN recovery

### Security note

PINs currently provide local role separation. A commercial launch should add forced default-PIN replacement and PIN hashing, and should use secure OS token storage for cloud credentials.

---

## Verification before pushing

Run these checks for every product-code change:

```bash
npx tsc --noEmit
npx expo export -p android
```

For restaurant flavor changes also run:

```bash
APP_FLAVOR=restaurant npx expo export -p android --clear
```

On Windows PowerShell:

```powershell
$env:APP_FLAVOR="restaurant"
npx expo export -p android --clear
Remove-Item Env:APP_FLAVOR
```

For web-impacting changes:

```bash
npm run desktop
npm run desktop:restaurant
```

Exercise the affected workflow, not just compilation. High-risk areas include checkout totals, stock movement, credit dues, supplier dues, sale editing, table settlement, backup/restore and cross-device merge.

---

## Known limitations

1. Native Windows installers are not yet built; current desktop delivery is browser/PWA.
2. Desktop-to-mobile Google Drive sync is not yet implemented.
3. Restaurant open-table orders do not sync between devices yet.
4. KOT, kitchen printing/KDS, split bills and table transfers are not yet implemented.
5. iOS has not completed physical-device and TestFlight validation.
6. No subscription/licensing backend or commercial admin dashboard exists yet.
7. No automatic updater for desktop exists yet.
8. Per-item GST/HSN/IGST and statutory invoice sequencing are not implemented.
9. Direct thermal receipt printing needs production implementation and hardware testing.
10. Multi-store/branch tenancy is not implemented.

---

## Launch roadmap

### Phase 1 — production pilot

- Create QuickServe Android OAuth credential and rebuild the restaurant APK
- Package QuickBill and QuickServe with Tauri 2 for Windows
- Add secure desktop Google OAuth and desktop/mobile merge sync
- Redesign open-table orders as merge-safe events
- Add direct thermal receipt printing
- Add restaurant KOT and kitchen printer/display support
- Run simultaneous-device, offline/reconnect and recovery testing
- Pilot with 5–10 businesses

### Phase 2 — public Android and Windows launch

- Business registration, license and subscription backend
- Admin/support dashboard
- Crash/error monitoring with PII redaction
- Privacy policy, terms, refund policy and DPDP processes
- Security review and backup-recovery drills
- Google Play listings and production AABs
- Signed Windows installers and updater
- Onboarding and support documentation

### Phase 3 — iOS

- Apple Developer and App Store Connect setup
- iOS OAuth credentials
- TestFlight builds and physical-device testing
- App Store privacy and review submission

### Phase 4 — scale features

- Multi-store/branches and stock transfer
- Recipe/raw-material inventory
- Kitchen Display System
- Item variants, add-ons and combos
- Split and partial payments
- Multi-language support
- Hardware bundles and distributor partnerships

---

## Team contribution workflow

1. Pull the latest `main`.
2. Create a focused branch:

   ```bash
   git checkout -b feature/short-description
   ```

3. Keep shared logic flavor-neutral where possible.
4. Put flavor decisions behind [src/utils/mode.ts](src/utils/mode.ts).
5. Add safe, idempotent migrations for schema changes.
6. Update backup/merge rules whenever a synced table or column is introduced.
7. Verify retail and restaurant flows if shared code changed.
8. Run TypeScript and Expo export checks.
9. Commit a focused change with an explanatory message.
10. Open a pull request describing:
    - user-visible behavior;
    - schema/data impact;
    - sync impact;
    - verification performed;
    - screenshots for UI changes.

### Review checklist

- Does the app still work offline?
- Could this overwrite or lose customer data?
- Is the database migration safe on an existing install?
- Does it affect both flavors?
- Does it affect merge synchronization?
- Are monetary calculations rounded and stored consistently?
- Are owner-only operations permission-checked?
- Is any secret or credential accidentally included?
- Were both TypeScript and platform exports tested?

---

## Troubleshooting

### Restaurant preview shows the retail app

Use the restaurant command, which also clears Metro's cached flavor:

```bash
npm run desktop:restaurant
```

### Web SQLite does not load

Do not open the HTML file directly. Use:

```bash
npm run desktop
```

The SQLite WASM worker requires the headers supplied by `serve-web.js`.

### New Expo Router route fails TypeScript

Expo Router's generated types may be stale. Start Expo briefly to regenerate `.expo/types/router.d.ts`, stop it, then rerun:

```bash
npx tsc --noEmit
```

### EAS says `Build queued`

The source upload is complete and the build is waiting for an EAS worker. It is safe to close the terminal; monitor the build using the printed Expo URL.

### Google Sign-In fails only in QuickServe

Confirm Google Cloud has an Android OAuth client for:

```text
Package: com.quickbill.resto
SHA-1:   61:81:72:88:CF:CB:CA:57:97:54:42:27:1C:5F:DB:1B:9E:08:B4:AF
```

Also confirm the account is listed as an OAuth test user while the consent screen remains in Testing.

### Google Drive data appears separate between products

This is intentional:

- QuickBill Pro → `quickbill-snapshot.json`
- QuickServe POS → `quickserve-snapshot.json`

---

## Repository

GitHub: **https://github.com/OjasJibhakate/Quickbill-pro**

This repository currently contains proprietary work in progress. Add an explicit license before distributing source code outside the authorized team.
