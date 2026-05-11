<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\OperatorUser;
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
                ->orWhere(function ($q2) {
                    $q2->whereNull('recipient_id')->whereNotNull('recipient_type');
                });
        })
            ->latest()
            ->get();

        $users = User::where('id', '!=', Auth::id())->get();

        return view('operations.message', compact('messages', 'users'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'recipient_id' => 'nullable|exists:managers,id',
            'recipient_type' => 'nullable|in:operators,managers,all',
        ]);

        if (empty($validated['recipient_id']) && empty($validated['recipient_type'])) {
            $validated['recipient_type'] = 'operators';
        }

        if (!empty($validated['recipient_id'])) {
            $message = Message::create([
                'sender_id' => Auth::id(),
                'recipient_id' => $validated['recipient_id'],
                'recipient_type' => null,
                'subject' => $validated['subject'],
                'body' => $validated['body'],
                'status' => 'unread',
            ]);

            $recipient = User::find($validated['recipient_id']);
            if ($recipient) {
                $recipient->notify(new NewUserMessage($message));
            }

            return redirect()->route('messages.index')->with('success', 'Message sent successfully.');
        }

        $message = Message::create([
            'sender_id' => Auth::id(),
            'recipient_id' => null,
            'recipient_type' => $validated['recipient_type'],
            'subject' => $validated['subject'],
            'body' => $validated['body'],
            'status' => 'unread',
        ]);

        if ($validated['recipient_type'] === 'operators') {
            $recipients = OperatorUser::where('role', 'bus_operator')->get();
        } elseif ($validated['recipient_type'] === 'managers') {
            $recipients = User::where('role', 'terminalManager')->get();
        } else {
            $recipients = OperatorUser::where('role', 'bus_operator')->get()
                ->concat(User::where('role', 'terminalManager')->get());
        }

        foreach ($recipients as $recipient) {
            $recipient->notify(new NewUserMessage($message));
        }

        return redirect()->route('messages.index')->with('success', 'Announcement sent successfully.');
    }

    public function show($id)
    {
        $message = Message::findOrFail($id);

        if ($message->sender_id === Auth::id()) {
            return view('messages.show', compact('message'));
        }

        if ($message->recipient_id !== null) {
            if ($message->recipient_id !== Auth::id()) {
                abort(403, 'You are not authorized to view this message.');
            }
            if ($message->status === 'unread') {
                $message->update(['status' => 'read']);
            }

            return view('messages.show', compact('message'));
        }

        if ($message->recipient_type !== null) {
            $userRole = Auth::user()->role;
            $canView = false;

            if ($message->recipient_type === 'operators' && $userRole === 'bus_operator') {
                $canView = true;
            } elseif ($message->recipient_type === 'managers' && $userRole === 'terminalManager') {
                $canView = true;
            } elseif ($message->recipient_type === 'all' && in_array($userRole, ['bus_operator', 'terminalManager'], true)) {
                $canView = true;
            }

            if (!$canView) {
                abort(403, 'You are not authorized to view this announcement.');
            }

            if ($message->status === 'unread') {
                $message->update(['status' => 'read']);
            }

            return view('messages.show', compact('message'));
        }

        abort(403, 'You are not authorized to view this message.');
    }
}
