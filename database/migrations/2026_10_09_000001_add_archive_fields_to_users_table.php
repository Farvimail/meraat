<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddArchiveFieldsToUsersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * فعال/آرشیو شدن کارمند: این ستون در جدول users وجود نداشت (جدول داخل
     * inbox.sql ساخته شده و هیچ مهاجرتی برایش نبود). اجرای این مهاجرت یک‌باره
     * روی دیتابیس‌های موجود لازم است: php artisan migrate
     */
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('password');
            }
            if (!Schema::hasColumn('users', 'national_code')) {
                $table->bigInteger('national_code')->default(0)->after('email');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
            if (Schema::hasColumn('users', 'national_code')) {
                $table->dropColumn('national_code');
            }
        });
    }
}
