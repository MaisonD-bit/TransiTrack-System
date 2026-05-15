<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeedbackController extends Controller
{
    /** Submit feedback for a completed trip */
    public function store(Request $request)
    {
        $data = $request->validate([
            'commuter_id'        => ['nullable', 'integer', 'exists:commuters,id'],
            'public_ticket_id'   => ['nullable', 'string', 'max:64'],
            'schedule_id'        => ['nullable', 'integer'],
            'driver_rating'      => ['nullable', 'integer', 'min:1', 'max:5'],
            'service_rating'     => ['nullable', 'integer', 'min:1', 'max:5'],
            'cleanliness_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'safety_rating'      => ['nullable', 'integer', 'min:1', 'max:5'],
            'comment'            => ['nullable', 'string', 'max:1000'],
        ]);

        // Resolve driver and schedule — try ticket first, then direct schedule_id fallback
        $driverId   = null;
        $scheduleId = null;
        if (! empty($data['public_ticket_id'])) {
            $ticket = DB::table('tickets')
                ->where('public_ticket_id', $data['public_ticket_id'])
                ->first();
            if ($ticket) {
                $scheduleId = $ticket->schedule_id;
                $schedule   = Schedule::find($scheduleId);
                $driverId   = $schedule?->driver_id;
            }
        }
        // Fallback: use the schedule_id sent directly from the client
        if ($scheduleId === null && ! empty($data['schedule_id'])) {
            $scheduleId = $data['schedule_id'];
            $schedule   = Schedule::find($scheduleId);
            $driverId   = $schedule?->driver_id;
        }

        // Compute overall average from provided ratings
        $scores = array_filter([
            $data['driver_rating']      ?? null,
            $data['service_rating']     ?? null,
            $data['cleanliness_rating'] ?? null,
            $data['safety_rating']      ?? null,
        ], fn($v) => $v !== null);

        $overall = count($scores) > 0
            ? round(array_sum($scores) / count($scores), 2)
            : null;

        $feedback = Feedback::create([
            'commuter_id'        => $data['commuter_id'] ?? null,
            'driver_id'          => $driverId,
            'schedule_id'        => $scheduleId,
            'public_ticket_id'   => $data['public_ticket_id'] ?? null,
            'driver_rating'      => $data['driver_rating'] ?? null,
            'service_rating'     => $data['service_rating'] ?? null,
            'cleanliness_rating' => $data['cleanliness_rating'] ?? null,
            'safety_rating'      => $data['safety_rating'] ?? null,
            'overall_rating'     => $overall,
            'comment'            => $data['comment'] ?? null,
        ]);

        return response()->json(['success' => true, 'data' => $feedback]);
    }

    /** Get all feedback for a specific driver (operator panel) */
    public function driverFeedback(int $driverId)
    {
        $feedbacks = Feedback::with('commuter:id,name')
            ->where('driver_id', $driverId)
            ->latest()
            ->get();

        $avg = Feedback::where('driver_id', $driverId)
            ->whereNotNull('overall_rating')
            ->avg('overall_rating');

        return response()->json([
            'success'         => true,
            'data'            => $feedbacks,
            'average_rating'  => $avg ? round($avg, 2) : null,
            'total_reviews'   => $feedbacks->count(),
        ]);
    }

    /** Get feedback submitted by a commuter */
    public function commuterFeedback(Request $request)
    {
        $committerId = $request->query('commuter_id');
        $query = Feedback::with(['driver:id,name', 'schedule.route:id,name', 'schedule.bus:id,plate_number'])
            ->latest();

        if ($committerId) {
            $query->where('commuter_id', $committerId);
        }

        $feedbacks = $query->get()->map(function ($f) {
            return [
                'id'                  => (string) $f->id,
                'tripId'              => $f->public_ticket_id ?? '',
                'routeName'           => $f->schedule?->route?->name ?? '',
                'driverName'          => $f->driver?->name ?? '',
                'busPlateNumber'      => $f->schedule?->bus?->plate_number ?? '',
                'tripDate'            => $f->schedule?->date ?? $f->created_at?->toDateString() ?? '',
                'driverRating'        => (int) ($f->driver_rating ?? 0),
                'serviceRating'       => (int) ($f->service_rating ?? 0),
                'cleanlinessRating'   => (int) ($f->cleanliness_rating ?? 0),
                'safetyRating'        => (int) ($f->safety_rating ?? 0),
                'comment'             => $f->comment ?? '',
                'status'              => 'submitted',
                'submittedDate'       => $f->created_at?->toIso8601String(),
            ];
        });

        return response()->json(['success' => true, 'data' => $feedbacks]);
    }

    /** Delete a single feedback entry. */
    public function destroy(int $id): \Illuminate\Http\JsonResponse
    {
        Feedback::where('id', $id)->delete();
        return response()->json(['success' => true]);
    }

    /** Delete all feedback for a commuter. */
    public function clearForCommuter(Request $request): \Illuminate\Http\JsonResponse
    {
        $commuterId = $request->query('commuter_id');
        if (! $commuterId) {
            return response()->json(['success' => false, 'message' => 'commuter_id required'], 422);
        }
        Feedback::where('commuter_id', $commuterId)->delete();
        return response()->json(['success' => true]);
    }

    /** Pending trips for which feedback hasn't been submitted yet */
    public function pendingForFeedback(Request $request)
    {
        $commiterId = $request->query('commuter_id');
        if (! $commiterId) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $submittedTickets = Feedback::where('commuter_id', $commiterId)
            ->whereNotNull('public_ticket_id')
            ->pluck('public_ticket_id');

        $pending = DB::table('tickets')
            ->join('schedules', 'tickets.schedule_id', '=', 'schedules.id')
            ->join('routes', 'schedules.route_id', '=', 'routes.id')
            ->leftJoin('drivers', 'schedules.driver_id', '=', 'drivers.id')
            ->where('tickets.commuter_id', $commiterId)
            ->where('schedules.status', 'completed')
            ->whereNotIn('tickets.public_ticket_id', $submittedTickets)
            ->select(
                'tickets.public_ticket_id',
                'routes.name as route_name',
                'schedules.date',
                'drivers.name as driver_name',
                'schedules.driver_id',
                'tickets.fare'
            )
            ->latest('schedules.date')
            ->get();

        return response()->json(['success' => true, 'data' => $pending]);
    }
}
