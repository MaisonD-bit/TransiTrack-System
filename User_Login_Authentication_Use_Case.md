# USER LOGIN AND AUTHENTICATION USE CASE

**Use Case:** User Login and Authentication

**Pre-condition:** 
- User has a valid registered account in the TransiTrack system
- User has access to the appropriate platform (web dashboard for operators/drivers, mobile app for commuters)
- System database is operational and accessible
- Network connectivity is available

**Post-condition:** 
- User is successfully authenticated and logged into the system
- User session is established with appropriate role-based permissions
- User is redirected to their respective dashboard/interface
- Authentication token is generated and stored for session management
- User activity is logged in the system

## Main Success Scenario:

**Actor Action 1:** User accesses the TransiTrack login interface (web dashboard or mobile app)

**System Response 1:** System displays the login form with email and password fields, along with "Remember Me" option and terminal selection (for operators/drivers)

**Actor Action 2:** User enters their registered email address in the email field

**System Response 2:** System validates the email format and highlights the field as valid input

**Actor Action 3:** User enters their password in the password field

**System Response 3:** System masks the password input for security and enables the login button

**Actor Action 4:** User selects their assigned terminal from the dropdown menu (applicable for operators and drivers)

**System Response 4:** System displays the selected terminal and validates terminal assignment permissions

**Actor Action 5:** User optionally checks the "Remember Me" checkbox for persistent login

**System Response 5:** System acknowledges the remember preference setting

**Actor Action 6:** User clicks the "Login" button to submit authentication credentials

**System Response 6:** System validates credentials against the database, verifies terminal assignment, checks user role permissions, and processes authentication request

**Actor Action 7:** User waits for authentication verification

**System Response 7:** System generates authentication token, establishes user session, logs login activity, and redirects user to their role-specific dashboard (Operator Panel, Driver Dashboard, or Commuter Interface)

## Alternative Scenarios:

### Alternative Scenario A: Invalid Credentials
**Actor Action A1:** User enters incorrect email or password combination

**System Response A1:** System displays error message "Invalid credentials. Please check your email and password." and returns to login form with fields cleared

### Alternative Scenario B: Terminal Access Restriction
**Actor Action B1:** Operator or driver attempts to access from unauthorized terminal

**System Response B1:** System displays error message "Access denied. You are not authorized to access this terminal." and prevents login

### Alternative Scenario C: Account Locked/Suspended
**Actor Action C1:** User attempts to login with suspended or locked account

**System Response C1:** System displays appropriate message "Account temporarily suspended. Please contact administrator." and prevents access

### Alternative Scenario D: Network Connectivity Issues
**Actor Action D1:** User submits login form during network interruption

**System Response D1:** System displays connection error message "Unable to connect. Please check your internet connection and try again."

### Alternative Scenario E: Password Reset Request
**Actor Action E1:** User clicks "Forgot Password?" link on login form

**System Response E1:** System redirects to password reset form and prompts for email address

**Actor Action E2:** User enters email address for password reset

**System Response E2:** System sends password reset email with secure token and displays confirmation message

## Exception Scenarios:

### Exception Scenario 1: Database Connection Failure
**System Response:** System displays maintenance message "System temporarily unavailable. Please try again later." and logs technical error for administrator review

### Exception Scenario 2: Authentication Service Timeout
**System Response:** System displays timeout error "Login request timed out. Please try again." and allows user to retry authentication

### Exception Scenario 3: Maximum Login Attempts Exceeded
**Actor Action:** User exceeds maximum failed login attempts (5 attempts)

**System Response:** System temporarily locks account for 15 minutes and displays "Too many failed attempts. Account temporarily locked. Try again in 15 minutes."
