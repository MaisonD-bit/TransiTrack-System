<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('route_approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operator_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('terminal', 20)->nullable()->comment('north or south');
            $table->json('route_ids');
            $table->json('stop_configuration')->nullable()->comment('Terminal manager: stops + ETAs per route');
            $table->string('status', 40)->default('pending_stops');
            $table->timestamp('submitted_by_operator_at')->nullable();
            $table->timestamp('submitted_by_terminal_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->foreignId('decided_by_sysadmin_id')->nullable()->constrained('sysadmin_users')->nullOnDelete();
            $table->text('sysadmin_notes')->nullable();
            $table->text('decline_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('route_approval_requests');
    }
};
