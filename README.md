# TransiTrack System

TransiTrack is a public bus terminal operations platform for Cebu. It connects **commuters** and **drivers** (mobile apps) with **bus operators**, **terminal managers**, and **system administrators** (Laravel web panels), backed by a shared **MySQL** database.
 
---

## Repository structure

```
TransiTrack System/
├── BusOperator/          # Bus operator web panel + REST API for mobile apps (:8000)
├── TerminalManager/      # North/South terminal manager panel (:8001)
├── SysAdmin/             # System administrator panel (:8002)
└── TansTrack/
    ├── Commuters/        # Commuter Ionic app (:8101)
    ├── transit/          # Bus driver Ionic app (:8100)
    └── ngrok/            # Optional ngrok config for remote/mobile testing
```

---

## Technology versions

Versions below are taken from each app’s `composer.json` / `package.json` at the time of this README.

### Backend (all Laravel panels)

| Package | Version |
|---------|---------|
| PHP | ^8.2 |
| Laravel Framework | ^12.0 |
| Laravel Tinker | ^2.10.1 |
| get-stream/stream-chat (BusOperator, TerminalManager) | ^3.14 |
| PHPUnit (dev) | ^11.5.3 |

### Frontend assets (Laravel Vite)

| Package | BusOperator | TerminalManager | SysAdmin |
|---------|-------------|-----------------|----------|
| Vite | ^7.0.4 | ^7.0.4 | ^7.0.4 |
| Tailwind CSS | ^4.0.0 | ^4.0.0 | ^4.0.0 |
| mapbox-gl | ^3.24.0 | — | — |

### Mobile apps

| Package | Commuters (`TansTrack/Commuters`) | Driver (`TansTrack/transit`) |
|---------|-----------------------------------|------------------------------|
| Angular | ^20.0.0 | ~19.2.15 |
| Ionic Angular | ^8.8.4 | ^8.7.5 |
| Capacitor Core / Android | 7.4.2 | ^7.4.3 |
| mapbox-gl | ^3.23.0 | ^3.13.0 |
| stream-chat (driver app) | — | ^9.44.1 |

### Recommended tooling

| Tool | Notes |
|------|-------|
| Composer | 2.x |
| Node.js | 18+ (20 LTS recommended) |
| npm | 9+ |
| MySQL | 8.x |
| Ionic CLI | 7.x (`npm i -g @ionic/cli`) |
| Android Studio | For `npx cap run android` (optional) |
| ngrok | For exposing localhost to a physical phone |

---

## Ports reference

Run each service in its **own terminal**. Do not reuse the same port.

| Service | Command | URL |
|---------|---------|-----|
| **BusOperator** (API + panel) | `php artisan serve --host=0.0.0.0 --port=8000` | http://localhost:8000 |
| **TerminalManager** | `php artisan serve --host=0.0.0.0 --port=8001` | http://localhost:8001 |
| **SysAdmin** | `php artisan serve --host=0.0.0.0 --port=8002` | http://localhost:8002 |
| BusOperator Vite (assets) | `npm run dev` in `BusOperator/` | http://localhost:3000 |
| SysAdmin Vite (assets) | `npm run dev` in `SysAdmin/` | http://localhost:3001 |
| **Driver app** (transit) | `ionic serve` in `TansTrack/transit/` | http://localhost:8100 |
| **Commuter app** | `ionic serve` in `TansTrack/Commuters/` | http://localhost:8101 |
| ngrok web UI | (automatic when ngrok runs) | http://localhost:4040 |

> **Note:** The driver app proxies `/api/*` to BusOperator on port **8000** via `proxy.conf.js`. The commuter app calls `http://127.0.0.1:8000/api/v1` directly from `environment.ts`.

---

## Prerequisites

1. **PHP 8.2+** with extensions: `mbstring`, `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`
2. **Composer** — https://getcomposer.org
3. **Node.js 18+** and **npm**
4. **MySQL 8** — create an empty database (example name: `transitrack`)
5. **Ionic CLI** — `npm install -g @ionic/cli`
6. *(Optional)* **Android Studio** + JDK 17 for native Android builds
7. *(Optional)* **ngrok** account — https://ngrok.com

