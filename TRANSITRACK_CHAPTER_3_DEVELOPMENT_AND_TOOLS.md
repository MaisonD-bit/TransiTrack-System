# Chapter III — Software Development and Testing  
## TransiTrack System

This document drafts **Chapter 3** material aligned with the capstone sample (*Capstone Sample.pdf*, approximately pages 79–85): **Software Development and Testing** (chapter introduction and testing stance) and **Development Frameworks and Tools** (technical stack through project management tools). **Development Process** (e.g., database setup, detailed lifecycle steps) is intentionally omitted here for a later pass, per your plan.

---

## Software Development and Testing

This chapter describes how the researchers developed and tested **TransiTrack**, a multi-role transit system for **bus operators**, **terminal managers**, **system administrators**, **drivers**, and **commuters**. The work relied on **separate applications**, a **shared MySQL database** as the single source of truth, and **incremental delivery** so scheduling, ticketing, and terminal features could grow without destabilizing unrelated modules.

**Black-box testing** was used at the feature level: each role’s flows were run through the web and mobile UIs against documented requirements, without depending on internal code detail. Typical scenarios included operator scheduling, terminal route-stop configuration and approval handoffs, driver trip acceptance, commuter ticketing and QR validation, and map-based views. **API checks** (HTTP status, JSON payloads, and access control) and **regression passes** after Mapbox and chat integration complemented UI tests to judge **usability**, **data consistency**, **performance**, and **overall quality** before demonstration and defense.

*(The following section mirrors the sample’s “Development Frameworks and Tools” block, adapted to the **TransiTrack System** repository at `TransiTrack System/` on the development workstation.)*

---

## Development Frameworks and Tools

### Technical Stack Overview

TransiTrack’s technical stack combines **PHP** with **Laravel** for the bus operator, terminal manager, and system administrator **web applications** and their companion **HTTP APIs**, with **MySQL** providing relational storage for users, schedules, ticketing, and related operational data, alongside **Blade**-templated dashboards and client-side assets built through the project’s **Node**-based tooling chain. **Ionic** with **Angular** drives **cross-platform mobile** development for commuters and drivers, using **Capacitor** for Android packaging and device services. The project integrates **Mapbox** for location-aware maps and **Stream Chat** for real-time operational messaging. Development is supported by **Visual Studio Code** and **Android Studio**, **Git** for version control, **Composer** and **npm** for package management, and each framework’s usual test and developer tooling, yielding an integrated ecosystem for building, testing, and maintaining the system.

### Laravel and PHP — Web Backends and APIs

The researchers employed **Laravel** for the **Bus Operator** web panel, **Terminal Manager** web application, and **SysAdmin** console. Laravel provides routing, middleware, validation, ORM-based persistence, file storage (e.g., profile and document uploads on the public disk), and a structured **MVC** layout that keeps controllers, policies, and views maintainable across large feature sets such as schedules, buses, drivers, route approvals, notifications, and terminal bay management. **PHP** serves as the implementation language for all server-side business rules and integration endpoints consumed by the mobile apps.

### Angular, Ionic, and Capacitor — Mobile Development

The **Commuters** and **transit (driver)** projects use **Angular** with the **Ionic** UI toolkit to obtain a component library tuned for touch-first workflows (tabs, modals, lists, and navigation patterns suited to ticketing, maps, and trip status). **Capacitor** bridges the web runtime to native features such as camera, filesystem, haptics, keyboard, and status bar behavior where required for production builds. **TypeScript** enforces typed contracts across services and components, reducing defects when calling Laravel APIs.

### Blade, Vite, and Tailwind — Web Panel Front Ends

For Laravel-based panels, **Blade** composes HTML with server-side data binding, while **Vite** supplies fast local bundling and optimized production builds. **Tailwind CSS** (integrated through the Vite pipeline in the Bus Operator and Terminal Manager `package.json` configurations) accelerates consistent spacing, typography, and responsive layout without maintaining large custom stylesheets.

### Data and State on the Client

Within the Ionic/Angular applications, **Angular services** and **RxJS** observables carry application state and HTTP results through a predictable pipeline: components subscribe to streams for routes, tickets, and user sessions, and update the UI when asynchronous operations complete. On Laravel panels, **session-backed authentication** and **flash messaging** complement minimal JavaScript for tables, filters, and modals, keeping authoritative state on the server while still allowing interactive panels (for example, live tracking and chat clients).

### MySQL — Relational Data Store

