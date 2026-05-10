<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        
        switch ($user->role) {
            case 'admin':
            case 'operator':
                return redirect()->route('panel.operator');
            default:
                return redirect()->route('panel.operator');
        }
    }
}