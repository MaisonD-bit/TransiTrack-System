<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('north_terminal_spaces', function (Blueprint $table) {
            // Primary Key: space_id (e.g., "L1", "T5", "R3")
            $table->string('space_id')->primary();

            // Position information
            $table->enum('position', ['LEFT', 'TOP', 'RIGHT']);
            $table->integer('position_order')->comment('Order within the position group');

            // Route information (user manually entered)
            $table->string('route_name')->nullable()->comment('Route name manually added by operator');
            $table->string('accommodation_type')->nullable()->comment('Aircon, Non-Aircon, Mixed, etc.');

            // Current occupancy status
            $table->boolean('is_occupied')->default(false);
            $table->timestamp('occupied_at')->nullable();
            $table->timestamp('available_at')->nullable()->comment('Time when space becomes available again');

            // Current driver & company reference (for quick lookup)
            $table->foreignId('current_driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->foreignId('current_company_id')->nullable()->constrained('users')->nullOnDelete();

            // Duration in minutes
            $table->integer('current_duration_minutes')->nullable();

            // Status tracking
            $table->string('status')->default('available')->comment('available, occupied, maintenance, etc.');
            $table->text('notes')->nullable();

            $table->timestamps();

            // Indexes for performance
            $table->index('position');
            $table->index('is_occupied');
            $table->index('current_driver_id');
            $table->index('available_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('north_terminal_spaces');
    }
};
