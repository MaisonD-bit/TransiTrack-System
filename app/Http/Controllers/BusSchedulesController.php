<?php

namespace App\Http\Controllers;

use App\Models\BusSchedule;
use Illuminate\Http\Request;

class BusSchedulesController extends Controller
{
    public function index() 
    {
        $schedules = BusSchedule::with(['bus', 'driver', 'route'])->get();

        return view('operations.schedule-management', compact('schedules'));
    }
}
