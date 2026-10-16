<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Migrations\Migration;

/**
 * جدول‌های API موبایل.
 *
 * سه جدول، دقیقاً همان‌طور که در `mobile/docs/API.md` طراحی شده است:
 *
 *   tbl_mobile_device  یک گوشیِ بسته‌شده به یک کارمند (با رازِ دستگاه)
 *   tbl_mobile_token   توکن‌های bearer؛ فقط hash ذخیره می‌شود، نه خود توکن
 *   tbl_office_ip      آی‌پی‌های خروجی محل کار، که ایجنت داخلی گزارش می‌کند
 *
 * عمداً DDL خام نوشته شده تا collation مثل بقیهٔ جدول‌های سامانه `utf8_bin`
 * بماند؛ Builder لاراول ۵.۶ چنین کنترلی روی جدول نمی‌دهد.
 */
class CreateMobileApiTables extends Migration
{
    public function up()
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS `tbl_mobile_device` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `customer_id` int(11) NOT NULL,
              `device_id` varchar(64) NOT NULL,
              `device_secret_hash` char(64) NOT NULL,
              `device_name` varchar(100) DEFAULT NULL,
              `platform` varchar(20) DEFAULT NULL,
              `bound_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `last_seen_at` timestamp NULL DEFAULT NULL,
              `last_ip` varchar(45) DEFAULT NULL,
              `released_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uniq_device_id` (`device_id`),
              KEY `idx_customer` (`customer_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin
        ");

        DB::statement("
            CREATE TABLE IF NOT EXISTS `tbl_mobile_token` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `customer_id` int(11) NOT NULL,
              `device_id` varchar(64) NOT NULL,
              `token_hash` char(64) NOT NULL,
              `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `last_used_at` timestamp NULL DEFAULT NULL,
              `revoked_at` timestamp NULL DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uniq_token_hash` (`token_hash`),
              KEY `idx_device` (`device_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin
        ");

        DB::statement("
            CREATE TABLE IF NOT EXISTS `tbl_office_ip` (
              `ip` varchar(45) NOT NULL,
              `seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`ip`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin
        ");
    }

    public function down()
    {
        Schema::dropIfExists('tbl_office_ip');
        Schema::dropIfExists('tbl_mobile_token');
        Schema::dropIfExists('tbl_mobile_device');
    }
}
