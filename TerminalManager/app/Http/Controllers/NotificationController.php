<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\ManagerNotification;
use App\Models\RouteApprovalRequest;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     */
    public function index()
    {
        $user = Auth::user();

        $terminal = strtolower((string) ($user->terminal ?? ''));

        $pendingOperatorApprovals = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'inactive')
            ->where(function ($query) {
                $query->whereNull('status_reason_action')
                    ->orWhere('status_reason_action', '!=', 'deactivate');
            })
            ->when($terminal !== '', fn ($query) => $query->whereRaw('LOWER(COALESCE(terminal, "")) = ?', [$terminal]))
            ->count();

        $pendingRouteStopRequests = RouteApprovalRequest::query()
            ->where('status', 'pending_stops')
            ->when($terminal !== '', fn ($query) => $query->whereRaw('LOWER(COALESCE(terminal, "")) = ?', [$terminal]))
            ->count();

        $actionNotifications = collect();

        if ($pendingOperatorApprovals > 0) {
            $actionNotifications->push([
                'id' => 'pending-operator-approvals',
                'type' => 'operator_approval',
                'data' => [
                    'message' => "{$pendingOperatorApprovals} bus operator approval" . ($pendingOperatorApprovals === 1 ? ' is' : 's are') . ' waiting for review.',
                    'subject' => 'Pending operator approvals',
                    'url' => route('approval'),
                ],
                'read_at' => null,
                'created_at' => now()->toIso8601String(),
                'is_virtual' => true,
            ]);
        }

        if ($pendingRouteStopRequests > 0) {
            $actionNotifications->push([
                'id' => 'pending-route-stops',
                'type' => 'route_stop_request',
                'data' => [
                    'message' => "{$pendingRouteStopRequests} route stop request" . ($pendingRouteStopRequests === 1 ? ' needs' : 's need') . ' terminal configuration.',
                    'subject' => 'New route stop requests',
                    'url' => route('terminal.route-stops'),
                ],
                'read_at' => null,
                'created_at' => now()->toIso8601String(),
                'is_virtual' => true,
            ]);
        }

        $notifications = $actionNotifications
            ->values();

        $unreadCount = $pendingOperatorApprovals + $pendingRouteStopRequests;

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unreadCount,
        ]);
    }

    /**
     * Get the unread notification count.
     */
    public function unreadCount()
    {
        $user = Auth::user();

        $count = ManagerNotification::where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead($id)
    {
        $user = Auth::user();

        $notification = ManagerNotification::where('id', $id)
            ->where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->first();

        if ($notification) {
            $notification->update(['read_at' => now()]);
            return response()->json(['success' => true]);
        }

        return response()->json(['success' => false], 404);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead()
    {
        $user = Auth::user();

        ManagerNotification::where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Delete a notification.
     */
    public function destroy($id)
    {
        $user = Auth::user();

        $notification = ManagerNotification::where('id', $id)
            ->where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->first();

        if ($notification) {
            $notification->delete();
            return response()->json(['success' => true]);
        }

        return response()->json(['success' => false], 404);
    }
}
