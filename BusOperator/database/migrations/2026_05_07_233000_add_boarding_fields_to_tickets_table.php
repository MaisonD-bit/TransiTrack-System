<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('tickets', 'boarded_at')) {
                // Do not depend on presence of alighted_at (some DBs may not have that migration applied yet).
                $table->timestamp('boarded_at')->nullable();
            }
            if (! Schema::hasColumn('tickets', 'boarded_by_driver_id')) {
                $table->foreignId('boarded_by_driver_id')->nullable()->after('boarded_at')
                    ->constrained('drivers')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (Schema::hasColumn('tickets', 'boarded_by_driver_id')) {
                $table->dropForeign(['boarded_by_driver_id']);
                $table->dropColumn('boarded_by_driver_id');
            }
            if (Schema::hasColumn('tickets', 'boarded_at')) {
                $table->dropColumn('boarded_at');
            }
        });
    }
};

