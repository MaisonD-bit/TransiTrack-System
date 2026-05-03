<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('public_ticket_id')->unique();
            $table->foreignId('schedule_id')->constrained()->onDelete('cascade');
            $table->decimal('fare', 10, 2);
            $table->foreignId('commuter_id')->nullable()->constrained('commuters')->nullOnDelete();
            $table->string('qr_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
