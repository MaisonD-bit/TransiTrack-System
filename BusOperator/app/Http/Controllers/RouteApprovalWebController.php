<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RouteApprovalWebController extends Controller
{
    public function index()
    {
        $userId = Auth::id();
        $requests = RouteApprovalRequest::query()
            ->where('operator_user_id', $userId)
            ->orderByDesc('created_at')
            ->get();

        $routes = Route::query()
            ->where('user_id', $userId)
            ->orderBy('name')
            ->get();

        $operatorTerminal = Auth::user()->terminal;

        return view('panels.route-requests', compact('requests', 'routes', 'operatorTerminal'));
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        $userId = $user->id;

        $terminal = $user->terminal;
        if (! in_array($terminal, ['north', 'south'], true)) {
            return back()->withErrors([
                'terminal' => 'Your profile has no terminal assigned (North or South). Contact your administrator before submitting routes.',
            ]);
        }

        $data = $request->validate([
            'route_ids' => ['required', 'array', 'min:1'],
            'route_ids.*' => ['integer', 'exists:routes,id'],
        ]);

        foreach ($data['route_ids'] as $rid) {
            $owns = Route::query()->where('id', $rid)->where('user_id', $userId)->exists();
            if (! $owns) {
                return back()->withErrors(['route_ids' => 'Invalid route selection.'])->withInput();
            }
        }

        RouteApprovalRequest::create([
            'operator_user_id' => $userId,
            'terminal' => $terminal,
            'route_ids' => array_values(array_unique($data['route_ids'])),
            'status' => 'pending_stops',
            'submitted_by_operator_at' => now(),
        ]);

        $t = $terminal === 'north' ? 'North' : 'South';

        return redirect()->route('route-stops.index')->with(
            'success',
            "Routes submitted for the {$t} terminal. Open Route stops to add bus stops on the map, then send to sysadmin when ready."
        );
    }

    public function destroy(RouteApprovalRequest $routeApprovalRequest)
    {
        $this->authorizeOperator($routeApprovalRequest);

        if ($routeApprovalRequest->status !== 'pending_stops') {
            return redirect()->route('route-requests.panel')->with(
                'error',
                'Only submissions still waiting for bus stops can be cancelled.'
            );
        }

        $routeApprovalRequest->delete();

        return redirect()->route('route-requests.panel')->with('success', 'Submission cancelled.');
    }

    private function authorizeOperator(RouteApprovalRequest $routeApprovalRequest): void
    {
        abort_if($routeApprovalRequest->operator_user_id !== Auth::id(), 403);
    }
}
