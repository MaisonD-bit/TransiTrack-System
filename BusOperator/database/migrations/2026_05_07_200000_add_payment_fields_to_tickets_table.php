<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('tickets', 'payment_method')) {
                $table->string('payment_method', 32)->nullable()->after('commuter_id');
            }
            if (! Schema::hasColumn('tickets', 'payment_status')) {
                $table->string('payment_status', 16)->default('unpaid')->after('payment_method');
            }
            if (! Schema::hasColumn('tickets', 'payment_ref')) {
                $table->string('payment_ref', 64)->nullable()->index()->after('payment_status');
            }
            if (! Schema::hasColumn('tickets', 'paid_at')) {
                $table->timestamp('paid_at')->nullable()->after('payment_ref');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (Schema::hasColumn('tickets', 'paid_at')) {
                $table->dropColumn('paid_at');
            }
            if (Schema::hasColumn('tickets', 'payment_ref')) {
                $table->dropIndex(['payment_ref']);
                $table->dropColumn('payment_ref');
            }
            if (Schema::hasColumn('tickets', 'payment_status')) {
                $table->dropColumn('payment_status');
            }
            if (Schema::hasColumn('tickets', 'payment_method')) {
                $table->dropColumn('payment_method');
            }
        });
    }
};

