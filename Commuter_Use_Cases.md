# COMMUTER USE CASES FOR TRANSITRACK MOBILE APPLICATION

## 1. COMMUTER REGISTRATION AND ACCOUNT SETUP

**Use Case:** Commuter Registration and Account Setup

**Pre-condition:** 
- Commuter has downloaded the TansTrack mobile application on their smartphone
- Device has internet connectivity and GPS capabilities
- Application has necessary permissions for location access
- Firebase backend services are operational

**Post-condition:** 
- Commuter account is successfully created and stored in Firebase database
- User profile is established with personal preferences
- Account verification is completed via email
- Commuter gains access to all app features and services

**Actor Action 1:** Commuter opens the TansTrack mobile application for the first time

**System Response 1:** System displays welcome screen with app introduction, registration options, and terms of service agreement

**Actor Action 2:** Commuter taps "Create Account" button to begin registration process

**System Response 2:** System presents registration form with fields for name, email, phone number, and password requirements

**Actor Action 3:** Commuter enters personal information including full name, valid email address, and phone number

**System Response 3:** System validates input format and highlights any errors in real-time with validation messages

**Actor Action 4:** Commuter creates a secure password meeting system requirements

**System Response 4:** System displays password strength indicator and confirms acceptable password criteria

**Actor Action 5:** Commuter agrees to terms of service and privacy policy by checking consent boxes

**System Response 5:** System enables the registration submission button and acknowledges consent

**Actor Action 6:** Commuter taps "Register" button to submit account creation request

**System Response 6:** System validates all information, creates Firebase account, sends email verification, and displays success message with instructions

**Actor Action 7:** Commuter checks email and clicks verification link to confirm account

**System Response 7:** System validates verification token, activates account, and redirects to login screen with confirmation message

---

## 2. BUS ROUTE SEARCH AND DISCOVERY

**Use Case:** Bus Route Search and Discovery

**Pre-condition:** 
- Commuter is logged into the TansTrack mobile application
- GPS location services are enabled and functional
- Route database is synchronized and up-to-date
- Internet connectivity is available for real-time data

**Post-condition:** 
- Commuter receives comprehensive route information for their journey
- Available bus routes and schedules are displayed
- Route details including stops, timing, and fares are presented
- Journey planning information is provided with estimated travel time

**Actor Action 1:** Commuter taps "Find Routes" button on the main dashboard

**System Response 1:** System displays route search interface with options for current location, destination input, and quick search suggestions

**Actor Action 2:** Commuter enters their current location or allows GPS auto-detection

**System Response 2:** System detects GPS coordinates, reverse geocodes to readable address, and displays current location with map marker

**Actor Action 3:** Commuter enters their desired destination using search field or map selection

**System Response 3:** System provides autocomplete suggestions for destinations and validates location accuracy using Mapbox geocoding

**Actor Action 4:** Commuter selects destination from suggestions or confirms map-selected location

**System Response 4:** System processes route search query and displays loading indicator while calculating available routes

**Actor Action 5:** Commuter reviews available route options and selects preferred route for detailed information

**System Response 5:** System presents comprehensive route details including bus codes, stops, schedules, regular/aircon fares, estimated duration, and route map visualization

**Actor Action 6:** Commuter taps "View Route Map" to see detailed route visualization

**System Response 6:** System opens Mapbox interactive map showing complete route line, stop markers, current location, and destination with turn-by-turn navigation preview

**Actor Action 7:** Commuter saves route to favorites for future quick access

**System Response 7:** System adds route to user's saved routes list, stores preference in Firebase, and displays confirmation message

---

## 3. REAL-TIME BUS TRACKING AND LOCATION MONITORING

**Use Case:** Real-Time Bus Tracking and Location Monitoring

**Pre-condition:** 
- Commuter has selected a specific bus route for their journey
- Bus tracking system is active and GPS-enabled buses are operational
- Firebase real-time database is functioning for live updates
- Commuter has granted location permissions for tracking features

**Post-condition:** 
- Real-time bus location is displayed on interactive map
- Live tracking updates provide accurate bus position and ETA
- Commuter receives notifications about bus status and arrival times
- Journey progress is monitored with real-time updates

**Actor Action 1:** Commuter selects their chosen route and taps "Track Live Bus" option

**System Response 1:** System searches for active buses on the selected route and displays available buses with their current status and locations

**Actor Action 2:** Commuter selects specific bus to track from the list of active buses

**System Response 2:** System initiates real-time tracking, displays interactive map with bus location marker, and shows live position updates every 10-30 seconds

**Actor Action 3:** Commuter monitors bus progress as it moves along the route toward their stop

**System Response 3:** System continuously updates bus marker position on map, calculates distance to commuter's stop, and provides estimated arrival time

**Actor Action 4:** Commuter enables arrival notifications for their boarding stop

