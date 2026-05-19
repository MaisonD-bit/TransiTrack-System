<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('route_approval_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('route_approval_requests', 'submitted_for_sysadmin_at')) {
                $table->timestamp('submitted_for_sysadmin_at')->nullable()->after('submitted_by_terminal_at');
            }
        });

        if (Schema::hasColumn('route_approval_requests', 'submitted_by_terminal_at')) {
            DB::table('route_approval_requests')
                ->whereNotNull('submitted_by_terminal_at')
                ->whereNull('submitted_for_sysadmin_at')
                ->update([
                    'submitted_for_sysadmin_at' => DB::raw('submitted_by_terminal_at'),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('route_approval_requests', function (Blueprint $table) {
            if (Schema::hasColumn('route_approval_requests', 'submitted_for_sysadmin_at')) {
                $table->dropColumn('submitted_for_sysadmin_at');
            }
        });
    }
};
