# Task: Debug vice-versa trip lifecycle & bus simulation reversal

## Step 1: Trace return-trip direction switching (frontend)
- Inspect `map.page.ts` return trip state selection (`currentSchedule`, `isReturnTrip`, `return_trip_status`)
- Confirm arrival callback flow `onArrivedAtDestination()` -> `doCompleteSchedule()`
- Identify why `next schedule` doesn’t reverse after first leg

## Step 2: Fix arrival handler stalling
- Reset `arrivalPromptShown` (and `isNearDestination`) when refreshing schedule / after completion/start
- ✅ Implement in `map.page.ts` (arrival gate reset on refresh + start)



## Step 3: Trace bus simulation teleport/reset
- Inspect `route-map.component.ts` simulation restart logic
- Identify sessionStorage step index reuse across geometry direction changes

## Step 4: Fix simulation continuity on route reversal
- Clear `driver_sim_step` when `routeGeoJson` changes and simulation restarts

## Step 5: (Optional) Validate backend lifecycle symmetry
- Inspect Laravel controller methods for `completeSchedule`, `startReturnTrip`, `completeReturnTrip`
- Ensure schedule fields `trip_leg`, `leg_status`, `return_trip_status` match frontend expectations

## Step 6: Test loop
- Verify repeated alternating legs: Cebu→Mandaue then Mandaue→Cebu without stalling
- Verify bus marker moves smoothly back without teleporting