**MySQL** holds normalized entities for users, roles, terminals, buses, drivers, schedules, tickets, approvals, and related operational records. Migrations under each Laravel app document schema evolution and support repeatable deployments across development and demonstration environments.

### Mapbox and Location-Aware Features

**Mapbox** (via `mapbox-gl` and related usage in the Angular apps and selected Laravel panels) supports map rendering, markers, and route geometry for commuter and operator-facing maps, terminal route-stop editing, and live or recent-position visualization. Map assets and API keys are configured per environment (`environment.ts` / production counterparts and server configuration) so that development keys are not committed to public builds without care.

#### Integration example — Terminal Manager (route-stop editor)

Credentials are registered in Laravel’s service configuration and read from the environment (`MAPBOX_TOKEN`). The route-stop edit view exposes the token to the browser, and the Vite-bundled script sets `mapboxgl.accessToken` and instantiates a `mapboxgl.Map` for placing stops along operator routes.

```36:38:TerminalManager/config/services.php
    'mapbox' => [
        'token' => env('MAPBOX_TOKEN'),
    ],
```

```137:140:TerminalManager/resources/views/operations/route-stops-edit.blade.php
<script>
    window.TM_MAPBOX_TOKEN = @json(config('services.mapbox.token', env('MAPBOX_TOKEN', 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA')));
</script>
@vite(['resources/js/terminal-route-stops.js'])
```

```6:7:TerminalManager/resources/js/terminal-route-stops.js
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
```

```200:205:TerminalManager/resources/js/terminal-route-stops.js
function initTerminalStopMaps() {
    const token = typeof window !== 'undefined' ? window.TM_MAPBOX_TOKEN || '' : '';
    if (!token) {
        console.warn('TM_MAPBOX_TOKEN missing — set MAPBOX_TOKEN in .env');
    }
    mapboxgl.accessToken = token || 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';
```

```258:282:TerminalManager/resources/js/terminal-route-stops.js
        if (!mapEl || typeof mapboxgl === 'undefined') return;

        const term = TERMINALS[terminalKey] || TERMINALS.north;

        let map;
        try {
            map = new mapboxgl.Map({
                container: mapEl,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: term.coordinates,
                zoom: 11,
            });
        } catch (err) {
            console.error('Mapbox Map()', err);
            const w = card.querySelector('[data-tm-map-warning]');
            if (w) {
                w.textContent =
                    'Could not start the map (' +
                    (err && err.message ? err.message : 'unknown error') +
                    '). Try another browser or disable strict blocking for api.mapbox.com.';
                w.classList.remove('d-none');
            }
            return;
        }
        map.addControl(new mapboxgl.NavigationControl());
```

*(Prefer setting `MAPBOX_TOKEN` only in `.env` and avoid shipping a default public token in thesis screenshots or public builds.)*

### Stream Chat — Real-Time Messaging

Where integrated (**get-stream/stream-chat** in Composer for Bus Operator and Terminal Manager), **Stream** powers channel-based chat: operators and terminal managers can exchange operational messages and attachments through a dedicated UI embedded in the Laravel layout. When the service is unavailable, the Blade views surface a controlled warning so the rest of the panel remains usable.

#### Integration example — Terminal Manager (server token + browser client)

The **PHP SDK** constructs a server-side client when API credentials exist; the chat action **upserts** the signed-in manager and issues a **user token** for the JavaScript SDK. The Blade view loads Stream’s browser bundle, then connects with that token.

```31:34:TerminalManager/config/services.php
    'stream_chat' => [
        'api_key' => env('STREAM_API_KEY'),
        'api_secret' => env('STREAM_API_SECRET'),
    ],
```

```19:26:TerminalManager/app/Http/Controllers/ChatController.php
    public function __construct()
    {
        $apiKey = (string) config('services.stream_chat.api_key', '');
        $apiSecret = (string) config('services.stream_chat.api_secret', '');

        if ($apiKey === '' || $apiSecret === '') {
            return;
        }
```

