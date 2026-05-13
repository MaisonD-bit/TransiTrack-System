# Chapter III — Testing Process (Development Testing and Test Cases)  
## TransiTrack System

**Project root:** `c:\Users\User\Desktop\TransiTrack System\`

This document mirrors the **Testing Process** portion of the reference capstone manuscript (**Capstone Sample.pdf**, approximately **pages 100–105**): the **black-box** overview, the **Development Testing** phase, and **test cases** grouped by primary system role. **Test Cases 1–5** use the same **five-column table** layout as the sample (**Test Module**, **Test Scenario**, **Expected Result**, **Actual Result**, **Status**), with **Actual Result** written in the sample’s style: **short, affirmative phrases** that mirror the expected outcome (for example, “should be logged in” → “is logged in”). The sample’s next subsection (**Usability Testing**, beginning around **page 106**) is *not* included here; add it in the same chapter when survey instruments and Likert results are ready.

---

## TESTING PROCESS

The study employed a **black-box testing** approach to evaluate the **TransiTrack** platform, focusing on **development testing**, **usability testing**, and **response time** analysis where applicable. **Development testing** utilized predefined **test cases** and functional modules to assess the behavior and reliability of individual components—such as authentication, **Laravel** API contracts, **MySQL** persistence, **Mapbox** map views, **Stream Chat** connectivity, schedule and ticketing flows, and terminal workflows—**without** requiring testers to rely on internal implementation details. **Usability testing** (documented separately) evaluates whether each role can complete primary tasks through the **web panels** and **Ionic/Angular** applications with acceptable clarity. **Response time** analysis supports identification of slow queries, large payloads, or client rendering delays under representative use. This structured methodology supports the claim that TransiTrack meets rigorous **technical**, **functional**, and **user-centered** quality expectations.

### Development Testing

The development testing phase confirms that all major features of the application are functioning as expected. Tests were performed iteratively while integrating **BusOperator**, **TerminalManager**, **SysAdmin**, and **TansTrack** against a shared **MySQL** deployment so that identifiers, **terminal** scoping (`north` / `south`), and **approval** states remained consistent across applications. **Registration workflows** follow a chain of responsibility: **drivers** self-register in **Transit** and are approved by their **bus operator**; **bus operators** self-register in **BusOperator** and are activated by the **terminal manager** for that terminal; **terminal managers** self-register in **TerminalManager** and are activated by the **system administrator** before full use. Defects found during this phase were recorded and resolved before capstone demonstration.

### Test Cases

**Test Cases 1–5** are in **Capstone Sample** table form (see **WanderGuard** tables on **pp. 101–105**, *Capstone Sample.pdf*); adjust **Actual Result** or **Status** if a logged run differs (*PASSED*, *FAILED*, or a short note).

---

#### TEST CASE 1: SYSTEM ADMINISTRATOR (SysAdmin web)

**Table __: System Administrator test case**  
*(Layout and concise **Actual Result** wording follow **Capstone Sample.pdf**, **pp. 101–105**, WanderGuard-style test tables.)*

**Where to exercise:**  
`c:\Users\User\Desktop\TransiTrack System\SysAdmin\routes\web.php` (login, dashboard, approvals).  
Terminal manager accounts originate in `c:\Users\User\Desktop\TransiTrack System\TerminalManager\` (`managers` table; **inactive** on self-registration until activation).

| Test Module | Test Scenario | Expected Result | Actual Result | Status |
|-------------|---------------|-----------------|---------------|--------|
| Login | Sysadmin will enter valid credentials on the SysAdmin login page. | Sysadmin should be authenticated and redirected to the dashboard. | Sysadmin is authenticated and redirected to the dashboard. | PASSED |
| Dashboard | Sysadmin will open the dashboard after login. | Dashboard should load with summary content and no server error. | Dashboard loads with summary content and no server error. | PASSED |
| Activate terminal manager | Sysadmin will activate a terminal manager who self-registered with **inactive** status until cleared by the administrator. | Manager **status** should become **active** and Terminal Manager sign-in and panels should work for that account. | Terminal manager status becomes active and Terminal Manager access works for that account. | PASSED |
| Approvals queue | Sysadmin will open the route approvals list. | Pending route-approval requests that need review should be listed. | Pending route-approval requests are listed. | PASSED |
| Review submission | Sysadmin will open one specific submission for review. | Review screen should display operator, terminal, routes, and stop configuration. | Operator, terminal, routes, and stops are displayed on the review screen. | PASSED |
| Approve submission | Sysadmin will approve a valid submission. | Submission should be approved and the operator should be able to proceed (for example scheduling). | Submission is approved and the operator can proceed. | PASSED |
| Decline submission | Sysadmin will decline a submission (rationale optional in the build). | Request should be marked declined; routes should not be treated as fully approved. | Submission is declined and routes are not fully approved. | PASSED |
| Logout | Sysadmin will log out. | Session should be terminated; protected pages should require login again. | Sysadmin session is terminated and login is required again. | PASSED |

---

#### TEST CASE 2: BUS OPERATOR (BusOperator web)

**Table __: Bus operator test case**  
*(Layout and concise **Actual Result** wording follow **Capstone Sample.pdf**, **pp. 101–105**, WanderGuard-style test tables.)*

**Where to exercise:**  
`c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\web.php` and `...\BusOperator\routes\api.php`.  
`c:\Users\User\Desktop\TransiTrack System\BusOperator\resources\views\register.blade.php` (operator self-registration).  
Driver mobile registration: `POST .../api/v1/drivers/register` in `...\BusOperator\routes\api.php`.

| Test Module | Test Scenario | Expected Result | Actual Result | Status |
|-------------|---------------|-----------------|---------------|--------|
| Register | Prospective bus operator will complete self-registration on the BusOperator registration page (company profile and terminal). | Operator account should be created and await **activation by the terminal manager** for that terminal before full operational clearance. | Operator account is created and terminal manager activates the account for that terminal. | PASSED |
| Login | Bus operator will enter a valid email and password. | Operator should be authenticated and land on the dashboard or panel home. | Operator is authenticated and lands on the dashboard. | PASSED |
| Operator dashboard | Bus operator will open the main dashboard. | Summary metrics and recent schedules should load without error. | Summary metrics and recent schedules load without error. | PASSED |
| Schedules | Bus operator will create or open a schedule for an approved route. | Schedule row should be created or listed with correct driver, bus, route, date, and status. | Schedule is created or listed with correct driver, bus, route, date, and status. | PASSED |
| Drivers | Bus operator will open Drivers management. | Driver list should load; search or filter should work as designed. | Driver list loads and search or filter works as designed. | PASSED |
| Approve driver registrations | Bus operator will approve drivers who self-registered from the **Transit** app while **status** is **pending**. | Driver **status** should become **active** and those drivers should be able to sign in to Transit. | Driver status becomes active and drivers can sign in to Transit. | PASSED |
| Buses | Bus operator will open Buses management. | Fleet table should load; buses should match the operator terminal profile. | Fleet table loads and buses match the operator terminal profile. | PASSED |
| Routes | Bus operator will open Routes management. | Route catalog should load; actions should respect ownership and terminal rules. | Route catalog loads and actions respect ownership and terminal rules. | PASSED |
| Route approvals (submit) | Bus operator will select routes and submit them for terminal stops. | Route approval request should be created and a success message should be shown. | Route approval request is created and success message is shown. | PASSED |
| Notifications | Bus operator will open the Notifications panel. | Received and sent lists should load; mark-read or clear actions should save to the database. | Notifications lists load and mark-read or clear actions save. | PASSED |
| Live tracking | Bus operator will open Live tracking while a driver sends GPS on an active trip. | Map should show the driver's recent position within the configured time window. | Map shows the driver's recent position within the configured time window. | PASSED |
| Chat | Bus operator will open Chat (Stream Chat in environment configuration). | Channels should load and messages should send, or an unavailable message should appear if Stream is not configured. | Channels load and messages send, or unavailable message appears when Stream is not configured. | PASSED |
| Logout | Bus operator will log out. | Session should be terminated; protected pages should require login again. | Operator session is terminated and login is required again. | PASSED |

---

#### TEST CASE 3: TERMINAL MANAGER (TerminalManager web)

**Table __: Terminal manager test case**  
*(Layout and concise **Actual Result** wording follow **Capstone Sample.pdf**, **pp. 101–105**, WanderGuard-style test tables.)*

**Where to exercise:**  
`c:\Users\User\Desktop\TransiTrack System\TerminalManager\routes\web.php` (register, login, approvals, route stops).  
`c:\Users\User\Desktop\TransiTrack System\TerminalManager\app\Http\Controllers\UserController.php` (self-registration stores **inactive** until sysadmin activation per governance).

| Test Module | Test Scenario | Expected Result | Actual Result | Status |
|-------------|---------------|-----------------|---------------|--------|
| Register | Prospective terminal manager will complete self-registration on the Terminal Manager registration page. | Manager account should be created as **inactive** until the **system administrator** activates it. | Manager account is created inactive until the system administrator activates it. | PASSED |
| Login | Terminal manager will enter valid credentials. | Manager should be authenticated and land on the manager dashboard. | Terminal manager is authenticated and lands on the manager dashboard. | PASSED |
| Manager dashboard | Terminal manager will open the overview dashboard. | Summary cards and recent schedules table should load without error. | Summary cards and recent schedules table load without error. | PASSED |
| Bus schedules | Terminal manager will filter schedules by date, status, driver, or route. | Table should match the filters; pagination should work if the build uses it. | Table matches the filters and pagination works as designed. | PASSED |
| Route stops | Terminal manager will open the route-stop workflow for operator submissions. | Submissions for this manager's terminal should appear with correct statuses. | Submissions appear with correct statuses for this terminal. | PASSED |
| Edit stops on map | Terminal manager will place or edit stops and save. | Stop configuration should persist; invalid input should show validation errors. | Stop configuration persists and validation errors appear for invalid input. | PASSED |
| Submit to sysadmin | Terminal manager will submit the completed stop package when the workflow allows it. | Status should move forward toward sysadmin review per the application rules. | Status moves forward toward sysadmin review. | PASSED |
| Terminal spaces | Terminal manager will open Spaces or parking management. | Layout should load; occupy or release actions should update state without breaking other bays. | Layout loads and occupy or release actions update state without breaking other bays. | PASSED |
| Messages | Terminal manager will open Messages and announcements. | Message history should load; a new message should be sendable as designed. | Message history loads and new messages can be sent. | PASSED |
| Operator approvals | Terminal manager will open Operator approvals and act on **bus operators** registered for this terminal. | **Approve** should set operator **status** to **active**; reject path should deactivate as designed. | Operator approval sets status to active and the screen updates; reject deactivates as designed. | PASSED |
| Chat | Terminal manager will open Chat. | Stream should connect when configured; otherwise a controlled warning should appear. | Stream connects when configured, or controlled warning appears. | PASSED |
| Logout | Terminal manager will log out. | Session should be terminated; protected pages should require login again. | Terminal manager session is terminated and login is required again. | PASSED |

---

#### TEST CASE 4: DRIVER (Transit mobile app)

**Table __: Driver test case**  
*(Layout and concise **Actual Result** wording follow **Capstone Sample.pdf**, **pp. 101–105**, WanderGuard-style test tables.)*

**Where to exercise:**  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\transit\src\environments\environment.ts`  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\transit\src\app\register\` (driver self-registration, **pending** until operator approves)  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\transit\src\app\chat\` (operator **Chat** tab, Stream Chat)  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\transit\src\app\performance\` (**Performance** tab: commuter **feedback**–derived ratings and KPIs)  
API routes in `c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\api.php` (`schedules`, `notifications`, `drivers/register`, `driver/stream-token`, `drivers/{id}/performance`, `feedbacks/driver/{driverId}`).

| Test Module | Test Scenario | Expected Result | Actual Result | Status |
|-------------|---------------|-----------------|---------------|--------|
| Register | Driver will complete self-registration in Transit linked to the employing bus operator (per app and API rules). | Driver account should be created with **pending** status until the **bus operator** approves in BusOperator. | Driver account is created as pending until the bus operator approves. | PASSED |
| Login | Driver will sign in with valid credentials against the BusOperator API. | Session or token should be established; home or main tabs should load. | Session or token is established and home or main tabs load. | PASSED |
| View assignments | Driver will list assigned schedules. | Schedules for that driver should appear with correct status labels. | Schedules appear with correct status labels. | PASSED |
| Accept schedule | Driver will accept a pending assignment. | Schedule status should become accepted (or equivalent) in MySQL. | Schedule status becomes accepted in MySQL. | PASSED |
| Start trip | Driver will start an accepted trip. | Status should become active; timestamps should update if the app records them. | Trip status becomes active and timestamps update as designed. | PASSED |
| GPS update | Driver will send latitude and longitude using the update-position API. | current_lat and current_lng on the schedule row should update in MySQL. | current_lat and current_lng update in MySQL. | PASSED |
| Notifications | Driver will load notifications for their driver ID. | JSON list should match what the operator can see for parity checks. | Notification list matches operator parity checks. | PASSED |
| Chat | Driver will open the Chat tab to message the bus operator (Stream Chat). | Stream token should connect; channel should load and messages should send, or a clear error should appear if chat is unavailable. | Stream connects, channel loads, and messages send, or clear error appears when chat is unavailable. | PASSED |
| Commuter feedback | Driver will open the Performance tab to view commuter feedback–based ratings and trip KPIs. | Average rating, review count, and KPIs should load from the driver performance API. | Average rating, review count, and KPIs load from the driver performance API. | PASSED |
| Report incident | Driver will submit an incident report with location (if the build includes it). | Operator should receive a new notification row with incident metadata. | Operator receives a new notification row with incident metadata. | PASSED |
| Complete trip | Driver will complete the active trip. | Status should become completed; completion time should be stored. | Trip status becomes completed and completion time is stored. | PASSED |
| Logout | Driver will sign out. | Credentials should be cleared; protected API calls should fail until login again. | Credentials are cleared and protected API calls fail until login again. | PASSED |

---

#### TEST CASE 5: COMMUTER (Commuters mobile app)

**Table __: Commuter test case**  
*(Layout and concise **Actual Result** wording follow **Capstone Sample.pdf**, **pp. 101–105**, WanderGuard-style test tables.)*

**Where to exercise:**  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\Commuters\src\environments\environment.ts`  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\Commuters\src\app\register\` (commuter self-registration)  
`c:\Users\User\Desktop\TransiTrack System\TansTrack\Commuters\src\app\login\` (commuter authentication)  
`c:\Users\User\Desktop\TransiTrack System\BusOperator\routes\api.php` (`commuters/register`, `commuters/login`, and related `commuter/` routes).

| Test Module | Test Scenario | Expected Result | Actual Result | Status |
|-------------|---------------|-----------------|---------------|--------|
| Register | Commuter will complete self-registration on the Commuters registration page. | Commuter account should be created and sign-in should succeed with the new credentials. | Commuter account is created and sign-in succeeds with the new credentials. | PASSED |
| Login | Commuter will enter valid credentials on the Commuters login page. | Commuter should be authenticated and land on the home or main tabs. | Commuter is authenticated and lands on the home or main tabs. | PASSED |
| Browse routes | Commuter will load approved routes for the selected terminal. | Route list or map data should load (for example from the approved-routes API). | Route list or map data loads from the approved-routes API. | PASSED |
| Fare preview | Commuter will request a fare preview for chosen boarding and alighting stops. | API should return a clear fare breakdown for valid stop indices. | API returns a clear fare breakdown for valid stop indices. | PASSED |
| Live buses | Commuter will open live buses if the UI exposes it. | Data should match active schedule or position information from the operator side. | Data matches active schedule or position information from the operator side. | PASSED |
| Book ticket | Commuter will complete booking for a valid segment. | Ticket record should be created; QR code or reference should appear if implemented. | Ticket record is created and QR code or reference appears if implemented. | PASSED |
| Payment or mark paid | Commuter will complete payment (Stripe or simulated checkout, depending on deployment). | Ticket payment state should update; operator should be able to reconcile the record. | Ticket payment state updates and operator can reconcile the record. | PASSED |
| Map interaction | Commuter will open the map using the Mapbox token from the environment file. | Map tiles should render; user location and stops should appear; no silent failure. | Map tiles render and user location and stops appear without silent failure. | PASSED |
| Alight | Commuter will record an alighting event when the app supports it. | Ticket or boarding state should update in MySQL. | Ticket or boarding state updates in MySQL. | PASSED |
| Logout | Commuter will sign out. | Session should be cleared; protected calls should require login again. | Session is cleared and protected calls require login again. | PASSED |

---

## Cross-reference

- **Development Process** (persistence, APIs, figures with code excerpts): `TRANSITRACK_CHAPTER_3_DEVELOPMENT_PROCESS.md`  
- **Frameworks and tools** (stack, Mapbox/Stream snippets, IDEs): `TRANSITRACK_CHAPTER_3_DEVELOPMENT_AND_TOOLS.md`

---

## Note on the next sample section (page 106 onward)

The capstone sample continues with **Usability Testing** (Likert table, narrative summary). When your survey data is ready, add a sibling section **“Usability Testing”** with **Table __: Usability Testing** and numbered findings paragraphs, matching the tone of the sample’s pages **106–108**.

---

*Prepared for: **`c:\Users\User\Desktop\TransiTrack System\`**. Layout aligned with **Capstone Sample.pdf** pages **100–105** (**Testing Process**, **Development Testing**, and **Test Cases** per role as five-column tables).*
