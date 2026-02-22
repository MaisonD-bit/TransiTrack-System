<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Bus;
use App\Models\Message;
use App\Models\Space;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use GetStream\StreamChat\Client as StreamChat;

class DashboardController extends Controller
{

public function index()
{
    $user = Auth::user();
    
    $query = Schedule::with(['bus', 'driver', 'route']);

    // Filter schedules by terminal for bus managers
    if ($user && $user->role === 'northBusManager') {
        $query->whereHas('bus', function($q) {
            $q->where('terminal', 'north');
        });
    } elseif ($user && $user->role === 'southBusManager') {
        $query->whereHas('bus', function($q) {
            $q->where('terminal', 'south');
        });
    }

    // Get only recent 10 schedules for dashboard
    $busSchedules = $query->orderBy('date', 'desc')->limit(10)->get();

    $drivers = User::where('role', 'driver')->get();

    $statuses = ['scheduled', 'active', 'completed', 'cancelled'];

    // Build stats based on terminal
    $busQuery = Bus::whereIn('status', ['available', 'in_service']);
    $scheduleQuery = Schedule::query();
    
    if ($user && $user->role === 'northBusManager') {
        $busQuery->where('terminal', 'north');
        $scheduleQuery->whereHas('bus', function($q) {
            $q->where('terminal', 'north');
        });
    } elseif ($user && $user->role === 'southBusManager') {
        $busQuery->where('terminal', 'south');
        $scheduleQuery->whereHas('bus', function($q) {
            $q->where('terminal', 'south');
        });
    }
    
    // Spaces are shared across terminals
    $available = Space::where('is_occupied', false)->count();
    $total = Space::count();

    // Get unread messages count from Stream
    $unreadCount = 0;
    try {
        $streamClient = new StreamChat(
            env('STREAM_API_KEY'),
            env('STREAM_API_SECRET')
        );
        
        $channels = $streamClient->queryChannels(
            ['members' => ['$in' => [(string)$user->id]]],
            [],
            ['state' => true]
        );
        
        foreach ($channels['channels'] as $channel) {
            $unreadCount += $channel['channel']['read'][(string)$user->id]['unread_messages'] ?? 0;
        }
    } catch (\Exception $e) {
        $unreadCount = 0;
    }

    $stats = [
        'active_busses' => $busQuery->count(),
        'available_spaces' => $available,
        'total_spaces' => $total,
        'total_schedules' => $scheduleQuery->count(),
        'new_messages' => $unreadCount,
    ];

    return view('operations.dashboard', compact('stats', 'busSchedules', 'drivers', 'statuses'));
}

}