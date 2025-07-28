<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Bus;
use App\Models\Alert;
use App\Models\Message;
use App\Models\Space;

class ChartController extends Controller
{
    // public function activeBusses() {
    //     $count = Bus::where('status', 'active')->count();
    //     return response()->json(['active_busses' => $count]);
    // }

    // public function alerts() {
    //     $count = Alert::where('status', 'unresolved')->count();
    //     return response()->json(['alerts' => $count]);
    // }

    // public function newMessages() {
    //     $count = Message::where('is_read', false)->count();
    //     return response()->json(['new_messages' => $count]);
    // }

    // public function availableSpaces() {
    //     $count = Space::where('is_occupied', false)->count();
    //     return response()->json(['available_spaces' => $count]);
    // }
}
