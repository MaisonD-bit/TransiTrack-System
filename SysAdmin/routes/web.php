<?php

use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\Auth\SysadminLoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ManagerApprovalController;
use App\Http\Controllers\RouteController;
use Illuminate\Support\Facades\Route;

Route::get('/login', [SysadminLoginController::class, 'create'])->name('sysadmin.login');
Route::post('/login', [SysadminLoginController::class, 'store'])->name('sysadmin.login.store');

Route::middleware('auth:sysadmin')->group(function () {
    Route::post('/logout', [SysadminLoginController::class, 'destroy'])->name('sysadmin.logout');
    Route::get('/', fn () => redirect()->route('sysadmin.dashboard'));
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('sysadmin.dashboard');
    Route::get('/dashboard/poll', [DashboardController::class, 'poll'])->name('sysadmin.dashboard.poll');
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('sysadmin.approvals');
    Route::get('/approvals/poll', [ApprovalController::class, 'poll'])->name('sysadmin.approvals.poll');
    Route::get('/approvals/{routeApprovalRequest}/review', [ApprovalController::class, 'review'])->name('sysadmin.approvals.review');
    Route::post('/approvals/{routeApprovalRequest}/approve', [ApprovalController::class, 'approve'])->name('sysadmin.approvals.approve');
    Route::post('/approvals/{routeApprovalRequest}/decline', [ApprovalController::class, 'decline'])->name('sysadmin.approvals.decline');

    Route::get('/manager-approvals', [ManagerApprovalController::class, 'index'])->name('sysadmin.manager-approvals');
    Route::post('/manager-approvals/{id}/approve', [ManagerApprovalController::class, 'approve'])->name('sysadmin.manager-approvals.approve');
    Route::post('/manager-approvals/{id}/deactivate', [ManagerApprovalController::class, 'deactivate'])->name('sysadmin.manager-approvals.deactivate');

    Route::get('/routes', [RouteController::class, 'index'])->name('sysadmin.routes');
    Route::post('/routes', [RouteController::class, 'store'])->name('sysadmin.routes.store');
    Route::put('/routes/{id}', [RouteController::class, 'update'])->name('sysadmin.routes.update');
    Route::delete('/routes/{id}', [RouteController::class, 'destroy'])->name('sysadmin.routes.destroy');

    Route::prefix('api')->group(function () {
        Route::get('/routes/{id}', [RouteController::class, 'show'])->name('sysadmin.api.routes.show');
    });
});