```133:173:TerminalManager/app/Http/Controllers/ChatController.php
    public function index()
    {
        /** @var User $user */
        $user = Auth::user();

        $streamApiKey = (string) config('services.stream_chat.api_key', '');
        $streamToken = '';
        $streamUnavailable = false;

        if (! $this->streamClient || $streamApiKey === '') {
            $streamUnavailable = true;
        } else {
            try {
                $this->streamClient->upsertUser($user->getStreamUserData());
                $streamToken = $user->getStreamToken();
            } catch (\Throwable $e) {
                Log::warning('Stream chat upsert failed in Terminal Manager ChatController@index', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                try {
                    $streamToken = $user->getStreamToken();
                } catch (\Throwable $tokenError) {
                    Log::error('Stream token generation failed (Terminal Manager)', [
                        'user_id' => $user->id,
                        'error' => $tokenError->getMessage(),
                    ]);
                    $streamUnavailable = true;
                }
            }
        }

        return view('operations.chat', [
            'streamApiKey' => $streamApiKey,
            'streamToken' => $streamToken,
            'userId' => $user->streamUserId(),
            'userName' => $user->name,
            'streamUnavailable' => $streamUnavailable,
        ]);
    }
```

```281:290:TerminalManager/resources/views/operations/chat.blade.php
<script src="https://cdn.jsdelivr.net/npm/stream-chat@8"></script>
<script>
    const {
        StreamChat
    } = window;
    const apiKey = '{{ $streamApiKey }}';
    const userId = '{{ $userId }}';
    const userToken = '{{ $streamToken }}';
    const userName = '{{ $userName }}';
    const streamUnavailable = @json($streamUnavailable ?? false);
```

```420:432:TerminalManager/resources/views/operations/chat.blade.php
    async function initChat() {
        try {
            chatClient = StreamChat.getInstance(apiKey);

            await chatClient.connectUser({
                    id: userId,
                    name: userName,
                },
                userToken
            );

            console.log('Connected to Stream Chat');
```

*(The Blade view continues with channel loading, message UI, and attachment helpers against `chatClient` and `currentChannel`.)*

### Development IDEs and Environments

**Visual Studio Code** served as the primary cross-platform editor: lightweight startup, strong **PHP**, **Blade**, **JavaScript**, and **TypeScript** support through extensions, integrated terminals for `php artisan`, `composer`, and `npm`/`vite` scripts, and optional debugging adapters for Laravel and Angular. **Android Studio** complemented mobile work with the **Android emulator**, SDK and platform tools, and **Gradle** integration aligned with **Capacitor** Android projects in the Ionic apps, improving device testing and release builds beyond browser-only previews.

Local **PHP** (matching the Laravel requirement), **Composer**, **Node.js**, **npm**, and a running **MySQL** instance formed the everyday runtime on developer machines; **Git** repositories were opened side by side for `BusOperator`, `TerminalManager`, `SysAdmin`, and `TansTrack` so configuration (including `.env` files with Mapbox and Stream keys) stayed consistent with the shared database assumption used in integration testing.

### Operating Systems

Development and builds were carried out on **Microsoft Windows** (Windows 10/11), selected for compatibility with PHP, Node.js, Laravel Vite, Android tooling, and the team’s existing workflows. The stack remains portable to macOS or Linux for contributors who prefer Unix-like environments, provided the same PHP, Composer, Node, and MySQL versions are satisfied.

### Project Management Tools

To support coordination, documentation, and quality tracking, the researchers used:

- **Google Docs** — Shared narrative for chapters, meeting notes, and requirement refinements with revision history and comments.  
- **Google Sheets** — Task lists, milestone tracking, and lightweight defect logs during integration testing.  
- **Git** / **GitHub** (or equivalent remote) — Version control, branching per feature, pull requests for review, and reproducible history across BusOperator, TerminalManager, SysAdmin, and TansTrack subprojects.  
- **Figma** (or similar) — UI mock-ups and flow validation for operator panels and mobile screens before implementation, reducing rework on navigation and critical forms.

---

## Note for Later Integration

The sample’s **Development Process** material (from about page 86 onward) is drafted for TransiTrack in **`TRANSITRACK_CHAPTER_3_DEVELOPMENT_PROCESS.md`** (database, Laravel logic, notifications, location, mobile behavior, and a mapping table from the WanderGuard sample). The **Testing Process** and **test-case tables** (sample pages **100–105**) are in **`TRANSITRACK_CHAPTER_3_TESTING_PROCESS.md`**. Add **figures** (ERD, workflows) and **environment and deployment** checklists in your main Chapter 3 as needed.

---

*Prepared for: **TransiTrack System** (`c:\Users\User\Desktop\TransiTrack System\`). Structure referenced from **Capstone Sample.pdf** (WanderGuard), pages 79–85, adapted to the project’s Laravel, Ionic/Angular, MySQL, Mapbox, and Stream Chat stack.*
