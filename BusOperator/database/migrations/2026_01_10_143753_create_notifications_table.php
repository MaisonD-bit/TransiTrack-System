<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // e.g., 'emergency', 'issue_report', 'schedule_update', 'inspection_required'
            $table->text('message');
            $table->foreignId('sender_id')->nullable()->constrained('users')->onDelete('set null'); 
            $table->foreignId('recipient_id')->nullable()->constrained('users')->onDelete('set null'); 
            $table->foreignId('driver_id')->nullable()->constrained('drivers')->onDelete('set null'); 
            $table->foreignId('schedule_id')->nullable()->constrained('schedules')->onDelete('set null'); 
            $table->foreignId('bus_id')->nullable()->constrained('buses')->onDelete('set null'); 
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('notifications');
    }
};