<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Message;
use App\Notifications\NewUserMessage;
use Illuminate\Support\Facades\Auth;

class MessageController extends Controller
{
    public function index()
    {
        $messages = Message::whereNull('recipient_id')
            ->latest()
            ->get();

        return view('operations.message', compact('messages'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'recipient_type' => 'required|in:operators,managers,all',
        ]);

        // Create the announcement
        $message = Message::create([
            'sender_id'    => Auth::id(),
            'recipient_id' => null,
            'subject'      => $validated['subject'],
            'body'         => $validated['body'],
            'status'       => 'unread',
            'recipient_type' => $validated['recipient_type'],
        ]);

        // Send to specified recipients (announcement broadcast)
        $recipients = [];
        if ($validated['recipient_type'] === 'operators') {
            $recipients = User::where('role', 'operator')->get();
        } elseif ($validated['recipient_type'] === 'managers') {
            $recipients = User::where('role', 'manager')->get();
        } else { // 'all'
            $recipients = User::whereIn('role', ['operator', 'manager'])->get();
        }

        foreach ($recipients as $recipient) {
            $recipient->notify(new NewUserMessage($message));
        }

        return redirect()->route('messages.index')->with('success', 'Announcement sent successfully.');
    }


    public function show($id)
    {
        $message = Message::findOrFail($id);

        // Check if user is sender
        if ($message->sender_id === Auth::id()) {
            // Sender can always view
        } else {
            // Check if user role matches recipient_type
            $userRole = Auth::user()->role;
            $canView = false;

            if ($message->recipient_type === 'operators' && $userRole === 'operator') {
                $canView = true;
            } elseif ($message->recipient_type === 'managers' && $userRole === 'manager') {
                $canView = true;
            } elseif ($message->recipient_type === 'all' && in_array($userRole, ['operator', 'manager'])) {
                $canView = true;
            }

            if (!$canView) {
                abort(403, 'You are not authorized to view this announcement.');
            }
        }

        // Mark as read if it's an announcement
        if ($message->status === 'unread' && $message->recipient_id === null) {
            $message->update(['status' => 'read']);
        }

        return view('messages.show', compact('message'));
    }
}
