<?php

namespace App\Http\Controllers;

use App\Models\Bus;
use App\Models\Alert;
use App\Models\Message;
use App\Models\Space;
use Illuminate\Http\Request;

class DashboardController extends Controller
{

public function index()
{
    $available = Space::where('is_occupied', false)->count();
    $total     = Space::count();

    $stats = [
        'active_busses' => Bus::where('status', 'active')->count(),
        'available_spaces' => $available,
        'total_spaces' => $total,
        'active_alerts' => Alert::where('status', 'active')->count(),
        'new_messages' => Message::where('status', 'unread')->count(),
    ];

    return view('main.dashboard', compact('stats'));
}

}