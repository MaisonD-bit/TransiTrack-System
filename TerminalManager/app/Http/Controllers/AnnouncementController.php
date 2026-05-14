<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\OperatorUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnnouncementController extends Controller
{
    public function index()
    {
        $senderUserId = $this->managerSenderUserId();

        if (!$senderUserId) {
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
        if (!$currentUser) {
            Log::warning('Announcement create failed: No authenticated user');

            return redirect()->route('announcements')
                ->with('error', 'Your session has expired. Please log in again.');
        }

        $userCheck = DB::table('managers')->where('id', $currentUser->id)->first();
        if (!$userCheck) {
            Log::warning('Announcement create failed: User not found in database', [
                'user_id' => $currentUser->id,
                'user_name' => $currentUser->name,
            ]);

            return redirect()->route('announcements')
                ->with('error', 'Your user record was not found. Please log in again.');
        }

        try {
            $senderUserId = $currentUser->user_id
                ?: DB::table('users')->where('email', $currentUser->email)->value('id');

            if (!$senderUserId) {
                Log::warning('Announcement create failed: Manager has no linked users row', [
                    'manager_id' => $currentUser->id,
                    'manager_email' => $currentUser->email,
                ]);

                return redirect()->route('announcements')
                    ->with('error', 'Your manager account is not linked to a user record. Please contact the administrator.');
            }

            $announcement = Announcement::create([
                'sender_id' => $senderUserId,
                'recipient_id' => null,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'recipient_type' => 'operators',
            ]);

            $recipients = OperatorUser::where('role', 'bus_operator')
                ->where('status', 'active')
                ->get();

            foreach ($recipients as $recipient) {
                try {
                    DB::table('notifications')->insert([
                        'type' => 'manager_announcement',
                        'message' => $validated['subject'] . ': ' . $validated['body'],
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

            return redirect()->route('announcements')->with('success', 'Announcement sent successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to create announcement', [
                'user_id' => $currentUser->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('announcements')
                ->with('error', 'Failed to send announcement: ' . $e->getMessage());
        }
    }

    public function show($id)
    {
        $senderUserId = $this->managerSenderUserId();

        if (!$senderUserId) {
            abort(403, 'You are not authorized to view this announcement.');
        }

        $announcement = Announcement::where('sender_id', $senderUserId)->findOrFail($id);

        return view('announcements.show', compact('announcement'));
    }

    private function managerSenderUserId(): ?int
    {
        $currentUser = Auth::user();

        if (!$currentUser) {
            return null;
        }

        return $currentUser->user_id
            ?: DB::table('users')->where('email', $currentUser->email)->value('id');
    }
}
