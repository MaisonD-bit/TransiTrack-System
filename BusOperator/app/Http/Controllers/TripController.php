<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Ticket;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TripController extends Controller
{
    public function index(Request $request)
    {
        $userId = Auth::id();
        $dateInput = $request->input('date', Carbon::today()->toDateString());

        try {
            $date = Carbon::parse($dateInput)->startOfDay();
        } catch (\Throwable) {
            $date = Carbon::today();
        }

        $schedules = Schedule::query()
            ->where('user_id', $userId)
            ->whereDate('date', $date)
            ->with(['route', 'driver', 'bus'])
            ->orderBy('start_time')
            ->get();

        $scheduleIds = $schedules->pluck('id');
        $ticketCountBySchedule = Ticket::query()
            ->whereIn('schedule_id', $scheduleIds)
            ->selectRaw('schedule_id, COUNT(*) as c, SUM(fare) as revenue')
            ->groupBy('schedule_id')
            ->get()
            ->keyBy('schedule_id');

        $sampleTicketIds = Ticket::query()
            ->whereIn('schedule_id', $scheduleIds)
            ->orderBy('id')
            ->get(['schedule_id', 'public_ticket_id'])
            ->groupBy('schedule_id');

        $tripRows = $schedules->map(function (Schedule $s) use ($ticketCountBySchedule, $sampleTicketIds) {
            $agg = $ticketCountBySchedule->get($s->id);
            $ticketCount = (int) ($agg->c ?? 0);
            $revenue = (float) ($agg->revenue ?? 0);
            $capacity = $s->bus?->capacity ?? 0;
            $boarded = $ticketCount > 0 ? $ticketCount : (int) ($s->passengers ?? 0);
            $ids = ($sampleTicketIds->get($s->id) ?? collect())->take(3)->pluck('public_ticket_id')->filter();

            return [
                'schedule' => $s,
                'route_name' => $s->route?->name ?? '—',
                'driver_name' => $s->driver?->name ?? '—',
                'bus_company' => $s->bus?->bus_company ?? '—',
                'bus_type' => $s->bus?->accommodation_type ?? $s->route?->bus_type ?? '—',
                'capacity' => $capacity,
                'boarded' => $boarded,
                'ticket_count' => $ticketCount,
                'revenue' => $revenue,
                'ticket_id_sample' => $ids->isNotEmpty() ? $ids->join(', ') : '—',
            ];
        });

        $totalRevenue = (float) Ticket::query()
            ->whereIn('schedule_id', $scheduleIds)
            ->sum('fare');

        $mapCenter = [123.8854, 10.3157];
        $first = $schedules->first();
        if ($first?->route?->start_coordinates) {
            $parts = explode(',', $first->route->start_coordinates);
            if (count($parts) === 2) {
                $mapCenter = [(float) trim($parts[0]), (float) trim($parts[1])];
            }
        }

        return view('panels.trips', [
            'date' => $date->toDateString(),
            'tripRows' => $tripRows,
            'totalRevenue' => $totalRevenue,
            'mapCenter' => $mapCenter,
        ]);
    }
}