**System Response 4:** System sets up proximity-based notifications and confirms alert preferences for arrival warnings

**Actor Action 5:** Commuter tracks bus approaching their location while preparing to board

**System Response 5:** System sends push notifications when bus is 5 minutes away, 2 minutes away, and arriving at stop with audio/vibration alerts

**Actor Action 6:** Commuter boards the bus and continues tracking to monitor journey progress to destination

**System Response 6:** System switches to journey mode, tracks progress to destination stop, and provides real-time updates on remaining travel time and upcoming stops

**Actor Action 7:** Commuter receives notification as bus approaches their destination stop

**System Response 7:** System alerts commuter to prepare for disembarking with notification and map showing approaching destination stop

---

## 4. SCHEDULE VIEWING AND TRIP PLANNING

**Use Case:** Schedule Viewing and Trip Planning

**Pre-condition:** 
- Commuter is authenticated in the TansTrack application
- Bus schedule database is updated with current timetables
- Route information is synchronized from operator systems
- Device has access to calendar and notification services

**Post-condition:** 
- Commuter views detailed bus schedules for selected routes
- Trip planning is completed with optimal departure times
- Schedule notifications are set for planned journeys
- Personal travel calendar is updated with trip information

**Actor Action 1:** Commuter navigates to "Schedules" section from main menu

**System Response 1:** System displays schedule interface with options to search by route, time, or favorite routes

**Actor Action 2:** Commuter selects their desired route from saved routes or searches for new route

**System Response 2:** System retrieves and displays comprehensive schedule for selected route including departure times, frequency, and service hours

**Actor Action 3:** Commuter filters schedule by specific time periods (morning, afternoon, evening) or specific dates

**System Response 3:** System applies filters and shows relevant schedule entries with color-coded time slots and service availability

**Actor Action 4:** Commuter selects specific departure time for trip planning

**System Response 4:** System displays detailed trip information including boarding time, estimated travel duration, arrival time, and fare details

**Actor Action 5:** Commuter sets up schedule reminder for their planned trip

**System Response 5:** System creates calendar notification, sets up reminder alerts, and confirms notification timing preferences

**Actor Action 6:** Commuter plans return journey by selecting return departure times

**System Response 6:** System calculates return trip options, suggests optimal return times based on destination schedules, and presents round-trip planning interface

**Actor Action 7:** Commuter saves complete trip plan to their personal travel calendar

**System Response 7:** System stores trip plan in Firebase, integrates with device calendar, and provides sharing options for trip details

---

## 5. FARE INFORMATION AND PAYMENT INTEGRATION

**Use Case:** Fare Information and Payment Integration

**Pre-condition:** 
- Commuter has selected routes and reviewed journey details
- Fare calculation system is operational with current pricing
- Payment integration services are available and secure
- User payment methods are registered and verified

**Post-condition:** 
- Accurate fare information is displayed for selected journey
- Payment options are presented with secure processing
- Digital receipts are generated and stored
- Payment history is maintained for user reference

**Actor Action 1:** Commuter reviews route details and taps "View Fare Information"

**System Response 1:** System displays comprehensive fare breakdown showing regular bus fare, air-conditioned bus fare, distance-based pricing, and any applicable discounts

**Actor Action 2:** Commuter compares fare options between regular and air-conditioned bus services

**System Response 2:** System presents side-by-side fare comparison with features, comfort levels, and price differences clearly highlighted

**Actor Action 3:** Commuter selects preferred service type and proceeds to payment options

**System Response 3:** System displays available payment methods including digital wallets, credit cards, and mobile payment platforms

**Actor Action 4:** Commuter chooses payment method and enters payment details or selects saved payment option

**System Response 4:** System securely processes payment information, validates payment method, and displays transaction confirmation

**Actor Action 5:** Commuter confirms payment amount and authorizes transaction

**System Response 5:** System processes payment through secure gateway, generates digital receipt, and provides transaction confirmation with reference number

**Actor Action 6:** Commuter receives digital ticket or payment confirmation for bus boarding

**System Response 6:** System generates QR code or digital ticket, sends confirmation via email/SMS, and stores payment record in user history

**Actor Action 7:** Commuter accesses payment history and digital receipts for record keeping

**System Response 7:** System displays complete payment history with dates, routes, amounts, and downloadable receipts for expense tracking

---

## 6. NAVIGATION AND WALKING DIRECTIONS TO BUS STOPS

**Use Case:** Navigation and Walking Directions to Bus Stops

**Pre-condition:** 
- Commuter has selected a route and identified boarding stop
- GPS location services are active and accurate
- Mapbox navigation services are operational
- Walking directions algorithm is functional

**Post-condition:** 
- Turn-by-turn walking directions to bus stop are provided
- Real-time navigation with voice guidance is active
- Distance and estimated walking time are calculated
- Arrival at bus stop is confirmed with location verification

