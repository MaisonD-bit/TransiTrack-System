<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\DriverController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\RouteController;
use App\Http\Controllers\BusController;
use App\Http\Controllers\PaymentController; 
use App\Http\Controllers\NotificationsController;
use App\Http\Controllers\CommuterRoutesController;
use App\Http\Controllers\CommuterController;
use App\Http\Controllers\TerminalParkingController;
use App\Http\Controllers\SupportTicketController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\MayaController;
use App\Http\Controllers\ChatController;

Route::prefix('v1')->group(function () {

    Route::post('/auth/login', [AuthController::class, 'apiLogin']);

    Route::post('/drivers/login', [DriverController::class, 'loginFromApp']);
    Route::post('/auth/register', [AuthController::class, 'apiRegister']);
    Route::post('/auth/logout', [AuthController::class, 'apiLogout']);
    Route::get('/auth/user', [AuthController::class, 'getAuthenticatedUser']);

    // Commuters authentication routes (for mobile app)
    Route::prefix('commuters')->group(function () {
        Route::post('/login', [AuthController::class, 'apiLogin']);
        Route::post('/register', [AuthController::class, 'apiRegister']);
        Route::post('/logout', [AuthController::class, 'apiLogout']);
        Route::get('/user', [AuthController::class, 'getAuthenticatedUser']);
        Route::put('/{id}/profile', [CommuterController::class, 'updateProfile']);
    });

    Route::get('/bus-operators', function () {
        return \App\Models\User::where('role', 'bus_operator')
            ->where('status', 'active')
            ->select('id', 'company_name')
            ->get();
    });
    
    Route::prefix('drivers')->group(function () {
        Route::get('/{driverId}/schedules', [ScheduleController::class, 'getDriverSchedules']);
        Route::get('/{id}/performance', [DriverController::class, 'performance']);
        Route::get('/{id}', [DriverController::class, 'show']);
        Route::post('/register', [DriverController::class, 'registerFromApp']);
        Route::put('/{id}/status', [DriverController::class, 'updateStatus']);
    });
    
    Route::prefix('schedules')->group(function () {
        Route::get('/active', [ScheduleController::class, 'getActiveSchedules'])->withoutMiddleware(['auth:sanctum']);
        
        Route::get('/', [ScheduleController::class, 'index']);
        
        Route::get('/{id}', [ScheduleController::class, 'show']);
        
        Route::put('/{id}/accept', [ScheduleController::class, 'acceptSchedule']);
        Route::put('/{id}/decline', [ScheduleController::class, 'declineSchedule']);
        Route::put('/{id}/start', [ScheduleController::class, 'startSchedule']);
        Route::put('/{id}/complete', [ScheduleController::class, 'completeSchedule']);
        Route::put('/{id}/update-position', [ScheduleController::class, 'updatePosition']);

        Route::post('/', [ScheduleController::class, 'assignToDriver']);
    });
    
    // Route information for mobile app
    Route::prefix('routes')->group(function () {
        // Use API-specific methods for mobile clients under versioned API
        Route::get('/', [RouteController::class, 'apiIndex']);
        Route::get('/{id}', [RouteController::class, 'apiShow']);
    });
    
    // Bus information for mobile app
    Route::prefix('buses')->group(function () {
        Route::get('/', [BusController::class, 'index']);
        Route::get('/{id}', [BusController::class, 'show']);
    });

    Route::get('/terminal/driver-space-status', [TerminalParkingController::class, 'driverSpaceStatus']);
    Route::post('/terminal/request-space-extension', [TerminalParkingController::class, 'requestExtension']);

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

    Route::get('drivers', [DriverController::class, 'index']);

    Route::get('commuter/approved-routes', [CommuterRoutesController::class, 'approvedRoutes']);
    Route::get('commuter/live-buses', [CommuterRoutesController::class, 'liveBuses']);
    Route::post('commuter/fare-preview', [CommuterRoutesController::class, 'farePreview']);
    Route::post('commuter/fare-segment', [CommuterRoutesController::class, 'fareSegment']);
    Route::post('commuter/fare-calculate', [CommuterRoutesController::class, 'fareCalculate']);
    Route::post('commuter/book-ticket', [CommuterRoutesController::class, 'bookTicket']);
    Route::post('commuter/alight', [CommuterRoutesController::class, 'alight']);
    Route::patch('commuter/tickets/{publicTicketId}/mark-paid', [CommuterRoutesController::class, 'markPaid']);
    Route::post('commuter/request-boarding', [CommuterRoutesController::class, 'requestBoarding']);
    Route::patch('commuter/boarding-requests/{id}/cancel', [CommuterRoutesController::class, 'cancelBoardingRequest']);
    Route::post('commuter/cancel-my-boarding-requests', [CommuterRoutesController::class, 'cancelMyBoardingRequests']);
    Route::get('schedules/{scheduleId}/manifest', [CommuterRoutesController::class, 'manifest']);
    Route::get('driver/stream-token', [ChatController::class, 'driverStreamToken']);

    // Feedback & ratings
    Route::post('feedbacks', [FeedbackController::class, 'store']);
    Route::get('feedbacks/commuter', [FeedbackController::class, 'commuterFeedback']);
    Route::get('feedbacks/pending', [FeedbackController::class, 'pendingForFeedback']);
    Route::get('feedbacks/driver/{driverId}', [FeedbackController::class, 'driverFeedback']);
    Route::delete('feedbacks', [FeedbackController::class, 'clearForCommuter']);
    Route::delete('feedbacks/{id}', [FeedbackController::class, 'destroy']);

    // Support tickets (commuter → operator)
    Route::post('support/tickets/create', [SupportTicketController::class, 'store']);
    Route::get('support/tickets', [SupportTicketController::class, 'index']);
    Route::get('support/tickets/{id}', [SupportTicketController::class, 'show']);
    Route::patch('support/tickets/{id}/status', [SupportTicketController::class, 'updateStatus']);

    // Payment — e-wallet simulation (GCash / PayMaya)
    Route::get('payments/ewallet/balance/{accountNumber}', [PaymentController::class, 'ewalletBalance']);
    Route::post('payments/ewallet/charge', [PaymentController::class, 'ewalletCharge']);
    Route::post('payments/ewallet/topup', [PaymentController::class, 'ewalletTopup']);

    // Payment — Stripe (credit card)
    Route::post('payments/stripe/charge', [PaymentController::class, 'createStripeCharge']);
    Route::get('payments/stripe/intent/{id}', [PaymentController::class, 'getIntentStatus']);

    // Payment — Maya (PayMaya) real checkout
    Route::post('payments/maya/checkout', [MayaController::class, 'createCheckout']);
});

