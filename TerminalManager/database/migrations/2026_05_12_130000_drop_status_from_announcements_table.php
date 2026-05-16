<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('announcements') || ! Schema::hasColumn('announcements', 'status')) {
            return;
        }

        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('announcements') || Schema::hasColumn('announcements', 'status')) {
            return;
        }

        Schema::table('announcements', function (Blueprint $table) {
            $table->enum('status', ['unread', 'read'])->default('unread')->after('body');
        });
    }
};
