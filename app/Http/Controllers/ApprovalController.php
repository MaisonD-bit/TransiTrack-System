<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ApprovalController extends Controller
{
    /**
     * Display the approval page with pending operators
     */
    public function index()
    {
        // Get manager's terminal assignment
        $manager = Auth::user();
        $terminal = $manager ? $manager->terminal : null;

        // Filter operators by manager's terminal
        $query = DB::table('users')->where('role', 'bus_operator');
        
        if ($terminal) {
            $query->where('terminal', $terminal);
        }

        $operators = $query->get();
        return view('operations.approval', compact('operators'));
    }

    /**
     * Get operators with optional filtering
     */
    public function getOperators(Request $request)
    {
        $status = $request->query('status', 'all');

        // Get manager's terminal assignment
        $manager = Auth::user();
        $terminal = $manager ? $manager->terminal : null;

        $query = DB::table('users')->where('role', 'bus_operator');

        // Filter by manager's terminal
        if ($terminal) {
            $query->where('terminal', $terminal);
        }

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $operators = $query->get();

        return response()->json($operators);
    }

    /**
     * Approve/Activate an operator
     */
    public function approve(Request $request, $id)
    {
        // Get manager's terminal assignment
        $manager = Auth::user();
        $terminal = $manager ? $manager->terminal : null;

        $operator = DB::table('users')->where('id', $id)->where('role', 'bus_operator')->first();

        if (!$operator) {
            return response()->json(['success' => false, 'message' => 'Operator not found'], 404);
        }

        // Verify manager can only approve operators from their terminal
        if ($terminal && $operator->terminal !== $terminal) {
            return response()->json(['success' => false, 'message' => 'Unauthorized: You cannot approve operators from other terminals'], 403);
        }

        DB::table('users')->where('id', $id)->update(['status' => 'active']);

        return response()->json([
            'success' => true,
            'message' => "Operator has been approved.",
        ]);
    }

    /**
     * Reject/Deactivate an operator
     */
    public function pending(Request $request, $id)
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        // Get manager's terminal assignment
        $manager = Auth::user();
        $terminal = $manager ? $manager->terminal : null;

        $operator = DB::table('users')->where('id', $id)->where('role', 'bus_operator')->first();
        
        if (!$operator) {
            return response()->json(['success' => false, 'message' => 'Operator not found'], 404);
        }

        // Verify manager can only reject operators from their terminal
        if ($terminal && $operator->terminal !== $terminal) {
            return response()->json(['success' => false, 'message' => 'Unauthorized: You cannot reject operators from other terminals'], 403);
        }
        
        // Just set to inactive (deactivate)
        DB::table('users')->where('id', $id)->update(['status' => 'inactive']);

        return response()->json([
            'success' => true,
            'message' => "Operator has been deactivated.",
        ]);
    }

    /**
     * Get approval statistics
     */
    public function getStats()
    {
        // Get manager's terminal assignment
        $manager = Auth::user();
        $terminal = $manager ? $manager->terminal : null;

        $query = DB::table('users')->where('role', 'bus_operator');
        
        if ($terminal) {
            $query->where('terminal', $terminal);
        }

        $stats = [
            'active' => (clone $query)->where('status', 'active')->count(),
            'inactive' => (clone $query)->where('status', 'inactive')->count(),
            'total' => (clone $query)->count(),
        ];

        return response()->json($stats);
    }
}