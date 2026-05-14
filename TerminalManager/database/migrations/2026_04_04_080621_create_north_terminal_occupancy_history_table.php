<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('north_terminal_occupancy_history', function (Blueprint $table) {
            $table->id();

            // Space reference
            $table->string('space_id');
            $table->foreign('space_id')->references('space_id')->on('north_terminal_spaces')->onDelete('cascade');

            // Action tracking
            $table->enum('action', ['occupied', 'released', 'cancelled', 'edited', 'completed', 'checked_in', 'checked_out'])->comment('Type of action performed');

            // Driver & Company Information (stored for historical records)
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->string('driver_name')->nullable()->comment('Driver name snapshot');
            $table->string('driver_contact')->nullable();

            $table->foreignId('company_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('company_name')->nullable()->comment('Company/Operator name snapshot');
            $table->string('company_contact')->nullable();

            // Route information
            $table->string('route_name')->nullable();
            $table->string('accommodation_type')->nullable()->comment('Aircon, Non-Aircon, etc.');

            // Duration & Timing Information
            $table->integer('duration_minutes')->nullable()->comment('Occupancy duration in minutes');
            $table->timestamp('time_occupied')->comment('When the space was occupied');
            $table->timestamp('time_available_again')->nullable()->comment('When space becomes available (occupied_at + duration)');
            $table->timestamp('time_released')->nullable()->comment('When the space was actually released');

            // Additional details
            $table->text('reason_for_cancellation')->nullable();
            $table->text('edit_notes')->nullable()->comment('What was edited');
            $table->text('additional_notes')->nullable();

            // User who performed the action (if tracked)
            $table->integer('performed_by')->nullable()->comment('User ID who triggered the action');

            $table->timestamps();

            // Indexes for performance
            $table->index('space_id');
            $table->index('driver_id');
            $table->index('company_id');
            $table->index('action');
            $table->index('time_occupied');
            $table->index('route_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('north_terminal_occupancy_history');
    }
};
