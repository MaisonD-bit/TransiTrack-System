<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BusSchedulesController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\TerminalSpaceController;
use App\Http\Controllers\NorthTerminalSpaceController;
use App\Http\Controllers\ApprovalController;

// Register and Login Routes
Route::get('login', [UserController::class, 'login'])->name('login');
Route::post('login', [UserController::class, 'authenticate'])->name('authenticate');
Route::get('register', [UserController::class, 'register'])->name('register');
Route::post('register', [UserController::class, 'store'])->name('store');


Route::middleware(['auth'])->group(function () {

    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/api/dashboard/available-spaces', [DashboardController::class, 'getAvailableSpaces'])->name('dashboard.available-spaces');
    Route::get('/bus-schedule', [BusSchedulesController::class, 'index'])->name('bus-schedule');

    // Messages Routes
    Route::get('/messages', [MessageController::class, 'index'])->name('messages');
    Route::post('/messages', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/messages/{id}', [MessageController::class, 'show'])->name('messages.show');

    // Terminal Space Routes
    Route::get('/spaces', [TerminalSpaceController::class, 'index'])->name('spaces.index');

    // North Terminal Space Routes
    Route::get('/north-spaces', [NorthTerminalSpaceController::class, 'index'])->name('north-spaces.index');

    // Operator Approval Routes
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('approval');

    // API Routes for Operator Approvals
    Route::prefix('api/approvals')->group(function () {
        Route::get('/operators', [ApprovalController::class, 'getOperators']);
        Route::post('/approve/{id}', [ApprovalController::class, 'approve']);
        Route::post('/pending/{id}', [ApprovalController::class, 'pending']);
        Route::get('/stats', [ApprovalController::class, 'getStats']);
    });

    // API Routes for Terminal Space Management
    Route::prefix('api/terminal')->group(function () {
        Route::get('/drivers', [TerminalSpaceController::class, 'getDrivers']);
        Route::post('/occupy', [TerminalSpaceController::class, 'occupy']);
        Route::post('/release', [TerminalSpaceController::class, 'release']);
        Route::post('/add-time', [TerminalSpaceController::class, 'addTime']);
        Route::post('/cancel', [TerminalSpaceController::class, 'cancel']);
        Route::post('/update-space', [TerminalSpaceController::class, 'updateSpace']);
        Route::get('/history/{spaceId}', [TerminalSpaceController::class, 'getHistory']);
        Route::get('/history-all', [TerminalSpaceController::class, 'getAllHistory']);
        Route::get('/check-expired', [TerminalSpaceController::class, 'checkAndReleaseExpiredSpaces']);
        Route::get('/spaces', [TerminalSpaceController::class, 'getSpaces']);
        Route::get('/routes', [TerminalSpaceController::class, 'getRoutes']);
        Route::get('/driver-routes/{driverId}', [TerminalSpaceController::class, 'getDriverRoutes']);
        Route::get('/history-detail/{id}', [TerminalSpaceController::class, 'getHistoryDetail']);
        Route::post('/check-expired', [TerminalSpaceController::class, 'checkAndReleaseExpiredSpaces']);
    });

    // API Routes for North Terminal Space Management
    Route::prefix('api/north-terminal')->group(function () {
        Route::get('/drivers', [NorthTerminalSpaceController::class, 'getDrivers']);
        Route::post('/occupy', [NorthTerminalSpaceController::class, 'occupy']);
        Route::post('/release', [NorthTerminalSpaceController::class, 'release']);
        Route::post('/add-time', [NorthTerminalSpaceController::class, 'addTime']);
        Route::post('/cancel', [NorthTerminalSpaceController::class, 'cancel']);
        Route::post('/update-space', [NorthTerminalSpaceController::class, 'updateSpace']);
        Route::get('/history/{spaceId}', [NorthTerminalSpaceController::class, 'getHistory']);
        Route::get('/history-all', [NorthTerminalSpaceController::class, 'getAllHistory']);
        Route::get('/check-expired', [NorthTerminalSpaceController::class, 'checkAndReleaseExpiredSpaces']);
        Route::get('/spaces', [NorthTerminalSpaceController::class, 'getSpaces']);
        Route::get('/routes', [NorthTerminalSpaceController::class, 'getRoutes']);
        Route::get('/driver-routes/{driverId}', [NorthTerminalSpaceController::class, 'getDriverRoutes']);
        Route::get('/history-detail/{id}', [NorthTerminalSpaceController::class, 'getHistoryDetail']);
        Route::post('/check-expired', [NorthTerminalSpaceController::class, 'checkAndReleaseExpiredSpaces']);
    });

    // Chat Routes
    Route::get('/chat', [ChatController::class, 'index'])->name('chat');
    Route::post('/chat/channel', [ChatController::class, 'createChannel'])->name('chat.channel.create');
    Route::get('/chat/users', [ChatController::class, 'getUsers'])->name('chat.users');
    Route::post('/chat/register-users', [ChatController::class, 'registerUsers'])->name('chat.register.users');

    // Notification Routes
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->name('notifications.markAllRead');
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy'])->name('notifications.destroy');

    Route::post('logout', [UserController::class, 'logout'])->name('logout');
});
