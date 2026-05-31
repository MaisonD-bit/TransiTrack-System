<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\ManagerNotification;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     */
    public function index()
    {
        $user = Auth::user();

        $notifications = ManagerNotification::where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get();

        $unreadCount = ManagerNotification::where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->whereNull('read_at')
            ->count();

        $pendingApprovals = $this->pendingApprovalQuery()
            ->orderBy('created_at', 'desc')
            ->get();

        $approvalNotifications = $pendingApprovals->map(function ($operator) {
            $company = trim((string) ($operator->company_name ?? ''));
            $operatorName = trim((string) ($operator->name ?? ''));
            $label = $company !== '' ? $company : ($operatorName !== '' ? $operatorName : 'A bus operator');

            return [
                'id' => 'approval-'.$operator->id,
                'type' => 'pending_approval',
                'data' => [
                    'message' => $label.' is waiting for terminal approval.',
                    'subject' => 'Pending bus operator approval',
                    'approval_id' => $operator->id,
                    'action_url' => route('approval'),
                ],
                'read_at' => null,
                'created_at' => $operator->created_at,
            ];
        });

        $notifications = $notifications
            ->concat($approvalNotifications)
            ->sortByDesc('created_at')
            ->values()
            ->take(10);

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unreadCount + $pendingApprovals->count(),
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

        return response()->json(['count' => $count + $this->pendingApprovalQuery()->count()]);
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

    private function pendingApprovalQuery()
    {
        $terminal = Auth::user()?->terminal;
        $terminal = is_string($terminal) ? strtolower(trim($terminal)) : null;

        $query = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'inactive')
            ->whereNull('status_reason_action');

        if ($terminal === null || $terminal === '') {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereRaw('LOWER(terminal) = ?', [$terminal]);
    }
}
