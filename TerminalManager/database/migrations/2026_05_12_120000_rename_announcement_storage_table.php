<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('messages') && ! Schema::hasTable('announcements')) {
            Schema::rename('messages', 'announcements');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('announcements') && ! Schema::hasTable('messages')) {
            Schema::rename('announcements', 'messages');
        }
    }
};
