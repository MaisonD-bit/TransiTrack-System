<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Terminal Manager accounts live only in `managers`. The legacy link to `users` is removed.
     */
    public function up(): void
    {
        if (! Schema::hasTable('managers') || ! Schema::hasColumn('managers', 'user_id')) {
            return;
        }

        try {
            Schema::table('managers', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
        } catch (\Throwable $e) {
            // FK name may differ or already dropped (manual schema changes).
        }

        Schema::table('managers', function (Blueprint $table) {
            if (Schema::hasColumn('managers', 'user_id')) {
                $table->dropColumn('user_id');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('managers') || Schema::hasColumn('managers', 'user_id')) {
            return;
        }

        Schema::table('managers', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
        });
    }
};
