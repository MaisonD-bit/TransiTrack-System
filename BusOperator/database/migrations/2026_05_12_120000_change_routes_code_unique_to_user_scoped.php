<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Route codes only need to be unique per operator (same code allowed for different users).
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropUnique(['code']);
        });
        Schema::table('routes', function (Blueprint $table) {
            $table->unique(['user_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'code']);
        });
        Schema::table('routes', function (Blueprint $table) {
            $table->unique('code');
        });
    }
};
