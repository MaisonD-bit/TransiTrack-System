# TransiTrack System - Updated Use Case Diagram Reference

**Last Updated:** June 2026  
**Status:** Current (reflects Bus Operator route stop workflow update)

---

## Overview

This document describes the updated use cases for all actors in the TransiTrack System. The diagram reflects the current workflow where **Bus Operators** handle route stop configuration before submission to **SysAdmin** for approval.

---

## Key Change Summary

| Previous Workflow | Updated Workflow |
|---|---|
| System creates/manages route stops | **Bus Operator creates and configures route stops** |
| Routes submitted directly to SysAdmin | Bus Operator submits stops → SysAdmin approves |
| "System" actor managing approvals | **SysAdmin** now explicitly handles route approval |

---

## Actors & Use Cases

### 1. **Commuters** (Mobile App)

**Primary Activities:**
- **View Bus Location** - Track real-time GPS location of buses on route
- **Browse Approved Routes** - Search and view available bus routes with schedules
- **Book Ticket** - Purchase and generate digital tickets for trips
- **View Schedule** - Check bus timetables and service hours
- **Submit Feedback** - Report issues or rate their experience

---

### 2. **Bus Driver** (Mobile App)

**Primary Activities:**
- **View Assigned Route** - See the route map, stops, and passenger locations
- **View Schedule** - Check daily driving assignments and timetable
- **Report Issues** - Report mechanical or operational problems
- **Track Location** - Enable GPS for real-time tracking

---

### 3. **Bus Operator** (Web Panel) ⭐ **UPDATED ROLE**

**Primary Activities:**

#### Route Management Workflow:
- **Request Route Approval** - Select routes to submit for stop configuration
- **Configure Route Stops** ⭐ **(NEW PRIMARY RESPONSIBILITY)**
  - Open interactive map for each route
  - Place and order bus stops along the route
  - Set estimated travel times between stops
  - Save stop configuration
- **Submit to SysAdmin** - Submit configured routes for SysAdmin approval

#### Operational Management:
- **Create Schedule** - Set timetables and frequencies for approved routes
- **Assign Driver** - Allocate drivers to scheduled trips
- **Manage Fleet** - Add/update bus information and status
- **Receive Issues and Announcements** - Get notifications from SysAdmin and Terminal Manager
- **Monitor Fleet** - View real-time bus locations and driver status

---

### 4. **Terminal Manager** (Web Panel)

**Primary Activities:**
- **Approve Operators** - Activate or deactivate bus operators at their terminal
- **Assign Terminal Space** - Allocate parking bays/zones for buses
- **Monitor Capacity** - Track terminal occupancy and space usage
- **Send Announcements** - Broadcast messages to drivers and operators
- **View Operator Status** - Check active operators and their details

---

### 5. **SysAdmin** (Web Panel) ⭐ **REPLACES "SYSTEM"**

**Primary Activities:**

#### Route Approval Process:
- **Review Route Stops** - Examine submitted route stop configurations with map visualization
- **Approve Route Configuration** - Accept stops and activate routes for operations
- **Decline Route Configuration** - Reject with feedback for Bus Operator to revise
- **Manage Route Status** - Control route lifecycle (pending → active → inactive)

#### System Oversight:
- **Manage System Users** - Create and manage accounts for all roles
- **Monitor System Health** - View overall platform status and analytics
- **Generate Reports** - Create system-wide operational reports

---

## Use Case Interactions & Data Flow

### Route Stop Configuration Workflow (NEW)

```
Bus Operator:
1. "Request Route Approval" 
   ↓
   (Routes selected, status: pending_stops)
   
2. "Configure Route Stops" 
   ↓
   (Operator opens map, adds stops, saves configuration)
   
3. "Submit to SysAdmin" 
   ↓
   (Status: pending_sysadmin, notification sent to SysAdmin)

SysAdmin:
4. "Review Route Stops" 
   ↓
   (View map with configured stops)
   
5a. "Approve Route Configuration" 
    ↓
    (Routes become active, operator notified)
    
5b. "Decline Route Configuration" 
    ↓
    (Send feedback, operator revises and resubmits)
```

### Schedule & Operations Workflow

```
Bus Operator:
6. "Create Schedule" 
   ↓
   (After routes approved, set timetables)
   
7. "Assign Driver" 
   ↓
   (Allocate drivers to trips)

Terminal Manager:
8. "Assign Terminal Space" 
   ↓
   (Allocate parking for buses)

Bus Driver:
9. "View Assigned Route" + "View Schedule" 
   ↓
   (Receive assignment notifications, check routes/times)

Commuters:
10. "Browse Approved Routes" → "Book Ticket" 
    ↓
    (See approved routes with schedules, purchase tickets)
    
11. "View Bus Location" 
    ↓
    (Track real-time bus position during trip)
```

