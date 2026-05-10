<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class TerminalParkingController extends Controller
{
    public function driverSpaceStatus(Request $request)
    {
        $request->validate([
            'driver_id' => 'required|integer|exists:drivers,id',
        ]);

        $space = DB::table('terminal_spaces')
            ->where('current_driver_id', $request->driver_id)
            ->where('is_occupied', 1)
            ->first();

        if (!$space) {
            return response()->json([
                'success' => true,
                'occupied' => false,
            ]);
        }

        $availableAt = Carbon::parse($space->available_at);
        $remainingSeconds = max(0, $availableAt->getTimestamp() - now()->getTimestamp());

        $pending = $space->pending_extension_minutes !== null
            ? (int) $space->pending_extension_minutes
            : null;
        $requestUsed = (bool) $space->terminal_extension_request_used;

        $canRequest = $remainingSeconds > 0
            && $remainingSeconds <= 300
            && !$requestUsed
            && $pending === null;

        return response()->json([
            'success' => true,
            'occupied' => true,
            'space_id' => $space->space_id,
            'available_at' => $availableAt->toIso8601String(),
            'remaining_seconds' => $remainingSeconds,
            'pending_extension_minutes' => $pending,
            'extension_request_used' => $requestUsed,
            'can_request_extension' => $canRequest,
        ]);
    }

    public function requestExtension(Request $request)
    {
        $request->validate([
            'driver_id' => 'required|integer|exists:drivers,id',
            'additional_minutes' => 'required|integer|min:5|max:20',
        ]);

        return DB::transaction(function () use ($request) {
            $space = DB::table('terminal_spaces')
                ->where('current_driver_id', $request->driver_id)
                ->where('is_occupied', 1)
                ->lockForUpdate()
                ->first();

            if (!$space) {
                return response()->json(['success' => false, 'message' => 'No active terminal bay assignment'], 400);
            }

            if ($space->terminal_extension_request_used) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already submitted your extension request for this bay stay.',
                ], 400);
            }

            if ($space->pending_extension_minutes !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'An extension request is already waiting for the terminal manager.',
                ], 400);
            }

            $remainingSeconds = max(0, Carbon::parse($space->available_at)->getTimestamp() - now()->getTimestamp());
            if ($remainingSeconds <= 0 || $remainingSeconds > 300) {
                return response()->json([
                    'success' => false,
                    'message' => 'Extension requests are only available when 5 minutes or less remain on your bay timer.',
                ], 400);
            }

            DB::table('terminal_spaces')
                ->where('space_id', $space->space_id)
                ->update([
                    'pending_extension_minutes' => $request->additional_minutes,
                    'terminal_extension_request_used' => true,
                    'updated_at' => now(),
                ]);

            $driver = Driver::find($request->driver_id);
            $this->notifyTerminalManagersExtensionRequest($space, $driver, (int) $request->additional_minutes);

            if ($space->current_company_id) {
                Notification::create([
                    'type' => 'terminal_parking_extension_pending',
                    'message' => 'Your request for +'.$request->additional_minutes." minutes at bay {$space->space_id} was sent to the terminal manager.",
                    'sender_id' => $space->current_company_id,
                    'driver_id' => $request->driver_id,
                    'is_read' => false,
                ]);
            }

            return response()->json(['success' => true, 'message' => 'Extension request sent to the terminal manager']);
        });
    }

    private function notifyTerminalManagersExtensionRequest(object $space, ?Driver $driver, int $minutes): void
    {
        $driverName = $driver?->name ?? 'A driver';
        $message = "{$driverName} requested +{$minutes} minutes for bay {$space->space_id}. Open Spaces → select the bay → Approve or Deny extension.";
        $payload = json_encode([
            'message' => $message,
            'space_id' => $space->space_id,
            'driver_id' => $space->current_driver_id,
            'additional_minutes' => $minutes,
        ]);

        $managerIds = DB::table('managers')
            ->where('status', 'active')
            ->where('role', 'terminalManager')
            ->pluck('id');

        foreach ($managerIds as $mid) {
            DB::table('manager_notifications')->insert([
                'id' => (string) Str::uuid(),
                'type' => 'terminal_space_extension_request',
                'notifiable_type' => 'App\\Models\\User',
                'notifiable_id' => $mid,
                'data' => $payload,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
