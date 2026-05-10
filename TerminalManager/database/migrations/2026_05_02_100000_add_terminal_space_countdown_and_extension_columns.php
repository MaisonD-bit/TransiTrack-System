<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('terminal_spaces', function (Blueprint $table) {
            $table->boolean('five_min_warning_sent')->default(false);
            $table->boolean('three_min_warning_sent')->default(false);
            $table->unsignedSmallInteger('pending_extension_minutes')->nullable();
            $table->boolean('terminal_extension_request_used')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('terminal_spaces', function (Blueprint $table) {
            $table->dropColumn([
                'five_min_warning_sent',
                'three_min_warning_sent',
                'pending_extension_minutes',
                'terminal_extension_request_used',
            ]);
        });
    }
};
