<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Terminal managers read from this table; extension requests are inserted from BusOperator.
 * The same migration exists in TerminalManager — this copy keeps a BusOperator-only migrate
 * workflow from failing when the shared database was never migrated from TerminalManager.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('manager_notifications')) {
            return;
        }

        Schema::create('manager_notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // Shared with TerminalManager; leave table in place on rollback from BusOperator only.
    }
};
