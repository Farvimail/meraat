<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Migrations\Migration;

/**
 * تأییدِ حضورِ روز (با QR یا دستِ مدیر).
 *
 * چرا جدولِ جدا و نه یک ستون روی رکوردِ حضور: رکوردِ حضور در `tbl_saved_time`
 * و `tbl_timer` ساخته می‌شود و هر ورود/خروج یک ردیف دارد؛ «تأییدِ حضور» یکی
 * در روز است، نه یکی در هر رکورد. اینجا روزِ شمسی (`dmy`) کلیدِ طبیعی است،
 * پس گزارش‌ها هم بی‌دردسر با پنل جوین می‌شوند.
 *
 * کلیدِ یکتای (customer_id, dmy) تضمین می‌کند یک کارمند در یک روز بیش از یک
 * ردیف نداشته باشد؛ پس `MobilePresence::confirm()` می‌تواند بی‌ترس از ردیفِ
 * تکراری بنویسد.
 *
 * collation مثل بقیهٔ جدول‌ها `utf8_bin` است (DDL خام، چون Builder لاراول ۵.۶
 * چنین کنترلی روی جدول نمی‌دهد).
 */
class CreateMobilePresenceConfirm extends Migration
{
    public function up()
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS `tbl_mobile_presence_confirm` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `customer_id` int(11) NOT NULL,
              `dmy` varchar(20) NOT NULL,
              `method` varchar(10) NOT NULL,
              `window` bigint(20) DEFAULT NULL,
              `confirmed_at` datetime NOT NULL,
              `confirmed_ip` varchar(45) DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uniq_presence_day` (`customer_id`,`dmy`),
              KEY `idx_presence_dmy` (`dmy`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin
        ");
    }

    public function down()
    {
        Schema::dropIfExists('tbl_mobile_presence_confirm');
    }
}
