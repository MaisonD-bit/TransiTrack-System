<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ManagerApprovalController extends Controller
{
    public function index(Request $request): View
    {
        $status = $request->query('status', 'inactive');

        $query = DB::table('managers')
            ->where('role', 'terminalManager')
            ->orderByDesc('created_at');

        if (in_array($status, ['active', 'inactive', 'suspended'], true)) {
            $query->where('status', $status);
        }

        $managers = $query->get();

        $counts = [
            'inactive' => DB::table('managers')->where('role', 'terminalManager')->where('status', 'inactive')->count(),
            'active' => DB::table('managers')->where('role', 'terminalManager')->where('status', 'active')->count(),
            'suspended' => DB::table('managers')->where('role', 'terminalManager')->where('status', 'suspended')->count(),
            'total' => DB::table('managers')->where('role', 'terminalManager')->count(),
        ];

        return view('manager-approvals.index', compact('managers', 'counts', 'status'));
    }

    public function approve(int $id): RedirectResponse
    {
        $manager = DB::table('managers')
            ->where('id', $id)
            ->where('role', 'terminalManager')
            ->first();

        if (! $manager) {
            return back()->with('error', 'Manager account not found.');
        }

        $this->updateManagerStatus($manager, 'active');

        return back()->with('success', 'Manager account approved successfully.');
    }

    public function deactivate(int $id): RedirectResponse
    {
        $manager = DB::table('managers')
            ->where('id', $id)
            ->where('role', 'terminalManager')
            ->first();

        if (! $manager) {
            return back()->with('error', 'Manager account not found.');
        }

        $this->updateManagerStatus($manager, 'inactive');

        return back()->with('success', 'Manager account set to inactive.');
    }

    private function updateManagerStatus(object $manager, string $status): void
    {
        DB::transaction(function () use ($manager, $status) {
            DB::table('managers')
                ->where('id', $manager->id)
                ->update(['status' => $status, 'updated_at' => now()]);

            $usersQuery = DB::table('users')
                ->where('role', 'terminalManager')
                ->where(function ($query) use ($manager) {
                    if (! empty($manager->user_id)) {
                        $query->where('id', $manager->user_id);
                    }

                    $query->orWhere('email', $manager->email);
                });

            $usersQuery->update(['status' => $status, 'updated_at' => now()]);
        });
    }
}
