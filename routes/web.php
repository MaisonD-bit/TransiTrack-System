<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\BusSchedulesController;
use App\Http\Controllers\Crud\SpaceCrudController;
use App\Http\Controllers\Crud\DriverCrudController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
Route::get('/schedule-management', [BusSchedulesController::class, 'index'])->name('schedule-management');

Route::resource('spaces', SpaceCrudController::class);
Route::resource('drivers', DriverCrudController::class);