---

## Database setup (MySQL)

All three Laravel apps share **one MySQL database**. Use the same `DB_*` values in each `.env`.

### 1. Create the database

```sql
CREATE DATABASE transitrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configure each Laravel app

For **BusOperator**, **TerminalManager**, and **SysAdmin**:

```bash
cd BusOperator          # repeat for TerminalManager and SysAdmin
cp .env.example .env
composer install
npm install
php artisan key:generate
```

Edit `.env` in each app:

```dotenv
APP_URL=http://localhost:8000    # use :8001 for TerminalManager, :8002 for SysAdmin

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=transitrack
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
```

### 3. Run migrations and seeders (order matters)

**BusOperator** owns most tables and sample data:

```bash
cd BusOperator
php artisan migrate
php artisan db:seed
```

**TerminalManager** adds terminal-space tables and sample occupancy:

```bash
cd TerminalManager
php artisan migrate
php artisan db:seed
```

**SysAdmin** ensures the sysadmin login exists:

```bash
cd SysAdmin
php artisan migrate
php artisan db:seed
```

### Seeded demo accounts

| Role | Email | Password | Source |
|------|-------|----------|--------|
| Bus operator / admin user | `admin@example.com` | `password` | BusOperator `UserSeeder` |
| Driver | `driver@example.com` | `password` | BusOperator `UserSeeder` |
| Driver | `mike@example.com` | `password` | BusOperator `UserSeeder` |
| Sysadmin (BusOperator seeder) | `admin@email.com` | `sysadmin` | BusOperator `SysadminSeeder` |
| Sysadmin (SysAdmin seeder) | `admin@transitrack.com` | `12345678` | SysAdmin `DatabaseSeeder` |

Terminal manager accounts are created through the **TerminalManager registration page** (no default seeder login).

Bus operator accounts can also be registered at `http://localhost:8000/register`.

---

## Environment variables (third-party services)

Copy values from your own dashboards. **Do not commit real secrets to git.**

### BusOperator (`.env`)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | `http://localhost:8000` |
| `STREAM_API_KEY` | GetStream Chat — https://getstream.io |
| `STREAM_API_SECRET` | GetStream Chat server secret |
| `MAYA_PUBLIC_KEY` | PayMaya / Maya sandbox public key — https://developers.maya.ph |
| `MAYA_SECRET_KEY` | Maya sandbox secret key |
| `MAYA_BASE_URL` | `https://pg-sandbox.paymaya.com` (default) |
| `MAYA_CALLBACK_URL` | Usually `${APP_URL}` or your ngrok URL |
| `MAYA_DEV_MOCK` | `true` to skip real payments in development |
| `BUS_OPERATOR_URL` | `http://localhost:8000` |
| `TERMINAL_MANAGER_URL` | `http://localhost:8001` |
| `MAPBOX_TOKEN` | *(optional)* Mapbox public token for route-stop editing / seeding |

### TerminalManager (`.env`)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | `http://localhost:8001` |
| `STREAM_API_KEY` | Same Stream app as BusOperator |
| `STREAM_API_SECRET` | Same Stream app as BusOperator |
| `BUS_OPERATOR_URL` | `http://localhost:8000` |
| `TERMINAL_MANAGER_URL` | `http://localhost:8001` |
| `MAPBOX_TOKEN` | Mapbox token for terminal maps |

### SysAdmin (`.env`)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | `http://localhost:8002` |
| `MAPBOX_TOKEN` | *(optional)* Mapbox token for route management maps |

### Mobile apps (`src/environments/environment.ts`)

| App | Key | Purpose |
|-----|-----|---------|
| **Commuters** | `apiUrl` | `http://127.0.0.1:8000/api/v1` (or ngrok / LAN IP) |
| **Commuters** | `mapbox.accessToken` | Mapbox public token |
| **Commuters** | `payment.stripe.publicKey` | Payment public key (Maya/Stripe test key) |
| **transit (driver)** | `apiUrl` | `/api/v1` when using `ionic serve` (proxied to :8000) |
| **transit (driver)** | `mapbox.accessToken` | Mapbox public token |
| **transit (driver)** | `messaging.streamApiKey` | GetStream **public** API key (matches backend Stream app) |

