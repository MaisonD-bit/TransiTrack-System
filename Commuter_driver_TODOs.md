# TransiTrack ToDo

## Commuter System

### Route and Trip Selection

* Commuters should be able to:

  * select a route
  * choose their current terminal/location
  * select a "Board At" stop
  * select a "Drop Off" stop

### Live Bus Visibility

* Commuters should only see buses/drivers that:

  * accepted their current schedule
  * are currently active/live in the system

* Once a driver accepts the current schedule:

  * the assigned bus marker should appear on the commuter map
  * the marker should follow the active route using the bus simulation service
  
  ### Real-Time Bus Tracking Synchronization

* The commuter map should synchronize in real time with the driver’s bus simulation/location updates.
* Commuters should be able to see the live current location of the assigned bus driver on the map.
* This allows commuters to monitor if the bus is approaching their selected "Board At" stop so they can prepare for boarding.

Behavior:

* When the driver starts the route and `bus_simulation = true`:

  * the bus marker should appear and move in real time on both:

    * the driver system
    * the commuter system

* The commuter map should continuously receive updated bus coordinates from the active driver route simulation.

* Only active/live buses with accepted schedules should be visible to commuters.


### E-Ticket Generation

* Commuters should be able to generate an e-ticket only when:

  * the selected route has an active/live driver
  * the driver already accepted the schedule

### Payment and E-Ticket Rules:


#### Starting Terminal Passengers
* Commuters boarding from the CURRENT route origin/starting point must pay first before the bus departs from that terminal.

Examples:

If the current schedule is:
Cebu → Tayud
commuters boarding in Cebu should pay before departure

When the vice-versa trip becomes:
Tayud → Cebu
commuters boarding in Tayud should also pay before departure

* E-ticket status must be marked as paid before departure.

* If the commuter has not yet paid:
  the commuter should still appear in the onboard passenger count/list
  but their e-ticket/payment status should display a label such as:
  "Unpaid"
  "Payment Pending"

  Requirements:

* The payment-first rule should dynamically follow the active/current schedule origin terminal.
* The driver should be able to identify which onboard commuters are unpaid.
* Unpaid commuters should continue receiving payment reminders while onboard.
* Unpaid commuters routes selection for booking is disabled while onboard.

* onboard commuters cannot modify/rebook routes during an active trip because
 Once a commuter is marked as onboard during an active trip:

   - route selection and new route booking should be disabled
   - the commuter should not be allowed to change routes mid-trip

 This prevents inconsistencies in:

   - passenger capacity tracking
   - boarding/drop-off logic
   - fare/payment tracking
   - active trip synchronization




#### Mid-Route Passengers

* Commuters boarding from intermediate stops may pay anytime while onboard.
* The system should track unpaid onboard commuters.

#### Destination Payment Reminder

* If an onboard commuter is still unpaid and is approaching their selected "Drop Off" stop:

  * the system should display a toast notification/reminder
  * notifying the commuter that they are near their destination and must complete payment

Example:

* "You are near your destination. Please complete your fare payment now."

#### Boarding and Cancellation Rules

* Once the bus driver/bus simulation reaches the commuter’s selected "Board At" stop and the commuter is marked as onboard:

  * the commuter can no longer cancel the e-ticket
  * the e-ticket becomes locked/active

#### Ticket Cancellation

* Commuters may only cancel their e-ticket:

  * before boarding
  * before the bus passes their selected boarding stop


### Real-Time Bus Simulation

* The system currently uses a bus-simulation service for testing.

Behavior:

* When the driver accepts the current schedule and presses "Start Route":

  * `bus_simulation = true`
  * the bus marker starts moving along the route

* When the driver reaches the destination:

  * `bus_simulation = false`
  * the trip is completed
  * the driver is prompted again to accept or decline the next vice-versa schedule

  ### Dynamic Stop Availability

* The commuter system should synchronize with the driver’s live bus simulation and route progress.

Behavior:

* When the bus driver/bus simulation passes a stop:

  * that stop should automatically become disabled/unavailable in the commuter’s "Board At" stop selection list
  * commuters should no longer be allowed to select already-passed stops

* The next upcoming stop that has NOT yet been passed by the driver should automatically become the default selected stop in the commuter’s "Board At" dropdown/list.

Requirements:

* Stop availability should update in real time based on the active bus location.
* Passed stops should remain visible but disabled/grayed out in the UI.
* Only upcoming valid stops should be selectable for boarding.

-----------------------------------------------------------------------------------------------------------------


# Driver System

### Schedule Management

* Drivers should be able to:

  * accept schedules
  * decline schedules