---

## Main Features by Actor

### Commuters
- ✓ Route discovery and search
- ✓ Real-time bus tracking
- ✓ Schedule browsing
- ✓ Ticket booking
- ✓ Feedback submission

### Bus Driver
- ✓ Route/schedule viewing
- ✓ Location tracking (GPS)
- ✓ Issue reporting

### Bus Operator
- ✓ Route creation
- ✓ **Route stop configuration** ⭐
- ✓ Schedule creation
- ✓ Driver assignment
- ✓ Fleet monitoring
- ✓ Notifications

### Terminal Manager
- ✓ Operator approval/deactivation
- ✓ Terminal space allocation
- ✓ Capacity monitoring
- ✓ Announcements

### SysAdmin
- ✓ **Route stop approval** ⭐
- ✓ Route activation/deactivation
- ✓ User management
- ✓ System monitoring

---

## Key Relationships

| Actor 1 | Interaction | Actor 2 |
|---------|-------------|---------|
| Bus Operator | Submits route stops | SysAdmin |
| SysAdmin | Approves/declines routes | Bus Operator |
| Bus Operator | Assigns drivers | Bus Driver |
| Bus Operator | Requests space | Terminal Manager |
| Terminal Manager | Approves | Bus Operator |
| Bus Driver | Operates | Commuters |
| Commuters | Provide feedback | Bus Operator / SysAdmin |

---

## Diagram Structure for Recreation

### Left Side (Actors)
```
[Commuters]  →  use cases
[Bus Driver]  →  use cases
[Bus Operator]  →  use cases (with updated stops workflow)
[Terminal Manager]  →  use cases
[SysAdmin]  →  use cases (replacing System)
```

### Center (Use Cases)
**Grouped by domain:**

1. **Route Management**
   - Request Route Approval (Operator)
   - Configure Route Stops (Operator) ⭐
   - Review Route Stops (SysAdmin) ⭐
   - Approve/Decline Routes (SysAdmin) ⭐

2. **Operational Scheduling**
   - Create Schedule (Operator)
   - Assign Driver (Operator)
   - View Schedule (Driver, Terminal Manager)

3. **Terminal Operations**
   - Assign Terminal Space (Manager)
   - Monitor Capacity (Manager)

4. **Commuter Services**
   - Browse Routes (Commuters)
   - View Bus Location (Commuters)
   - Book Ticket (Commuters)
   - Submit Feedback (Commuters)

5. **Notifications & Communication**
   - Receive Issues & Announcements (all)
   - Send Announcements (Manager, SysAdmin)
   - Report Issues (Driver, Commuters)

6. **System Management**
   - Monitor System (SysAdmin)
   - Manage Users (SysAdmin)

---

## Notes for Diagram Recreation

1. **Remove** the old "System" actor
2. **Add/Update** "SysAdmin" as explicit actor for route approval
3. **Highlight** the new "Configure Route Stops" use case for Bus Operator
4. **Show relationship** between Bus Operator's "Configure Route Stops" → SysAdmin's "Review Route Stops"
5. **Focus on main features only** - remove minor/secondary features
6. **Use dashed lines** for includes/extends relationships where appropriate
7. **Organize spatially** with actors on sides and related use cases grouped in center
8. **Color code** (optional): Green for Commuter features, Blue for Operator features, Red for Admin features

---

## Updated vs. Legacy Features

### Features to **Keep**
- ✓ Browse Approved Routes (Commuters)
- ✓ View Bus Location (Commuters)
- ✓ Book Ticket (Commuters)
- ✓ Create Schedule (Operator)
- ✓ Assign Driver (Operator)
- ✓ View Schedule (Driver/Manager)
- ✓ Assign Terminal Space (Manager)
- ✓ Report Issues (Driver)

### Features to **Update**
- ✓ "Request Route Approval" → now includes stop configuration step
- ✓ "System" → "SysAdmin" (explicit actor)
- ✓ Route approval process now multi-step (configure → submit → review → approve)

### Features to **Remove** (Simplified)
- ✗ Generate Trip Summary (consolidate with reports)
- ✗ Update Current Location (implicit in View Bus Location)
- ✗ Monitor Fleet (consolidate with schedule management)

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 2026 | Updated workflow: Bus Operator now configures route stops before SysAdmin approval. Added explicit SysAdmin actor. |

