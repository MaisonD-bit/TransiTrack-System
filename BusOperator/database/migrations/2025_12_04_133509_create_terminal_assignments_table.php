<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('terminal_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('space_id'); // e.g., P1, P2, L1, etc.
            $table->foreignId('route_id')->constrained('routes')->onDelete('cascade');
            $table->foreignId('driver_id')->constrained('drivers')->onDelete('cascade');
            $table->foreignId('bus_id')->constrained('buses')->onDelete('cascade');
            $table->date('assigned_date');
            $table->enum('status', ['active', 'inactive', 'completed'])->default('active');
            $table->timestamps();
            
            // Unique constraint for date and space
            $table->unique(['space_id', 'assigned_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('terminal_assignments');
    }
};