**Actor Action 1:** Commuter selects their preferred bus route and identifies boarding stop location

**System Response 1:** System displays route map with highlighted boarding stop marker and stop details including address and nearby landmarks

**Actor Action 2:** Commuter taps "Navigate to Stop" button to begin walking navigation

**System Response 2:** System calculates optimal walking route using Mapbox directions API and displays estimated walking time and distance to stop

**Actor Action 3:** Commuter starts navigation and begins walking toward the bus stop

**System Response 3:** System initiates turn-by-turn voice navigation, displays map with walking route highlighted, and provides real-time GPS tracking

**Actor Action 4:** Commuter follows navigation instructions while monitoring progress on map

**System Response 4:** System provides voice prompts for turns, updates remaining distance and time, and adjusts route if user deviates from path

**Actor Action 5:** Commuter approaches bus stop area and looks for exact stop location

**System Response 5:** System identifies when user is within 50 meters of stop, highlights stop location with precision marker, and provides final approach directions

**Actor Action 6:** Commuter arrives at bus stop and confirms arrival in the application

**System Response 6:** System verifies GPS location matches stop coordinates, confirms arrival, and switches to bus tracking mode for incoming buses

**Actor Action 7:** Commuter accesses stop-specific information while waiting for bus

**System Response 7:** System displays stop amenities, real-time bus arrivals, alternative routes from same stop, and nearby points of interest

---

## 7. PUSH NOTIFICATIONS AND SERVICE ALERTS

**Use Case:** Push Notifications and Service Alerts

**Pre-condition:** 
- Commuter has enabled push notifications in app settings
- Firebase Cloud Messaging service is operational
- Commuter has active subscriptions to route alerts
- Notification preferences are configured in user profile

**Post-condition:** 
- Real-time notifications are delivered for relevant service updates
- Route disruptions and delays are communicated promptly
- Personalized alerts based on user preferences are sent
- Emergency notifications and service changes are broadcast

**Actor Action 1:** Commuter configures notification preferences in app settings

**System Response 1:** System displays notification categories including route alerts, service disruptions, schedule changes, and promotional messages with on/off toggles

**Actor Action 2:** Commuter subscribes to specific route notifications for frequently used routes

**System Response 2:** System registers route subscriptions in Firebase, confirms preferences, and explains types of alerts user will receive

**Actor Action 3:** Commuter enables location-based notifications for nearby bus arrivals

**System Response 3:** System sets up geofencing around user's frequent locations and configures proximity-based arrival alerts

**Actor Action 4:** Commuter receives push notification about route delay or service disruption

**System Response 4:** System displays notification with delay details, alternative route suggestions, and updated schedule information

**Actor Action 5:** Commuter taps notification to view detailed alert information

**System Response 5:** System opens alert details showing cause of disruption, estimated delay duration, affected routes, and recommended actions

**Actor Action 6:** Commuter acknowledges notification and accesses alternative route suggestions

**System Response 6:** System marks notification as read, provides alternative route options, and updates user's journey planning with new information

**Actor Action 7:** Commuter manages notification history and adjusts alert preferences

**System Response 7:** System displays notification history, allows preference modifications, and provides options to mute or customize specific alert types

## Alternative Scenarios:

### Alternative Scenario A: No Internet Connection
**Actor Action A1:** Commuter attempts to use app features without internet connectivity

**System Response A1:** System displays offline mode message, provides cached route information, and explains limited functionality until connection is restored

### Alternative Scenario B: GPS Not Available
**Actor Action B1:** Commuter tries to use location-based features with GPS disabled

**System Response B1:** System prompts user to enable GPS, offers manual location entry option, and explains benefits of location services

### Alternative Scenario C: Route Not Available
**Actor Action C1:** Commuter searches for route that doesn't exist or is temporarily suspended

**System Response C1:** System displays "Route not found" message, suggests alternative routes, and provides contact information for route inquiries

### Alternative Scenario D: Bus Tracking Unavailable
**Actor Action D1:** Commuter attempts to track bus that doesn't have GPS or is offline

**System Response D1:** System displays last known bus location, shows scheduled time instead of real-time, and explains tracking limitations

## Exception Scenarios:

### Exception Scenario 1: App Crash During Navigation
**System Response:** System automatically saves navigation state, restarts with last known location, and resumes navigation from current position

### Exception Scenario 2: Payment Processing Failure
**Actor Action:** Commuter's payment transaction fails during fare payment

**System Response:** System displays error message, suggests alternative payment methods, retains route selection, and provides customer support contact

### Exception Scenario 3: Server Maintenance
**System Response:** System displays maintenance notification, provides estimated restoration time, offers limited offline functionality, and stores user actions for sync when online
