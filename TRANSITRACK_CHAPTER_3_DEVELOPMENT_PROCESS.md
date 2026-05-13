# Chapter III (continued) — Development Process and Testing Process  
## TransiTrack System

The implementation described in this chapter is located in the project workspace **`c:\Users\User\Desktop\TransiTrack System\`**, comprising the **BusOperator**, **TerminalManager**, and **SysAdmin** Laravel applications and the **TansTrack** Ionic/Angular projects (**Commuters** and **transit** driver app). The system’s authoritative data and business rules are implemented with **Laravel and MySQL**; integrations such as **Mapbox** (mapping) and **Stream Chat** (operational messaging) are used where documented in configuration and code.

---

## DEVELOPMENT PROCESS

In this section, both the **project development** and **testing** processes are discussed and explained thoroughly so that readers understand, at a deeper level, how the TransiTrack applications behave from persistence through the user interface. The narrative follows the same progression used in the reference capstone manuscript (approximately **pages 86–100**): persistence layer, server-side behavior, notifications and messaging, location and mapping, spatial and workflow logic, high-visibility alerts, coordination features, navigation-related map behavior, routine operational modules (schedules and ticketing), then an introduction to the **testing process** that begins on **page 100** of the sample.

### Database

The researchers used the **MySQL** relational database for backend development, accessed through **Laravel** with **migrations** and **Eloquent** (or the query builder) as appropriate. MySQL stores normalized rows for **users** (operators, terminal managers, drivers, commuters, administrators), **routes** and **stops**, **route approval requests**, **buses**, **drivers**, **schedules**, **tickets**, **payments**, **notifications**, **messages**, **terminal spaces** and related occupancy history, and auxiliary structures such as **sessions** and **queued jobs**. This design keeps transactional data in one engine so that web panels and mobile clients read a **consistent** state under concurrency controlled by the database and application transactions.

**Figure __: Relational schema overview (MySQL / ERD)**  
*(Insert your ERD or consolidated schema diagram exported from MySQL Workbench, dbdiagram.io, or your documentation.)*

**Figure __: Laravel migration excerpt — `schedules` table creation**  
The following excerpt illustrates how core trip records are declared in PHP migration classes under the BusOperator application; executing `php artisan migrate` applies the definition to MySQL.

```14:31:BusOperator/database/migrations/2025_07_24_094799_create_schedules_table.php
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); //   Critical
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->foreignId('route_id')->constrained()->onDelete('cascade');
            $table->foreignId('driver_id')->constrained('drivers')->onDelete('cascade');
            $table->foreignId('bus_id')->constrained()->onDelete('cascade');
            $table->enum('status', ['scheduled','accepted','active','completed','declined','cancelled'])->default('scheduled');
            $table->decimal('fare_regular', 8, 2)->nullable();
            $table->decimal('fare_aircon', 8, 2)->nullable();
            $table->integer('time_limit')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\database\migrations\2025_07_24_094799_create_schedules_table.php`

**Figure __: Laravel migration excerpt — live coordinates on `schedules`**  
Additional columns allow the driver device to persist the latest latitude and longitude for operator live tracking.

```11:14:BusOperator/database/migrations/2026_05_07_000001_add_current_position_to_schedules_table.php
        Schema::table('schedules', function (Blueprint $table) {
            $table->decimal('current_lat', 10, 7)->nullable()->after('started_at');
            $table->decimal('current_lng', 10, 7)->nullable()->after('current_lat');
        });
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\database\migrations\2026_05_07_000001_add_current_position_to_schedules_table.php`

---

### Laravel backend and API layer

The **Laravel** framework powers the Bus Operator, Terminal Manager, and SysAdmin web applications and exposes **HTTP APIs** consumed by the Ionic/Angular mobile clients. **Routes** in `routes/web.php` and `routes/api.php` map URLs to **controllers**; **middleware** enforces authentication (including **Sanctum** where configured for token-based API access), **CORS**, and role checks; **validation** ensures request payloads are safe before persistence. Long-running or deferrable work may be placed on the **queue** backed by the `jobs` table, but most user-visible actions complete inside a standard request–response cycle, which simplifies reasoning about state changes for schedules, tickets, and approvals.

**Figure __: Code snippet of schedule and driver GPS API route registration**  
The excerpt below groups schedule endpoints used by mobile clients: listing active trips for commuters, CRUD-style schedule access for authorized callers, and driver lifecycle actions including **position updates**.

```53:69:BusOperator/routes/api.php
    // Schedule management routes for mobile app
    Route::prefix('schedules')->group(function () {
        // Public route - no auth required for commuters to see active buses
        Route::get('/active', [ScheduleController::class, 'getActiveSchedules'])->withoutMiddleware(['auth:sanctum']);
        
        // Get all schedules (admin view)
        Route::get('/', [ScheduleController::class, 'index']);
        
        // Get specific schedule
        Route::get('/{id}', [ScheduleController::class, 'show']);
        
        // Schedule actions for drivers
        Route::put('/{id}/accept', [ScheduleController::class, 'acceptSchedule']);
        Route::put('/{id}/decline', [ScheduleController::class, 'declineSchedule']);
        Route::put('/{id}/start', [ScheduleController::class, 'startSchedule']);
        Route::put('/{id}/complete', [ScheduleController::class, 'completeSchedule']);
        Route::put('/{id}/update-position', [ScheduleController::class, 'updatePosition']);
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\api.php`

**Figure __: Code snippet of persisting driver GPS coordinates**  
The `updatePosition` method validates latitude and longitude, assigns them to the active schedule row, and saves to MySQL so dashboards can render recent vehicle positions.

```887:898:BusOperator/app/Http/Controllers/ScheduleController.php
    public function updatePosition(Request $request, $id): JsonResponse
    {
        $schedule = Schedule::findOrFail($id);
        $data = $request->validate([
            'latitude'  => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);
        $schedule->current_lat = $data['latitude'];
        $schedule->current_lng = $data['longitude'];
        $schedule->save();
        return response()->json(['success' => true]);
    }
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\ScheduleController.php`

---

### Notifications and system alerts

TransiTrack delivers operational awareness through **records stored in MySQL** and **HTTP JSON** APIs consumed by the operator web panel and driver mobile client. Notification types include routine informational posts and **higher-salience** items such as **driver incident** reports that may carry location context for map display. Read state is tracked so operators can distinguish new versus acknowledged items. This approach keeps notification history auditable alongside schedules and tickets without introducing a second document-centric datastore for core alerts.

**Figure __: Code snippet of `notifications` table migration**  
The migration defines message text, categorization, optional links to users, drivers, schedules, and buses, and read timestamps.

```11:22:BusOperator/database/migrations/2026_01_10_143753_create_notifications_table.php
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // e.g., 'emergency', 'issue_report', 'schedule_update', 'inspection_required'
            $table->text('message');
            $table->foreignId('sender_id')->nullable()->constrained('users')->onDelete('set null'); // Operator ID
            $table->foreignId('recipient_id')->nullable()->constrained('users')->onDelete('set null'); // Driver ID (if direct message)
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->onDelete('set null'); // Driver ID (if related to driver)
            $table->foreignId('schedule_id')->nullable()->constrained('schedules')->onDelete('set null'); // Schedule ID (if related to schedule)
            $table->foreignId('bus_id')->nullable()->constrained('buses')->onDelete('set null'); // Bus ID (if related to bus)
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\database\migrations\2026_01_10_143753_create_notifications_table.php`

**Figure __: Code snippet of notification API route registration**  
Driver and operator endpoints for listing, clearing, sending, incident reporting, and read receipts are grouped under a `notifications` prefix.

```91:100:BusOperator/routes/api.php
    Route::prefix('notifications')->group(function () {
        Route::get('/driver/{driverId}', [NotificationsController::class, 'getForDriver']);
        Route::delete('/driver/{driverId}/clear', [NotificationsController::class, 'clearForDriver']);
        Route::delete('/{id}', [NotificationsController::class, 'deleteOne']);
        Route::post('/driver-send', [NotificationsController::class, 'sendFromDriver']);
        Route::post('/incident', [NotificationsController::class, 'reportIncident']);
        Route::post('/operator-send', [NotificationsController::class, 'sendToDriver'])
            ->middleware(['web', 'auth']);
        Route::patch('/{id}/read', [NotificationsController::class, 'markNotificationAsRead']);
    });
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\api.php`  
**Related logic:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\NotificationsController.php`

---

### Stream Chat service

**Stream Chat** provides channel-based messaging between operational roles (for example bus operators and terminal managers). Laravel loads **API key** and **secret** from environment-backed configuration, initializes the official **PHP SDK** on the server, **upserts** user profiles, and issues **user tokens** for the browser client. The Blade-based chat view loads Stream’s JavaScript SDK, connects with the token, and lists channels and messages. When credentials are absent, the UI degrades gracefully so other terminal functions remain usable.

**Stream Chat configuration**  
Credentials are mapped in `config/services.php` from `.env` entries such as `STREAM_API_KEY` and `STREAM_API_SECRET`. The excerpt below shows how the Terminal Manager controller constructor short-circuits when keys are missing.

**Figure __: Code snippet of Stream Chat server client initialization**

```19:26:TerminalManager/app/Http/Controllers/ChatController.php
    public function __construct()
    {
        $apiKey = (string) config('services.stream_chat.api_key', '');
        $apiSecret = (string) config('services.stream_chat.api_secret', '');

        if ($apiKey === '' || $apiSecret === '') {
            return;
        }
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\TerminalManager\app\Http\Controllers\ChatController.php`  
**Configuration:** `c:\Users\User\Desktop\TransiTrack System\TerminalManager\config\services.php`  
**Client UI:** `c:\Users\User\Desktop\TransiTrack System\TerminalManager\resources\views\operations\chat.blade.php`

---

### Real-time location tracking

Real-time location tracking functions as a core component of TransiTrack, supporting dispatch oversight and passenger-facing map experiences. The **driver** application sends GPS updates through the **`update-position`** API; the **operator** dashboard queries recent coordinates to plot vehicles. **Mapbox** supplies map tiles and interactive layers in both web panels (for example terminal **route-stop** editing) and mobile `environment` configuration for commuter and driver builds.

**Figure __: Code snippet of Mapbox access token hand-off to the terminal route-stop editor**

```137:140:TerminalManager/resources/views/operations/route-stops-edit.blade.php
<script>
    window.TM_MAPBOX_TOKEN = @json(config('services.mapbox.token', env('MAPBOX_TOKEN', 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA')));
</script>
@vite(['resources/js/terminal-route-stops.js'])
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\TerminalManager\resources\views\operations\route-stops-edit.blade.php`  
**Map logic:** `c:\Users\User\Desktop\TransiTrack System\TerminalManager\resources\js\terminal-route-stops.js`  
*(In the bound thesis, redact literal tokens; cite only `MAPBOX_TOKEN` in `.env`.)*

The combination of **MySQL persistence** for coordinates and **Mapbox** rendering enables operators to interpret fleet movement and enables terminal staff to align **stop geometry** with approved pathways.

---

### Recurring location updates and dashboard freshness

The driver client is expected to transmit coordinates **while a trip is active** so that operator views remain current. On the server, schedules retain the most recent `current_lat` and `current_lng`; the operator **Live Tracking** page may poll or refresh on an interval to match classroom or field-demo hardware constraints. This mirrors the intent of the sample’s background-service narrative—**continuous currency of location for supervision**—implemented here with **HTTP writes** to MySQL rather than a separate proprietary sync engine.

**Figure __: Code snippet of driver GPS persistence**  
*(Same excerpt as in the Laravel API section; may be reused as Figure __ if captions are consolidated.)*

```887:898:BusOperator/app/Http/Controllers/ScheduleController.php
    public function updatePosition(Request $request, $id): JsonResponse
    {
        $schedule = Schedule::findOrFail($id);
        $data = $request->validate([
            'latitude'  => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);
        $schedule->current_lat = $data['latitude'];
        $schedule->current_lng = $data['longitude'];
        $schedule->save();
        return response()->json(['success' => true]);
    }
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\ScheduleController.php`

---

### Route geometry, terminal stops, and spatial management

Terminal managers place **ordered bus stops** along operator-submitted routes using an interactive **Mapbox** map; stop names and ETA-style metadata are edited in tabular form and saved as structured configuration for each submission. **Terminal parking** views represent bay occupancy and support operational actions (for example occupy, release, extension requests) tied to schedules. Together, these mechanisms encode **spatial rules** of the transit domain—where vehicles may board, which sequence stops follow, and how terminal capacity is used—analogous in documentation structure to the sample’s extended **dynamic geofencing** subsection, but grounded in **route and terminal** semantics rather than caregiver safe zones.

**Source files (illustrative):**  
`c:\Users\User\Desktop\TransiTrack System\TerminalManager\app\Http\Controllers\TerminalRouteStopsController.php`  
`c:\Users\User\Desktop\TransiTrack System\TerminalManager\resources\views\operations\route-stops.blade.php`  
`c:\Users\User\Desktop\TransiTrack System\TerminalManager\resources\views\operations\route-stops-edit.blade.php`

---

### High-priority operational notifications

High-priority notifications ensure that operators remain informed of **incidents**, **approval outcomes**, and other time-sensitive operational events. Because the canonical record lives in **MySQL**, the web panel can render rich cards—including embedded maps when latitude and longitude are present—without waiting on a separate message bus for historical truth. Mobile clients retrieve driver-facing copies through the **notifications** API. The design prioritizes **traceability** and **consistent ordering** with other transactional tables.

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\NotificationsController.php`

---

### Operator–terminal coordination (route approval workflow)

The bus operator submits selected routes for a **North** or **South** terminal; the record enters **`pending_stops`** until the terminal manager completes stop entry and the workflow advances toward administrator approval. The excerpt below shows validation, ownership checks, and insertion of a **`route_approval_requests`** row.

**Figure __: Code snippet of operator route submission for terminal processing**

```30:60:BusOperator/app/Http/Controllers/RouteApprovalWebController.php
    public function store(Request $request)
    {
        $user = Auth::user();
        $userId = $user->id;

        $terminal = $user->terminal;
        if (! in_array($terminal, ['north', 'south'], true)) {
            return back()->withErrors([
                'terminal' => 'Your profile has no terminal assigned (North or South). Contact your administrator before submitting routes.',
            ]);
        }

        $data = $request->validate([
            'route_ids' => ['required', 'array', 'min:1'],
            'route_ids.*' => ['integer', 'exists:routes,id'],
        ]);

        foreach ($data['route_ids'] as $rid) {
            $owns = Route::query()->where('id', $rid)->where('user_id', $userId)->exists();
            if (! $owns) {
                return back()->withErrors(['route_ids' => 'Invalid route selection.'])->withInput();
            }
        }

        RouteApprovalRequest::create([
            'operator_user_id' => $userId,
            'terminal' => $terminal,
            'route_ids' => array_values(array_unique($data['route_ids'])),
            'status' => 'pending_stops',
            'submitted_by_operator_at' => now(),
        ]);
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\RouteApprovalWebController.php`

---

### Dynamic path generation and map-assisted navigation

Map-assisted navigation improves clarity for commuters and drivers: approved polylines, stop markers, and contextual Mapbox layers support **fare preview**, **boarding**, and **live bus** views. The commuter API exposes approved routes, live buses, fare helpers, and booking endpoints so the Angular client can request geometry and pricing before committing a purchase.

**Figure __: Code snippet of commuter fare and ticketing API registration**

```104:111:BusOperator/routes/api.php
    // Commuter: approved routes with terminal bus stops + fare preview (no auth)
    Route::get('commuter/approved-routes', [CommuterRoutesController::class, 'approvedRoutes']);
    Route::get('commuter/live-buses', [CommuterRoutesController::class, 'liveBuses']);
    Route::post('commuter/fare-preview', [CommuterRoutesController::class, 'farePreview']);
    Route::post('commuter/fare-segment', [CommuterRoutesController::class, 'fareSegment']);
    Route::post('commuter/fare-calculate', [CommuterRoutesController::class, 'fareCalculate']);
    Route::post('commuter/book-ticket', [CommuterRoutesController::class, 'bookTicket']);
    Route::post('commuter/alight', [CommuterRoutesController::class, 'alight']);
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\api.php`  
**Controller:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\CommuterRoutesController.php`

---

### Schedule and dispatch management

Schedules bind **drivers**, **buses**, and **routes** to calendar slots and fares; lifecycle transitions (`scheduled` through `completed` or `declined` / `cancelled`) govern what appears in operator tables and driver task lists. Web panels and APIs share the same underlying rows, which prevents divergence between what the dispatcher sees and what the driver app queries.

**Source file:** `c:\Users\User\Desktop\TransiTrack System\BusOperator\app\Http\Controllers\ScheduleController.php`

---

### Ticketing and passenger records

Ticketing captures **purchase**, **payment state**, and **alighting** events in MySQL so revenue and occupancy reports remain reconcilable with schedule rows. Stripe or simulated checkout flows may be used depending on deployment; environment files in the commuter project supply **public** keys where required, while **secrets** remain server-side.

**Figure __: Code snippet of commuter mobile API base configuration**

```1:21:TansTrack/Commuters/src/environments/environment.ts
export const environment = {
  production: false,
  /**
   * Local Laravel (`php artisan serve` → :8000). Ionic (`ionic serve` → :8100) calls this URL cross-origin;
   * BusOperator `config/cors.php` allows it — no ngrok/CORS interstitial issues.
   *
   * Free ngrok URLs change every restart; the bundled app only picks up a new URL after you edit this
   * value and rebuild/restart `ionic serve`. For phone/LAN testing use your LAN IP, e.g.
   * `http://192.168.x.x:8000/api/v1`. To hit the tunnel from a device, paste the current Forwarding URL:
   * `https://xxxx.ngrok-free.app/api/v1` (expect ngrok browser-warning quirks on OPTIONS unless using a paid/reserved domain).
   */
  apiUrl: 'http://localhost:8000/api/v1',
  ocrApiKey: 'K87693276688957',

  mapbox: {
    accessToken: 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA'
  },

  /** Matches terminal manager / approved route packages (north | south) */
  commuterTerminal: 'north' as 'north' | 'south',
  commuterBusTypeDefault: 'regular' as 'regular' | 'aircon',
```

**Source file:** `c:\Users\User\Desktop\TransiTrack System\TansTrack\Commuters\src\environments\environment.ts`  
*(Redact keys in the printed thesis.)*

---

## TESTING PROCESS

The full **Testing Process** narrative, **Development Testing** paragraph, and **role-based test case tables** (aligned with **Capstone Sample.pdf** pages **100–105**) are maintained in a dedicated file so Chapter III stays easy to paste into Word by section:

**`TRANSITRACK_CHAPTER_3_TESTING_PROCESS.md`**

---

## Supplementary reference

Technical stack prose, IDE discussion, and additional Mapbox/Stream snippets appear in **`TRANSITRACK_CHAPTER_3_DEVELOPMENT_AND_TOOLS.md`**.

---

*Prepared for: **`c:\Users\User\Desktop\TransiTrack System\`**. **Development Process** content aligns with **Capstone Sample.pdf** pages **86–99**; **Testing Process** tables continue in **`TRANSITRACK_CHAPTER_3_TESTING_PROCESS.md`** (pages **100–105**). Assign concrete **Figure** numbers where **`Figure __`** placeholders appear.*