For **production / phone builds**, update `environment.prod.ts` in each app with your LAN IP or ngrok URL before `ionic build`.

---

## Running the web panels

Open **six terminals** for full local development (three PHP servers + two Vite dev servers + one optional queue worker).

```bash
# Terminal 1 — BusOperator API + panel
cd BusOperator
php artisan serve --host=0.0.0.0 --port=8000

# Terminal 2 — BusOperator frontend assets
cd BusOperator
npm run dev

# Terminal 3 — TerminalManager
cd TerminalManager
php artisan serve --host=0.0.0.0 --port=8001

# Terminal 4 — SysAdmin
cd SysAdmin
php artisan serve --host=0.0.0.0 --port=8002

# Terminal 5 — SysAdmin frontend assets
cd SysAdmin
npm run dev
```

| Panel | URL |
|-------|-----|
| Bus Operator | http://localhost:8000 |
| Terminal Manager | http://localhost:8001 |
| SysAdmin | http://localhost:8002 |

---

## Running the mobile apps (browser)

```bash
# Driver app — http://localhost:8100
cd TansTrack/transit
npm install
ionic serve

# Commuter app — http://localhost:8101
cd TansTrack/Commuters
npm install
ionic serve
```

The driver dev server proxies API calls to BusOperator on port **8000**. Start BusOperator **before** testing the driver app.

---

## Android build (physical device or emulator)

From either mobile app directory:

```bash
npm install
ionic build
npx cap sync android
npx cap run android
# or open in Android Studio:
npx cap open android
```

Before building, set `apiUrl` in `environment.prod.ts` to a reachable backend address (your PC’s LAN IP, e.g. `http://192.168.x.x:8000/api/v1`, or an ngrok HTTPS URL).

---

## ngrok (remote / phone testing)

When a phone cannot reach `localhost`, expose BusOperator (and optionally the Ionic dev server) with ngrok.

1. Install ngrok and add your auth token:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
2. Start BusOperator on port 8000, then tunnel it:
   ```bash
   ngrok http 8000
   ```
3. Copy the **Forwarding** HTTPS URL (e.g. `https://xxxx.ngrok-free.app`).
4. Update mobile `environment.prod.ts` / `environment.ts`:
   ```ts
   apiUrl: 'https://xxxx.ngrok-free.app/api/v1'
   ```
5. Rebuild or restart `ionic serve`.

See `TansTrack/ngrok/README.md` for multi-tunnel config. **Never commit your real ngrok auth token.**

---

## Quick start (minimal smoke test)

1. Create MySQL database `transitrack`.
2. `cd BusOperator` → `composer install` → `npm install` → configure `.env` → `php artisan migrate --seed`.
3. `php artisan serve --port=8000`
4. Log in at http://localhost:8000 with `admin@example.com` / `password`.
5. `cd TansTrack/transit` → `npm install` → `ionic serve` → open http://localhost:8100.
6. Log in as driver `driver@example.com` / `password`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `SQLSTATE[HY000] [1049] Unknown database` | Create `transitrack` in MySQL and set `DB_DATABASE` in all three `.env` files. |
| Vite assets missing / blank CSS | Run `npm run dev` in the Laravel app folder (BusOperator :3000, SysAdmin :3001). |
| Mobile app cannot reach API | Use LAN IP or ngrok instead of `127.0.0.1` on a physical phone. |
| CORS errors (Commuters) | BusOperator `config/cors.php` allows Ionic origins; ensure `apiUrl` points to the correct host. |
| Chat not working | Set matching `STREAM_API_KEY` / `STREAM_API_SECRET` in BusOperator and TerminalManager `.env`. |
| Payments fail | Use Maya sandbox keys or set `MAYA_DEV_MOCK=true` in BusOperator `.env`. |
| Map not loading | Set Mapbox token in `.env` (panels) or `environment.ts` (mobile). |

---

## License

See individual `composer.json` / `package.json` files for open-source dependency licenses.