// Simple simulated checkout page (development only)
Route::get('/simulated-checkout', function (Request $request) {
    $amount = $request->query('amount');
    $ref = $request->query('ref');
    $route = $request->query('route');
    return response()->make("<html><body><h1>Simulated Checkout</h1><p>Amount: {$amount}</p><p>Ref: {$ref}</p><p>Route: {$route}</p><p><a href='/'>Return to app</a></p></body></html>");
});

// Legacy routes for backward compatibility (these might be used by your web panel AJAX calls)
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    
    // Web panel API routes
    Route::get('/schedules/{id}', [ScheduleController::class, 'show']);
    Route::get('/drivers/{id}', [DriverController::class, 'show']);
});

// Alternative routes without version prefix (for your current Ionic setup)
Route::group(['middleware' => 'api'], function () {
    
    // Commuter app API routes
    Route::get('routes', [RouteController::class, 'apiIndex']);
    Route::get('routes/{id}', [RouteController::class, 'apiShow']);
    Route::get('buses', [BusController::class, 'apiIndex']);
    Route::get('buses/{id}', [BusController::class, 'apiShow']);
    
    // Driver schedules - THE MAIN ROUTE YOUR IONIC APP NEEDS
    Route::get('drivers/{driverId}/schedules', [ScheduleController::class, 'getDriverSchedules']);
    
    // Schedule actions
    Route::post('schedules/{id}/accept', [ScheduleController::class, 'acceptSchedule']);
    Route::put('schedules/{id}/decline', [ScheduleController::class, 'declineSchedule']);
    Route::put('schedules/{id}/start', [ScheduleController::class, 'startSchedule']);
    Route::put('schedules/{id}/complete', [ScheduleController::class, 'completeSchedule']);
    Route::put('schedules/{id}/update-position', [ScheduleController::class, 'updatePosition']);
    Route::put('schedules/{id}/cancel', [ScheduleController::class, 'cancelSchedule']);
    Route::put('schedules/{id}/approve-cancel', [ScheduleController::class, 'approveCancellation']);
    Route::put('schedules/{id}/reject-cancel', [ScheduleController::class, 'rejectCancellation']);
    Route::put('schedules/{id}/approve-decline', [ScheduleController::class, 'approveDecline']);
    Route::put('schedules/{id}/reject-decline', [ScheduleController::class, 'rejectDecline']);
    
    // Other API endpoints
    Route::get('schedules', [ScheduleController::class, 'index']);
    Route::get('schedules/active', [ScheduleController::class, 'getActiveSchedules']); // Get only active schedules (must be before schedules/{id})
    Route::get('schedules/{id}', [ScheduleController::class, 'show']);
    Route::post('schedules', [ScheduleController::class, 'assignToDriver']);
    
    Route::get('drivers/{id}', [DriverController::class, 'show']);
    Route::get('drivers/{id}/performance', [DriverController::class, 'performance']);
    Route::get('drivers', [DriverController::class, 'index']);

});