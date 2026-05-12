<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportTicketWebController extends Controller
{
    public function index()
    {
        $tickets = $this->loadTicketsForPanel();

        $counts = $this->buildCounts($tickets);

        $ticketsPoll = $tickets->map(fn (SupportTicket $t) => $this->ticketToPollArray($t))->values();

        return view('panels.support-tickets', compact('tickets', 'counts', 'ticketsPoll'));
    }

    /**
     * JSON snapshot for auto-refresh on the Support Tickets panel (session auth).
     */
    public function pollData(): JsonResponse
    {
        $tickets = $this->loadTicketsForPanel();

        return response()->json([
            'success' => true,
            'counts'  => $this->buildCounts($tickets),
            'tickets' => $tickets->map(fn (SupportTicket $t) => $this->ticketToPollArray($t))->values(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function ticketToPollArray(SupportTicket $t): array
    {
        return [
            'id'                => $t->id,
            'public_ticket_id'  => $t->public_ticket_id,
            'subject'           => $t->subject,
            'description'       => $t->description,
            'category'          => $t->category,
            'priority'          => $t->priority,
            'status'            => $t->status,
            'operator_response' => $t->operator_response,
            'created_human'     => $t->created_at?->diffForHumans() ?? '',
            'commuter'          => $t->commuter ? [
                'display_name' => $t->commuter->displayName(),
                'email'        => $t->commuter->email,
            ] : null,
        ];
    }

    /**
     * @return \Illuminate\Support\Collection<int, SupportTicket>
     */
    private function loadTicketsForPanel()
    {
        return SupportTicket::with('commuter:id,name,email')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, SupportTicket>  $tickets
     * @return array{open: int, in_progress: int, resolved: int, total: int}
     */
    private function buildCounts($tickets): array
    {
        return [
            'open'         => $tickets->where('status', 'open')->count(),
            'in_progress'  => $tickets->where('status', 'in-progress')->count(),
            'resolved'     => $tickets->where('status', 'resolved')->count(),
            'total'        => $tickets->count(),
        ];
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
