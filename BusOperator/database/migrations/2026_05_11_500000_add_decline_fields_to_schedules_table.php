<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->text('decline_reason')->nullable()->after('cancellation_status');
            $table->enum('decline_status', ['pending_approval', 'approved', 'rejected'])->nullable()->after('decline_reason');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['decline_reason', 'decline_status']);
        });
    }
};
