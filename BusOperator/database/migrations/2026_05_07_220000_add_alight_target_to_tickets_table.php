<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('tickets', 'alight_stop_index')) {
                $table->unsignedInteger('alight_stop_index')->nullable()->after('schedule_id');
            }
            if (! Schema::hasColumn('tickets', 'alight_is_destination')) {
                $table->boolean('alight_is_destination')->default(false)->after('alight_stop_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (Schema::hasColumn('tickets', 'alight_is_destination')) {
                $table->dropColumn('alight_is_destination');
            }
            if (Schema::hasColumn('tickets', 'alight_stop_index')) {
                $table->dropColumn('alight_stop_index');
            }
        });
    }
};

