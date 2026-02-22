<?php
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BusSchedulesController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\NotificationController;
        
// Register and Login Routes
Route::get('login', [UserController::class, 'login'])->name('login');
Route::post('login', [UserController::class, 'authenticate'])->name('authenticate');
Route::get('register', [UserController::class, 'register'])->name('register');
Route::post('register', [UserController::class, 'store'])->name('store');


Route::middleware(['auth'])->group(function () {

    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/bus-schedule', [BusSchedulesController::class, 'index'])->name('bus-schedule');

    // Messages Routes
    Route::get('/messages', [MessageController::class, 'index'])->name('messages');
    Route::post('/messages', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/messages/{id}', [MessageController::class, 'show'])->name('messages.show');

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



