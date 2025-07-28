<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ChartController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

