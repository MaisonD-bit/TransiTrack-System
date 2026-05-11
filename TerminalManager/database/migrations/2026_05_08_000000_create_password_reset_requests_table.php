<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('password_reset_requests')) {
            return;
        }

        Schema::create('password_reset_requests', function (Blueprint $table) {
            $table->id();
            $table->string('role', 32); // terminal_manager
            $table->string('email')->index();
            $table->string('token_hash', 128);
            $table->timestamp('expires_at')->index();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_requests');
    }
};

