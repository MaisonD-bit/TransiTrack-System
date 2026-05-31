<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\OperatorUser;
use App\Support\ManagerTerminalScope;
use App\Support\ManagerUsersLink;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnnouncementController extends Controller
{
    use ManagerTerminalScope;
    use ManagerUsersLink;

    public function index()
    {
        $senderUserId = $this->resolveManagerUsersId();

        if (! $senderUserId) {
            return view('operations.announcement', ['announcements' => collect()]);
        }

        $announcements = Announcement::query()
            ->where('sender_id', $senderUserId)
            ->whereNull('recipient_id')
            ->where('recipient_type', 'operators')
            ->latest()
            ->get();

        return view('operations.announcement', compact('announcements'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        $currentUser = Auth::user();
        if (! $currentUser) {
            return redirect()->route('announcements')
                ->with('error', 'Your session has expired. Please log in again.');
        }

        try {
            $senderUserId = $this->resolveManagerUsersId($currentUser);

            if (! $senderUserId) {
                return redirect()->route('announcements')
                    ->with('error', 'Could not link your manager account to the operator database. Please contact the administrator.');
            }

            $announcement = Announcement::create([
                'sender_id' => $senderUserId,
                'recipient_id' => null,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'recipient_type' => 'operators',
            ]);

            $recipientQuery = OperatorUser::where('role', 'bus_operator')
                ->where('status', 'active');
            $this->scopeOperatorsByTerminal($recipientQuery);
            $recipients = $recipientQuery->get();

            if ($recipients->isEmpty()) {
                return redirect()->route('announcements')
                    ->with('warning', 'Announcement saved, but no active bus operators were found for your terminal.');
            }

            foreach ($recipients as $recipient) {
                try {
                    DB::table('notifications')->insert([
                        'type' => 'manager_announcement',
                        'message' => $validated['subject'].': '.$validated['body'],
                        'sender_id' => $senderUserId,
                        'recipient_id' => $recipient->id,
                        'driver_id' => null,
                        'schedule_id' => null,
                        'bus_id' => null,
                        'route_approval_request_id' => null,
                        'latitude' => null,
                        'longitude' => null,
                        'location_label' => null,
                        'incident_type' => null,
                        'is_read' => false,
                        'read_at' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Failed to create announcement notification for operator', [
                        'operator_id' => $recipient->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return redirect()->route('announcements')->with(
                'success',
                'Announcement sent to '.$recipients->count().' bus operator(s).'
            );
        } catch (\Exception $e) {
            Log::error('Failed to create announcement', [
                'user_id' => $currentUser->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->route('announcements')
                ->with('error', 'Failed to send announcement: '.$e->getMessage());
        }
    }

    public function show($id)
    {
        $senderUserId = $this->resolveManagerUsersId();

        if (! $senderUserId) {
            abort(403, 'You are not authorized to view this announcement.');
        }

        $announcement = Announcement::where('sender_id', $senderUserId)->findOrFail($id);

        return view('announcements.show', compact('announcement'));
    }
}
