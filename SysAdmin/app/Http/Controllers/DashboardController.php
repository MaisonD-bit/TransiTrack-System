<?php

namespace App\Http\Controllers;

use App\Models\RouteApprovalRequest;
class DashboardController extends Controller
{
    public function index()
    {
        $pendingCount = RouteApprovalRequest::query()
            ->where('status', 'pending_sysadmin')
            ->count();

        return view('dashboard', compact('pendingCount'));
    }
}
