<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\User; 
use App\Models\Driver;
use App\Models\Schedule;
use App\Models\Bus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class NotificationsController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return redirect()->route('login')->with('error', 'Unauthorized');
        }

        // ✅ FIXED: Get RECEIVED notifications (from drivers to me, where sender_id is NULL and I'm the recipient)
        $receivedQuery = Notification::with(['sender', 'driver', 'schedule', 'bus', 'routeApprovalRequest'])
            ->where('recipient_id', $user->id)
            ->whereNull('sender_id') // Only notifications FROM drivers (sender_id is null)
            ->orderBy('created_at', 'desc');

        // ✅ FIXED: Get SENT notifications (from me to drivers, where I am the sender)
        $sentQuery = Notification::with(['driver', 'schedule', 'bus'])
            ->where('sender_id', $user->id) // I sent these
            ->whereNotNull('driver_id') // Sent to drivers
            ->orderBy('created_at', 'desc');

        if ($request->filled('type')) {
            $receivedQuery->where('type', $request->type);
            $sentQuery->where('type', $request->type);
        }

        $receivedNotifications = $receivedQuery->get();
        $sentNotifications = $sentQuery->get();

        return view('panels.notifications', compact('receivedNotifications', 'sentNotifications'));
    }

    public function getUnreadCount()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['count' => 0]);
        }

        // ✅ Only count received notifications (from drivers)
        $count = Notification::where('recipient_id', $user->id)
            ->whereNull('sender_id') // Only from drivers
            ->where('is_read', false)
            ->count();

        return response()->json(['count' => $count]);
    }

    public function getRecent()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['notifications' => []]);
        }

        // Received: driver alerts and system types (e.g. route_approval) both use sender_id = null
        $notifications = Notification::with(['driver', 'sender', 'schedule', 'bus'])
            ->where('recipient_id', $user->id)
            ->whereNull('sender_id')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($notification) {
                return [
                    'id' => $notification->id,
                    'type' => $notification->type,
                    'message' => $notification->message,
                    'from_label' => $this->receivedNotificationFromLabel($notification),
                    'is_read' => $notification->is_read,
                    'created_at' => $notification->created_at->diffForHumans(),
                    'short_message' => substr($notification->message, 0, 60).(strlen($notification->message) > 60 ? '...' : ''),
                ];
            });

        return response()->json(['notifications' => $notifications]);
    }

    public function markAsRead($id)
    {
        $notification = Notification::find($id);
        if ($notification && $notification->recipient_id === Auth::id()) {
            $notification->is_read = true;
            $notification->read_at = now();
            $notification->save();
            return response()->json(['success' => true]);
        }

        return response()->json(['success' => false, 'message' => 'Notification not found or unauthorized'], 404);
    }

    public function markAllAsRead()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        // ✅ Only mark received notifications (from drivers) as read
        Notification::where('recipient_id', $user->id)
            ->whereNull('sender_id')
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function clearAll()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        // ✅ Only clear received notifications (from drivers)
        Notification::where('recipient_id', $user->id)
            ->whereNull('sender_id')
            ->delete();

        return response()->json(['success' => true]);
    }

    public function sendFromDriver(Request $request)
    {
        try {
            Log::info('Notification from driver - Request received', $request->all());

            $validator = \Validator::make($request->all(), [
                'driver_id' => 'required|exists:drivers,id',
                'type' => 'required|in:emergency,issue_report',
                'message' => 'required|string|max:1000',
                'issue_type' => 'required_if:type,issue_report|nullable|in:mechanical,traffic,accident',
                'emergency_type' => 'required_if:type,emergency|nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                Log::error('Validation failed', $validator->errors()->toArray());
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $driver = Driver::find($request->driver_id);
            
            if (!$driver) {
                Log::error('Driver not found', ['driver_id' => $request->driver_id]);
                return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
            }

            Log::info('Driver found', [
                'driver_id' => $driver->id,
                'driver_name' => $driver->name,
                'user_id' => $driver->user_id
            ]);

            $recipientId = $driver->user_id;

            if (!$recipientId) {
                Log::error('Driver has no associated user/operator', ['driver_id' => $driver->id]);
                return response()->json(['success' => false, 'message' => 'Driver has no associated operator'], 400);
            }

            $message = $request->message;
            if ($request->type === 'issue_report' && $request->issue_type) {
                $issueTypeLabel = ucfirst($request->issue_type);
                $message = "Issue Report ({$issueTypeLabel}): " . $message;
            } elseif ($request->type === 'emergency' && $request->emergency_type) {
                $message = "Emergency Alert ({$request->emergency_type}): " . $message;
            }

            Log::info('Creating notification', [
                'type' => $request->type,
                'message' => $message,
                'recipient_id' => $recipientId,
                'driver_id' => $driver->id
            ]);

            // ✅ sender_id is NULL for driver-to-operator notifications
            $notification = Notification::create([
                'type' => $request->type,
                'message' => $message,
                'sender_id' => null, // NULL indicates message FROM driver
                'recipient_id' => $recipientId, // The operator who receives it
                'driver_id' => $driver->id,
            ]);

            Log::info('Notification created successfully', ['notification_id' => $notification->id]);

            return response()->json([
                'success' => true, 
                'message' => 'Notification sent successfully', 
                'notification' => $notification
            ]);

        } catch (\Exception $e) {
            Log::error("Error sending notification from driver", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false, 
                'message' => 'An internal server error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function sendToDriver(Request $request)
    {
        try {
            Log::info('Notification from operator - Request received', $request->all());

            $operatorId = Auth::id();
            
            if (!$operatorId) {
                Log::error('No authenticated operator found');
                return response()->json(['success' => false, 'message' => 'Unauthorized - Please log in'], 401);
            }

            Log::info('Authenticated operator', ['operator_id' => $operatorId]);

            $validator = \Validator::make($request->all(), [
                'driver_ids' => 'required|array|min:1',
                'driver_ids.*' => 'required|exists:drivers,id',
                'type' => 'required|in:schedule_update,inspection_required,general',
                'message' => 'required|string|max:1000',
                'schedule_id' => 'nullable|exists:schedules,id',
                'bus_id' => 'nullable|exists:buses,id',
            ]);

            if ($validator->fails()) {
                Log::error('Validation failed', $validator->errors()->toArray());
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $driverIds = $request->driver_ids;
            $sentCount = 0;
            $failedDrivers = [];

            foreach ($driverIds as $driverId) {
                $driver = Driver::find($driverId);
                
                if (!$driver) {
                    $failedDrivers[] = $driverId;
                    continue;
                }

                if ($driver->user_id !== $operatorId) {
                    Log::error('Unauthorized - Driver does not belong to this operator', [
                        'operator_id' => $operatorId,
                        'driver_user_id' => $driver->user_id,
                        'driver_id' => $driver->id
                    ]);
                    $failedDrivers[] = $driverId;
                    continue;
                }

                // ✅ FIXED: Don't set recipient_id for operator-to-driver notifications
                // The driver will see these by querying where driver_id = their ID
                $notification = Notification::create([
                    'type' => $request->type,
                    'message' => $request->message,
                    'sender_id' => $operatorId, // Operator sending
                    'recipient_id' => null, // NULL because this is TO a driver, not to a user
                    'driver_id' => $driver->id, // The driver who should receive it
                    'schedule_id' => $request->schedule_id,
                    'bus_id' => $request->bus_id,
                    'is_read' => false,
                ]);

                Log::info('Notification created', [
                    'notification_id' => $notification->id,
                    'driver_id' => $driver->id,
                    'driver_name' => $driver->name
                ]);

                $sentCount++;
            }

            if ($sentCount === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to send notification to any driver'
                ], 400);
            }

            return response()->json([
                'success' => true, 
                'message' => "Notification sent successfully to {$sentCount} driver(s)",
                'sent_count' => $sentCount,
                'failed_count' => count($failedDrivers)
            ]);

        } catch (\Exception $e) {
            Log::error("Error sending notification to driver", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false, 
                'message' => 'An internal server error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getForDriver($driverId, Request $request)
    {
        $driver = Driver::find($driverId);
        if (!$driver) {
            return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
        }

        // ✅ Get notifications FOR this driver (where driver_id matches and sender_id is NOT null)
        $query = Notification::with(['sender', 'driver', 'schedule.route', 'bus'])
            ->where('driver_id', $driverId)
            ->whereNotNull('sender_id') // Only notifications FROM operator
            ->orderBy('created_at', 'desc');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $notifications = $query->get()->map(function (Notification $n) {
            $row = $n->toArray();
            $row['assigned_route_label'] = null;
            if ($n->schedule && $n->schedule->relationLoaded('route') && $n->schedule->route) {
                $r = $n->schedule->route;
                $row['assigned_route_label'] = ($r->name ?? 'Route').' · '.$r->start_location.' → '.$r->end_location;
            }
            if ($n->schedule) {
                $row['schedule_date'] = $n->schedule->date instanceof \Carbon\CarbonInterface
                    ? $n->schedule->date->format('Y-m-d')
                    : (string) $n->schedule->date;
                $row['schedule_start_time'] = $n->schedule->start_time
                    ? \Carbon\Carbon::parse($n->schedule->start_time)->format('H:i')
                    : null;
            }

            return $row;
        });

        return response()->json(['success' => true, 'notifications' => $notifications]);
    }

    public function markNotificationAsRead($id, Request $request)
    {
        try {
            $notification = Notification::find($id);
            
            if (!$notification) {
                Log::error('Notification not found', ['notification_id' => $id]);
                return response()->json(['success' => false, 'message' => 'Notification not found'], 404);
            }

            if ($notification->sender_id === null) {
                Log::error('Cannot mark driver-to-operator notification as read from driver app', [
                    'notification_id' => $id
                ]);
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            $notification->is_read = true;
            $notification->read_at = now();
            $notification->save();

            Log::info('Notification marked as read', [
                'notification_id' => $id,
                'driver_id' => $notification->driver_id
            ]);

            return response()->json([
                'success' => true, 
                'message' => 'Notification marked as read'
            ]);

        } catch (\Exception $e) {
            Log::error("Error marking notification as read", [
                'notification_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false, 
                'message' => 'Error marking notification as read'
            ], 500);
        }
    }

    /**
     * Label for bell dropdown / JSON — matches notifications panel “From:” rules.
     */
    private function receivedNotificationFromLabel(Notification $notification): string
    {
        if ($notification->type === 'route_approval') {
            return 'TransiTrack Sysadmin';
        }
        if ($notification->driver) {
            return $notification->driver->name.' (Driver)';
        }
        if ($notification->sender) {
            return $notification->sender->name;
        }

        return 'System';
    }
}