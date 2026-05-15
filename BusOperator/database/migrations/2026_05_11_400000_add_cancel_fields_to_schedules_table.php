<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->text('cancel_reason')->nullable()->after('completed_at');
            $table->enum('cancellation_status', ['pending_approval', 'approved', 'rejected'])->nullable()->after('cancel_reason');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['cancel_reason', 'cancellation_status']);
        });
    }
};
