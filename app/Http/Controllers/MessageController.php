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
        $messages = Message::where(function ($q) {
            $q->where('recipient_id', Auth::id())
                ->orWhere('sender_id', Auth::id())
                ->orWhereNull('recipient_id');
        })
            ->latest()
            ->get();

        // Get all users except the current one
        $users = User::where('id', '!=', Auth::id())->get();

        return view('operations.message-management', compact('messages', 'users'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'recipient_id' => 'nullable|exists:users,id',
        ]);

        // Create the message
        $message = Message::create([
            'sender_id'    => Auth::id(),
            'recipient_id' => $validated['recipient_id'] ?? null,
            'subject'      => $validated['subject'],
            'body'         => $validated['body'],
            'status'       => 'unread',
        ]);

        // Send to all operators (broadcast)
        $operators = User::where('role', 'operator')->get();
        foreach ($operators as $operator) {
            $operator->notify(new NewUserMessage($message));
        }

        // Send to a specific recipient (if provided)
        if (!empty($validated['recipient_id'])) {
            $recipient = User::find($validated['recipient_id']);
            if ($recipient) {
                $recipient->notify(new NewUserMessage($message));
            }
        }

        return redirect()->route('operations.message-management')->with('success', 'Message sent successfully.');
    }


    public function show($id)
    {
        $message = Message::findOrFail($id);

        // Restrict access — must be sender, recipient, or broadcast (recipient_id null)
        if (
            $message->sender_id !== Auth::id() &&
            $message->recipient_id !== Auth::id() &&
            !($message->recipient_id === null && Auth::user()->role === 'operator')
        ) {
            abort(403, 'You are not authorized to view this message.');
        }

        // if (
        //     $message->sender_id !== Auth::id() &&
        //     $message->recipient_id !== Auth::id() &&
        //     !is_null($message->recipient_id)
        // ) {
        //     abort(403, 'You are not authorized to view this message.');
        // }



        // Mark as read if recipient is the current user
        if ($message->status === 'unread' && $message->recipient_id === Auth::id()) {
            $message->update(['status' => 'read']);
        }

        return view('messages.show', compact('message'));
    }
}
