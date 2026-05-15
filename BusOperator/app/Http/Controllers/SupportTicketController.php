<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\SupportTicket;

class SupportTicketController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'id'          => 'required|string',
            'subject'     => 'required|string|max:255',
            'description' => 'required|string',
            'category'    => 'nullable|string|max:50',
        ]);

        $ticket = SupportTicket::firstOrCreate(
            ['public_ticket_id' => $request->input('id')],
            [
                'commuter_id' => $request->input('commuter_id'),
                'subject'     => $request->input('subject'),
                'description' => $request->input('description'),
                'category'    => $request->input('category', 'general'),
                'priority'    => 'medium',
                'status'      => 'open',
            ]
        );

        return response()->json(['success' => true, 'ticket' => $ticket], 201);
    }

    public function index()
    {
        $tickets = SupportTicket::orderByDesc('created_at')->get();

        return response()->json(['success' => true, 'data' => $tickets]);
    }

    public function show($id)
    {
        $ticket = SupportTicket::where('public_ticket_id', $id)->firstOrFail();

        return response()->json(['success' => true, 'data' => $ticket]);
    }

    public function updateStatus(Request $request, $id)
    {
        $ticket = SupportTicket::where('public_ticket_id', $id)->firstOrFail();

        $request->validate([
            'status'   => 'nullable|in:open,in-progress,resolved,closed',
            'priority' => 'nullable|in:low,medium,high,urgent',
        ]);

        if ($request->has('status'))   $ticket->status   = $request->input('status');
        if ($request->has('priority')) $ticket->priority = $request->input('priority');

        $ticket->save();

        return response()->json(['success' => true, 'ticket' => $ticket]);
    }
}