* If declined:

  * a required textbox/modal should appear
  * the driver must provide a reason for declining

### Commuter Visibility

* Drivers should be able to see commuters on the map based on the commuter’s selected "Board At" stop.
* This should be visible inside the Routes tab/map.

### Passenger Capacity Tracking

* Drivers should be able to see:

  * current passenger count
  * maximum passenger capacity

* Capacity data should update in real time.

### Boarding Logic

* When the bus reaches a stop where commuters are waiting:

  * the bus marker/bus simulation pauses for 5 seconds
  * this simulates passenger pickup

After pickup:

* the commuter is considered onboard
* the commuter marker should disappear from the driver map 
* onboard passenger count increments

### Drop-Off Logic

* When the bus reaches the commuter’s selected "Drop Off" stop:

  * the commuter exits the bus
  * onboard passenger count decrements automatically

### Vice-Versa Schedule Lifecycle

* Driver schedules operate in a continuous vice-versa trip cycle.

Example:

* Cebu → Mandaue
* Mandaue → Cebu

Behavior:

* Current Schedule = active trip
* Next Schedule = opposite return trip

When the driver reaches the destination:

* the Next Schedule becomes the Current Schedule
* the opposite route becomes the new Next Schedule

This cycle repeats continuously until the driver’s schedule for the day is completed.

Requirements:

* Do NOT create duplicate schedule rows
* Do NOT create hidden return-trip schedules
* Maintain one continuous schedule lifecycle per driver/day
-----------------------------------------------------------------------------------------------------------------

## Additional System Rules and Edge Cases

### System State Management

#### Driver States

* offline
* available
* schedule_pending
* schedule_accepted
* active_trip
* waiting_for_passengers
* return_trip
* completed
* declined

#### Bus States

* inactive
* live
* boarding
* en_route
* at_stop
* full
* completed

#### Commuter States

* browsing
* ticket_generated
* waiting_for_bus
* onboard
* unpaid
* paid
* dropped_off
* cancelled
* missed_bus

#### E-Ticket States

* pending_payment
* active
* onboard
* completed
* cancelled
* expired

---

### Bus Capacity Limit

Behavior:

* If:

  * `current_passengers >= maximum_capacity`
* Then:

  * new bookings/e-ticket generation should be disabled
  * the bus should be marked as FULL
  * commuters should no longer be allowed to board

Requirements:

* Capacity validation should update in real time.
* The FULL status should be visible in both:

  * commuter system
  * driver system

---

### Missed Bus Logic

Behavior:

* If the bus passes the commuter’s selected "Board At" stop and the commuter was not marked as onboard:

  * the commuter’s e-ticket should become expired/missed
  * the commuter should be removed from the waiting passenger list
  * the commuter marker should disappear from the driver map

Requirements:

* Missed commuters should no longer affect passenger capacity.
* The commuter should be notified that they missed the bus.

---

### Duplicate Boarding Prevention

Behavior:

* A commuter cannot:

  * board multiple buses simultaneously
  * generate multiple active e-tickets for overlapping trips

Requirements:

* Only one active/onboard trip should exist per commuter at a time.
* Existing active trips must be completed/cancelled before another route can be booked.

---

### Multiple Active Buses on Same Route

Behavior:

* Multiple buses may operate simultaneously on the same route.
* Each active bus should appear independently on the commuter map.

Requirements:

* Each bus marker should display:

  * bus name
  * company/operator name
  * plate number
  * current passenger count
  * maximum passenger capacity

* Commuters should be able to distinguish buses operating on the same route.

---

### Driver Disconnect / GPS Failure Handling

Behavior:

* If the system stops receiving driver/bus location updates for a certain period:

  * the bus should temporarily be marked as offline/inactive
  * commuters should be notified that live tracking is temporarily unavailable

Requirements:

* Prevent ghost/stuck bus markers.
* Automatically restore synchronization once location updates resume.

---

### Stop Detection Radius

Behavior:

* A stop should be considered reached when the bus enters a configurable GPS radius around the stop location.

Requirements:

* Prevent inaccurate stop detection caused by GPS inconsistencies.
* Boarding/drop-off logic should trigger only within the allowed stop radius.

---

### Automatic Drop-Off Completion

Behavior:

* When the bus reaches the commuter’s selected "Drop Off" stop:

  * the commuter should automatically be marked as dropped off
  * passenger count should decrement
  * e-ticket status should become completed
  * commuter should be removed from onboard passenger tracking

Requirements:

* Drop-off handling should synchronize in real time between:

  * commuter system
  * driver system
  * bus simulation
