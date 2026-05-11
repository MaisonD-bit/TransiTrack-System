<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            if (! Schema::hasColumn('messages', 'recipient_type')) {
                $table->enum('recipient_type', ['operators', 'managers', 'all'])->nullable()->after('recipient_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            if (Schema::hasColumn('messages', 'recipient_type')) {
                $table->dropColumn('recipient_type');
            }
        });
    }
};
