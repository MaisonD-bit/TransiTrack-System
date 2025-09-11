<?php
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BusSchedulesController;
use App\Http\Controllers\RentalManagementController;
use App\Http\Controllers\MessageController;

use App\Http\Controllers\Crud\SpaceCrudController;
use App\Http\Controllers\Crud\RouteCrudController;
use App\Http\Controllers\Crud\BusCrudController;
use App\Http\Controllers\Crud\ScheduleCrudController;
use App\Models\User;

Route::get('login', [UserController::class, 'login'])->name('login');
Route::post('login', [UserController::class, 'authenticate'])->name('authenticate');

Route::get('register', [UserController::class, 'register'])->name('register');
Route::post('register', [UserController::class, 'store'])->name('store');


Route::resource('spaces', SpaceCrudController::class);
Route::resource('routes', RouteCrudController::class);
Route::resource('bus', BusCrudController::class);
Route::resource('schedules', ScheduleCrudController::class);


Route::middleware(['auth'])->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/schedule-management', [BusSchedulesController::class, 'index'])->name('schedule-management');
    Route::get('/rental-management', [RentalManagementController::class, 'index'])->name('rental-management');
    Route::get('/message-management', [MessageController::class, 'index'])->name('message-management');

    // Messages Routes
    Route::get('/messages', [MessageController::class, 'index'])->name('messages.index');
    Route::post('/messages', [MessageController::class, 'store'])->name('messages.store');
    Route::get('/messages/{id}', [MessageController::class, 'show'])->name('messages.show');

    Route::post('logout', [UserController::class, 'logout'])->name('logout');
});



