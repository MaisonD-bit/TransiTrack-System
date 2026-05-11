<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\Request;

class SupportTicketWebController extends Controller
{
    public function index()
    {
        $tickets = SupportTicket::with('commuter:id,first_name,last_name,email')
            ->orderByDesc('created_at')
            ->get();

        $counts = [
            'open'        => $tickets->where('status', 'open')->count(),
            'in_progress' => $tickets->where('status', 'in-progress')->count(),
            'resolved'    => $tickets->where('status', 'resolved')->count(),
            'total'       => $tickets->count(),
        ];

        return view('panels.support-tickets', compact('tickets', 'counts'));
    }

    public function updateStatus(Request $request, $id)
    {
        $ticket = SupportTicket::where('public_ticket_id', $id)
            ->orWhere('id', $id)
            ->firstOrFail();

        $request->validate([
            'status'   => 'nullable|in:open,in-progress,resolved,closed',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'response' => 'nullable|string|max:2000',
        ]);

        if ($request->filled('status'))   $ticket->status   = $request->status;
        if ($request->filled('priority')) $ticket->priority = $request->priority;
        if ($request->filled('response')) $ticket->operator_response = $request->response;

        $ticket->save();

        return back()->with('success', 'Ticket updated successfully.');
    }
}
