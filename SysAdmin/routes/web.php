<?php

use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\Auth\SysadminLoginController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/login', [SysadminLoginController::class, 'create'])->name('sysadmin.login');
Route::post('/login', [SysadminLoginController::class, 'store'])->name('sysadmin.login.store');

Route::middleware('auth:sysadmin')->group(function () {
    Route::post('/logout', [SysadminLoginController::class, 'destroy'])->name('sysadmin.logout');
    Route::get('/', fn () => redirect()->route('sysadmin.dashboard'));
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('sysadmin.dashboard');
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('sysadmin.approvals');
    Route::get('/approvals/poll', [ApprovalController::class, 'poll'])->name('sysadmin.approvals.poll');
    Route::get('/approvals/{routeApprovalRequest}/review', [ApprovalController::class, 'review'])->name('sysadmin.approvals.review');
    Route::post('/approvals/{routeApprovalRequest}/approve', [ApprovalController::class, 'approve'])->name('sysadmin.approvals.approve');
    Route::post('/approvals/{routeApprovalRequest}/decline', [ApprovalController::class, 'decline'])->name('sysadmin.approvals.decline');
});
