<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Schedule;
use App\Models\Ticket;
use App\Support\TicketBoarding;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

class TripController extends Controller
{
    public function index(Request $request)
    {
        $userId = Auth::id();
        $date = $this->resolveTripDate($request);

        $data = $this->buildTripPanelData((int) $userId, $date);

        return view('panels.trips', [
            'date' => $data['date'],
            'tripRows' => $data['tripRows'],
            'totalRevenue' => $data['totalRevenue'],
            'mapCenter' => $data['mapCenter'],
            'tripPollChecksum' => $data['checksum'],
            'incidentMarkers' => $data['incidentMarkers'],
        ]);
    }

    /**
     * JSON snapshot for live refresh while the operator stays on Trip Logs.
     */
    public function poll(Request $request): JsonResponse
    {
        $userId = Auth::id();
        if (! $userId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $date = $this->resolveTripDate($request);
        $data = $this->buildTripPanelData((int) $userId, $date);

        $rows = $data['tripRows']->map(function (array $row) {
            unset($row['schedule']);

            return $row;
        })->values()->all();

        return response()->json([
            'success' => true,
            'checksum' => $data['checksum'],
            'date' => $data['date'],
            'totalRevenue' => $data['totalRevenue'],
            'rows' => $rows,
            'incidentMarkers' => $data['incidentMarkers'],
        ]);
    }

    private function resolveTripDate(Request $request): Carbon
    {
        $tz = 'Asia/Manila';
        $dateInput = $request->input('date', Carbon::now($tz)->toDateString());

        try {
            return Carbon::parse($dateInput, $tz)->startOfDay();
        } catch (\Throwable) {
            return Carbon::today($tz)->startOfDay();
        }
    }

    /**
     * @return array{date: string, tripRows: Collection<int, array<string, mixed>>, totalRevenue: float, mapCenter: array{0: float, 1: float}, checksum: string}
     */
    private function buildTripPanelData(int $userId, Carbon $date): array
    {
        $schedules = Schedule::query()
            ->where('user_id', $userId)
            ->whereDate('date', $date)
            ->with(['route', 'driver', 'bus'])
            ->orderBy('start_time')
            ->get();

        $scheduleIds = $schedules->pluck('id');
        $ticketsBySchedule = Ticket::query()
            ->whereIn('schedule_id', $scheduleIds)
            ->orderBy('id')
            ->get()
            ->groupBy('schedule_id');

        $tripRows = $schedules->map(function (Schedule $s) use ($ticketsBySchedule) {
            $tickets = ($ticketsBySchedule->get($s->id) ?? collect())
                ->sortByDesc('id')
                ->values();
            $ticketCount = $tickets->count();
            $revenue = (float) $tickets->sum(fn (Ticket $t) => (float) $t->fare);
            $capacity = (int) ($s->bus?->capacity ?? 0);
            $aboard = $ticketCount > 0
                ? TicketBoarding::aboardCount($tickets, $capacity)
                : (int) ($s->passengers ?? 0);
            $latestIds = $tickets->take(3)->pluck('public_ticket_id')->filter()->values();

            return [
                'schedule' => $s,
                'route_name' => $s->route?->name ?? '—',
                'driver_name' => $s->driver?->name ?? '—',
                'bus_company' => $s->bus?->bus_company ?? '—',
                'bus_type' => $s->bus?->accommodation_type ?? $s->route?->bus_type ?? '—',
                'capacity' => $capacity,
                'boarded' => $aboard,
                'ticket_count' => $ticketCount,
                'revenue' => $revenue,
                'ticket_id_latest' => $latestIds->first() ?? '—',
                'ticket_id_sample' => $latestIds->isNotEmpty() ? $latestIds->join(', ') : '—',
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

        $incidentMarkers = Notification::query()
            ->where('recipient_id', $userId)
            ->whereNull('sender_id')
            ->where('type', 'incident')
            ->whereDate('created_at', $date)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Notification $n) => [
                'id' => $n->id,
                'lng' => (float) $n->longitude,
                'lat' => (float) $n->latitude,
                'label' => $n->location_label,
                'message' => $n->message,
            ])
            ->values()
            ->all();

        $checksumPayload = [
            'total' => round($totalRevenue, 2),
            'n' => $tripRows->count(),
            'rows' => $tripRows->map(fn (array $r) => [
                $r['ticket_count'],
                round($r['revenue'], 2),
                (string) $r['ticket_id_latest'],
                (string) $r['ticket_id_sample'],
                (int) $r['boarded'],
            ])->values()->all(),
            'incidents' => array_map(
                fn (array $m) => [$m['id'], $m['lat'], $m['lng']],
                $incidentMarkers
            ),
        ];
        $checksum = md5(json_encode($checksumPayload));

        return [
            'date' => $date->toDateString(),
            'tripRows' => $tripRows,
            'totalRevenue' => $totalRevenue,
            'mapCenter' => $mapCenter,
            'checksum' => $checksum,
            'incidentMarkers' => $incidentMarkers,
        ];
    }
}
