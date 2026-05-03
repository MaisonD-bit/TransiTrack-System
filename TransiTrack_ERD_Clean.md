# TransiTrack Entity Relationship Diagram

## Entity Relationship Diagram

**BUS_OPERATOR**
- operator_id PK - string
- name - string
- email - string
- password - string
- contact_number - string
- date_of_birth - date
- gender - string
- address - string
- status - string
- photo_url - string
- company_name - string
- license_number - string
- email_verified_at - timestamp

**TERMINAL_MANAGER**
- manager_id PK - string
- name - string
- email - string
- password - string
- contact_number - string
- date_of_birth - date
- gender - string
- address - string
- status - string
- photo_url - string
- terminal_location - string
- authority_level - string
- email_verified_at - timestamp

**BUS_DRIVER**
- driver_id PK - string
- name - string
- email - string
- password - string
- contact_number - string
- date_of_birth - date
- gender - string
- address - string
- license_number - string
- license_expiry - date
- emergency_name - string
- emergency_relation - string
- emergency_contact - string
- status - string
- photo_url - string
- notes - string
- driving_experience - integer
- email_verified_at - timestamp

**COMMUTER**
- commuter_id PK - string
- name - string
- email - string
- password - string
- contact_number - string
- date_of_birth - date
- gender - string
- address - string
- status - string
- photo_url - string
- preferred_routes - string
- email_verified_at - timestamp

**TERMINAL**
- terminal_id PK - string
- name - string
- location - string
- latitude - decimal
- longitude - decimal
- manager_id FK - string
- capacity - integer
- facilities - string
- status - string
- description - string

**BUS**
- bus_id PK - string
- plate_number - string
- bus_number - string
- model - string
- capacity - integer
- bus_company - string
- accommodation_type - string
- status - string
- description - string

**ROUTE**
- route_id PK - string
- name - string
- code - string
- start_location - string
- end_location - string
- start_coordinates - string
- end_coordinates - string
- distance_km - decimal
- estimated_duration - integer
- description - string
- regular_price - decimal
- aircon_price - decimal
- status - string

**SCHEDULE**
- schedule_id PK - string
- route_id FK - string
- bus_id FK - string
- driver_id FK - string
- terminal_id FK - string
- date - date
- start_time - time
- end_time - time
- days - string
- status - string
- notes - string

**STOP**
- stop_id PK - string
- name - string
- latitude - decimal
- longitude - decimal
- description - string
- status - string

**ROUTE_STOP**
- route_stop_id PK - string
- route_id FK - string
- stop_id FK - string
- stop_order - integer
- estimated_minutes - integer

**TRIP_TRACKING**
- tracking_id PK - string
- schedule_id FK - string
- driver_id FK - string
- current_latitude - decimal
- current_longitude - decimal
- current_stop_id FK - string
- estimated_arrival - timestamp
- status - string
- last_updated - timestamp

**NOTIFICATION**
- notification_id PK - string
- user_id FK - string
- user_type - string
- title - string
- message - string
- type - string
- is_read - boolean
- created_at - timestamp

## Entity Relationships

**BUS_OPERATOR (one-to-many)-----manages-----(zero-to-many) BUS**
*Bus Operators manage multiple buses*

**BUS_OPERATOR (one-to-many)-----creates-----(zero-to-many) ROUTE**
*Bus Operators create and manage routes*

**TERMINAL_MANAGER (one-to-one)-----oversees-----(one-to-one) TERMINAL**
*Terminal Managers oversee specific terminals*

**TERMINAL_MANAGER (one-to-many)-----supervises-----(zero-to-many) SCHEDULE**
*Terminal Managers supervise schedules at their terminal*

**BUS_DRIVER (one-to-many)-----assigned_to-----(zero-to-many) SCHEDULE**
*Bus Drivers are assigned to multiple schedules*

**BUS_DRIVER (one-to-many)-----updates-----(zero-to-many) TRIP_TRACKING**
*Bus Drivers update real-time location tracking*

**COMMUTER (one-to-many)-----views-----(zero-to-many) TRIP_TRACKING**
*Commuters view real-time bus tracking information*

**TERMINAL (one-to-many)-----hosts-----(zero-to-many) SCHEDULE**
*Terminals host multiple scheduled departures*

**BUS (one-to-many)-----operates_on-----(zero-to-many) SCHEDULE**
*Each bus operates on multiple schedules*

**ROUTE (one-to-many)-----has-----(zero-to-many) SCHEDULE**
*Each route has multiple scheduled trips*

**ROUTE (one-to-many)-----contains-----(zero-to-many) ROUTE_STOP**
*Routes contain multiple stops in sequence*

**STOP (one-to-many)-----part_of-----(zero-to-many) ROUTE_STOP**
*Stops can be part of multiple routes*

**SCHEDULE (one-to-many)-----tracked_by-----(zero-to-many) TRIP_TRACKING**
*Schedules have real-time tracking information*

**BUS_OPERATOR (one-to-many)-----receives-----(zero-to-many) NOTIFICATION**
*Bus Operators receive operational notifications*

**TERMINAL_MANAGER (one-to-many)-----receives-----(zero-to-many) NOTIFICATION**
*Terminal Managers receive terminal-related notifications*

**BUS_DRIVER (one-to-many)-----receives-----(zero-to-many) NOTIFICATION**
*Bus Drivers receive schedule and trip notifications*

**COMMUTER (one-to-many)-----receives-----(zero-to-many) NOTIFICATION**
*Commuters receive schedule and route notifications*

**TRIP_TRACKING (one-to-many)-----triggers-----(zero-to-many) NOTIFICATION**
*Trip tracking updates trigger notifications to commuters*

**Entity Relationship Diagram (ERD) illustrates the core structure of the TransiTrack bus information system. It includes key entities such as Bus Operators, Terminal Managers, Bus Drivers, Commuters, Terminals, Buses, Routes, Schedules, Stops, Trip Tracking, and Notifications. Each entity stores relevant information and connects through defined relationships. Bus Operators manage buses and routes, Terminal Managers oversee terminals and supervise schedules, Bus Drivers are assigned to schedules and provide real-time updates, and Commuters access real-time bus information and tracking. The system supports comprehensive bus operation workflows, live tracking, and user notifications for an information-only transit system.**
