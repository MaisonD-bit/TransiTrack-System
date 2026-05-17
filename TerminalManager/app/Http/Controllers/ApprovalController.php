<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;

class ApprovalController extends Controller
{
    /**
     * Display the approval page with pending operators
     */
    public function index()
    {
        $operators = $this->operatorsQueryForManager()->get();

        return view('operations.approval', compact('operators'));
    }

    /**
     * Get operators with optional filtering
     */
    public function getOperators(Request $request)
    {
        $status = $request->query('status', 'all');

        $query = $this->operatorsQueryForManager();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json($query->get());
    }

    /**
     * Approve/Activate an operator
     */
    public function approve(Request $request, int $id)
    {
        $operator = DB::table('users')->where('id', $id)->where('role', 'bus_operator')->first();

        if (! $operator) {
            return response()->json(['success' => false, 'message' => 'Operator not found'], 404);
        }

        if ($denied = $this->assertCanManageOperator($operator, 'approve')) {
            return $denied;
        }

        DB::table('users')->where('id', $id)->update([
            'status' => 'active',
            'status_reason' => null,
            'status_reason_action' => null,
            'status_reason_at' => null,
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Operator has been approved.',
        ]);
    }

    /**
     * Deactivate an operator
     */
    public function pending(Request $request, int $id)
    {
        $validated = $request->validate([
            'action' => 'required|in:deactivate',
            'reason' => 'nullable|string|max:500',
        ]);

        $operator = DB::table('users')->where('id', $id)->where('role', 'bus_operator')->first();

        if (! $operator) {
            return response()->json(['success' => false, 'message' => 'Operator not found'], 404);
        }

        if ($denied = $this->assertCanManageOperator($operator, 'deactivate')) {
            return $denied;
        }

        $reason = trim((string) ($validated['reason'] ?? ''));

        DB::table('users')->where('id', $id)->update([
            'status' => 'inactive',
            'status_reason' => $reason !== '' ? $reason : null,
            'status_reason_action' => $validated['action'],
            'status_reason_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Operator has been deactivated.',
        ]);
    }

    /**
     * Get approval statistics
     */
    public function getStats()
    {
        $query = $this->operatorsQueryForManager();

        $stats = [
            'active' => (clone $query)->where('status', 'active')->count(),
            'inactive' => (clone $query)->where('status', 'inactive')->count(),
            'total' => (clone $query)->count(),
        ];

        return response()->json($stats);
    }

    /**
     * @return \Illuminate\Database\Query\Builder
     */
    private function operatorsQueryForManager()
    {
        $query = DB::table('users')->where('role', 'bus_operator');
        $terminal = $this->managerTerminal();

        if ($terminal === null) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereRaw('LOWER(terminal) = ?', [$terminal]);
    }

    private function managerTerminal(): ?string
    {
        $terminal = Auth::user()?->terminal;
        $terminal = is_string($terminal) ? trim($terminal) : '';

        return $terminal !== '' ? strtolower($terminal) : null;
    }

    /**
     * @param  object  $operator  Row from users table
     */
    private function assertCanManageOperator(object $operator, string $action): ?JsonResponse
    {
        $terminal = $this->managerTerminal();

        if ($terminal === null) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is not assigned to a terminal. Contact a system administrator.',
            ], 403);
        }

        $operatorTerminal = strtolower(trim((string) ($operator->terminal ?? '')));

        if ($operatorTerminal === '' || $operatorTerminal !== $terminal) {
            return response()->json([
                'success' => false,
                'message' => "Unauthorized: You cannot {$action} operators from other terminals",
            ], 403);
        }

        return null;
    }
}
