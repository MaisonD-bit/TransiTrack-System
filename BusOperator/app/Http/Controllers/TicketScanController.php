<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Schedule;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TicketScanController extends Controller
{
    /**
     * Driver scans QR and validates boarding.
     * POST /api/v1/tickets/scan-validate
     * Body: { driver_id: number, token: string } where token is either:
     * - "v1.<base64url(json)>.<hexsig>" OR
     * - JSON string like {"token":"v1...."}
     */
    public function scanValidate(Request $request)
    {
        $data = $request->validate([
            'driver_id' => ['required', 'integer', 'exists:drivers,id'],
            'token' => ['required', 'string'],
        ]);

        $driverId = (int) $data['driver_id'];
        $token = $this->extractToken((string) $data['token']);
        if ($token === null) {
            return response()->json(['success' => false, 'message' => 'Invalid QR payload.'], 422);
        }

        $payload = $this->verifyAndDecodeToken($token);
        if (! $payload) {
            return response()->json(['success' => false, 'message' => 'Invalid or tampered QR code.'], 422);
        }

        $publicTicketId = (string) ($payload['ticket_id'] ?? '');
        $scheduleId = (int) ($payload['schedule_id'] ?? 0);
        if ($publicTicketId === '' || $scheduleId <= 0) {
            return response()->json(['success' => false, 'message' => 'QR missing required fields.'], 422);
        }

        $ticket = Ticket::query()
            ->where('public_ticket_id', $publicTicketId)
            ->where('schedule_id', $scheduleId)
            ->first();

        if (! $ticket) {
            return response()->json(['success' => false, 'message' => 'Ticket not found.'], 404);
        }

        if ($ticket->boarded_at !== null) {
            // Allow re-scans: return details but do NOT change state.
            $schedule = Schedule::query()->with(['route', 'bus', 'user'])->find($scheduleId);
            return response()->json([
                'success' => true,
                'message' => 'Ticket already boarded.',
                'data' => [
                    'status' => 'already_boarded',
                    'ticket_id' => $ticket->public_ticket_id,
                    'route_id' => $schedule?->route?->id,
                    'route_name' => $schedule?->route?->name ?? '',
                    'operator_company' => $schedule?->user?->company_name ?? '',
                    'bus_number' => $schedule?->bus?->bus_number ?? ($schedule?->bus?->plate_number ?? ''),
                    'fare' => (float) $ticket->fare,
                    'payment_method' => strtolower((string) ($ticket->payment_method ?? 'cash')),
                    'payment_status' => (string) $ticket->payment_status,
                    'boarded_at' => $this->asIso8601($ticket->boarded_at),
                ],
            ], 200);
        }

        if ($ticket->alighted_at !== null) {
            $schedule = Schedule::query()->with(['route', 'bus', 'user'])->find($scheduleId);
            return response()->json([
                'success' => true,
                'message' => 'Ticket already completed (alighted).',
                'data' => [
                    'status' => 'already_alighted',
                    'ticket_id' => $ticket->public_ticket_id,
                    'route_id' => $schedule?->route?->id,
                    'route_name' => $schedule?->route?->name ?? '',
                    'operator_company' => $schedule?->user?->company_name ?? '',
                    'bus_number' => $schedule?->bus?->bus_number ?? ($schedule?->bus?->plate_number ?? ''),
                    'fare' => (float) $ticket->fare,
                    'payment_method' => strtolower((string) ($ticket->payment_method ?? 'cash')),
                    'payment_status' => (string) $ticket->payment_status,
                    'boarded_at' => $this->asIso8601($ticket->boarded_at),
                ],
            ], 200);
        }

        $schedule = Schedule::query()->with(['route', 'bus', 'user'])->find($scheduleId);
        if (! $schedule) {
            return response()->json(['success' => false, 'message' => 'Schedule not found.'], 404);
        }

        if ((int) $schedule->driver_id !== $driverId) {
            return response()->json(['success' => false, 'message' => 'This ticket is not for your trip.'], 403);
        }

        // Prepaid rules: QR must only validate if paid for non-cash.
        $method = strtolower((string) ($ticket->payment_method ?? 'cash'));
        if ($method !== 'cash' && (string) $ticket->payment_status !== 'paid') {
            return response()->json([
                'success' => false,
                'message' => 'Payment not confirmed for this ticket.',
                'data' => ['status' => 'unpaid'],
            ], 422);
        }

        // Mark boarded (single-use).
        $ticket->boarded_at = now();
        $ticket->boarded_by_driver_id = $driverId;
        $ticket->save();

        return response()->json([
            'success' => true,
            'message' => 'Valid ticket.',
            'data' => [
                'ticket_id' => $ticket->public_ticket_id,
                'route_id' => $schedule->route?->id,
                'route_name' => $schedule->route?->name ?? '',
                'operator_company' => $schedule->user?->company_name ?? '',
                'bus_number' => $schedule->bus?->bus_number ?? ($schedule->bus?->plate_number ?? ''),
                'fare' => (float) $ticket->fare,
                'payment_method' => $method,
                'payment_status' => (string) $ticket->payment_status,
                'boarded_at' => $this->asIso8601($ticket->boarded_at),
            ],
        ]);
    }

    private function asIso8601(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        try {
            if ($value instanceof \DateTimeInterface) {
                return Carbon::instance($value)->toIso8601String();
            }
            if (is_string($value) && trim($value) !== '') {
                return Carbon::parse($value)->toIso8601String();
            }
        } catch (\Throwable) {
            return null;
        }
        return null;
    }

    private function extractToken(string $raw): ?string
    {
        $s = trim($raw);
        if ($s === '') return null;

        if (str_starts_with($s, 'v1.')) {
            return $s;
        }

        // Sometimes scanner returns the whole JSON string that commuter embedded.
        if ($s[0] === '{') {
            try {
                $obj = json_decode($s, true, 4, JSON_THROW_ON_ERROR);
                $t = isset($obj['token']) ? trim((string) $obj['token']) : '';
                return $t !== '' && str_starts_with($t, 'v1.') ? $t : null;
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }

    private function verifyAndDecodeToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3 || $parts[0] !== 'v1') {
            return null;
        }

        [$v, $data, $sig] = $parts;

        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            $key = base64_decode(substr($key, 7)) ?: '';
        }

        $expect = hash_hmac('sha256', $data, $key);
        if (! hash_equals($expect, $sig)) {
            return null;
        }

        $json = base64_decode(strtr($data, '-_', '+/'), true);
        if ($json === false) {
            // base64url may omit padding
            $pad = strlen($data) % 4;
            $dataPadded = $data . ($pad ? str_repeat('=', 4 - $pad) : '');
            $json = base64_decode(strtr($dataPadded, '-_', '+/'), true);
            if ($json === false) return null;
        }

        $decoded = json_decode((string) $json, true);
        return is_array($decoded) ? $decoded : null;
    }
}

