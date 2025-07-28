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
    $stats = [
        'active_busses' => Bus::where('status', 'active')->count(),
        'available_spaces' => Space::where('is_occupied', false)->count(),
        'active_alerts' => Alert::where('status', 'active')->count(),
        'new_messages' => Message::where('status', 'unread')->count(),
    ];

    return view('main.dashboard', compact('stats'));
}

}