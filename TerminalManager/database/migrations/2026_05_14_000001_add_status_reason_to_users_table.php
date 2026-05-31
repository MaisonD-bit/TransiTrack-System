<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'status_reason')) {
                $table->text('status_reason')->nullable()->after('status');
            }

            if (! Schema::hasColumn('users', 'status_reason_action')) {
                $table->string('status_reason_action')->nullable()->after('status_reason');
            }

            if (! Schema::hasColumn('users', 'status_reason_at')) {
                $table->timestamp('status_reason_at')->nullable()->after('status_reason_action');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'status_reason_at')) {
                $table->dropColumn('status_reason_at');
            }

            if (Schema::hasColumn('users', 'status_reason_action')) {
                $table->dropColumn('status_reason_action');
            }

            if (Schema::hasColumn('users', 'status_reason')) {
                $table->dropColumn('status_reason');
            }
        });
    }
};
