<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;

/**
 * تأییدِ حضور برای **هر ثبتِ ورود**، نه یک تأیید برای کلِ روز.
 *
 * قاعدهٔ قبلی: یک ردیفِ (customer_id, dmy) که تا آخرِ روز همهٔ ثبت‌ها را باز
 * می‌کرد؛ نتیجه این بود که کارمندی که صبح تأیید کرده بود، بعد از خروج و
 * برگشتن به محلِ کار هم بی‌هیچ تأییدِ تازه‌ای می‌توانست دوباره ورود بزند.
 * تصمیمِ درست: هر «ثبتِ حضور» (هر ورودِ تازه) یک تأییدِ تازه لازم دارد.
 *
 * برای همین:
 *   - کلیدِ یکتای (customer_id, dmy) برداشته می‌شود تا هر روز چند ردیف داشته
 *     باشد؛
 *   - ستونِ `consumed_at` اضافه می‌شود: تأییدِ تازه `NULL` است و همان لحظه‌ای
 *     که ثبتِ ورود انجام شد، پُر می‌شود. «تأییدِ مصرف‌نشده» همان چیزی است که
 *     دروازهٔ ثبت را باز می‌کند.
 *
 * ردیف‌های موجود (که با قاعدهٔ قدیمی نوشته شده‌اند) «مصرف‌شده» علامت می‌خورند
 * تا بعد از استقرار، تأییدِ دیروز/امروزِ قدیمی یک ثبتِ رایگانِ اضافه باز نکند.
 * حداکثر یک اسکنِ دوباره برای کسی که همان لحظه تأیید کرده بود.
 */
class ConfirmEachPunchWithPresence extends Migration
{
    const TABLE = 'tbl_mobile_presence_confirm';

    public function up()
    {
        if (! $this->hasColumn('consumed_at')) {
            DB::statement('ALTER TABLE `' . self::TABLE . '` ADD COLUMN `consumed_at` datetime DEFAULT NULL AFTER `confirmed_ip`');
        }

        // کلیدِ یکتا مانعِ چند تأیید در یک روز است؛ دیگر لازم نیست.
        if ($this->hasIndex('uniq_presence_day')) {
            DB::statement('ALTER TABLE `' . self::TABLE . '` DROP INDEX `uniq_presence_day`');
        }

        // جست‌وجویِ هر ثبت: «آخرین تأییدِ مصرف‌نشدهٔ این کارمند در این روز».
        if (! $this->hasIndex('idx_presence_pending')) {
            DB::statement('ALTER TABLE `' . self::TABLE . '` ADD KEY `idx_presence_pending` (`customer_id`, `dmy`, `consumed_at`)');
        }

        // ردیف‌های قدیمی با قاعدهٔ «کلِ روز» نوشته شده‌اند؛ از این به بعد
        // نباید یک ثبتِ تازه را باز کنند.
        DB::table(self::TABLE)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => DB::raw('`confirmed_at`')]);
    }

    public function down()
    {
        if ($this->hasIndex('idx_presence_pending')) {
            DB::statement('ALTER TABLE `' . self::TABLE . '` DROP INDEX `idx_presence_pending`');
        }

        if ($this->hasColumn('consumed_at')) {
            DB::statement('ALTER TABLE `' . self::TABLE . '` DROP COLUMN `consumed_at`');
        }

        // بازگرداندنِ قاعدهٔ قدیمی فقط وقتی ممکن است که روزی بیش از یک ردیف
        // نداشته باشد؛ وگرنه ایندکس ساخته نمی‌شود و همین چندتایی‌بودن، درست
        // همان چیزی است که این migration عمداً ممکن کرد.
        if (! $this->hasIndex('uniq_presence_day')) {
            $duplicate = DB::selectOne(
                'SELECT COUNT(*) AS `rows` FROM (SELECT `customer_id`, `dmy` FROM `' . self::TABLE . '` GROUP BY `customer_id`, `dmy` HAVING COUNT(*) > 1) AS `dup`'
            );

            if (empty($duplicate) || (int) $duplicate->rows === 0) {
                DB::statement('ALTER TABLE `' . self::TABLE . '` ADD UNIQUE KEY `uniq_presence_day` (`customer_id`, `dmy`)');
            }
        }
    }

    /** ستون هست؟ (اجرای دوباره نباید بشکند) */
    private function hasColumn($column)
    {
        return ! empty(DB::select('SHOW COLUMNS FROM `' . self::TABLE . "` LIKE '" . $column . "'"));
    }

    /** ایندکس هست؟ */
    private function hasIndex($name)
    {
        return ! empty(DB::select('SHOW INDEX FROM `' . self::TABLE . "` WHERE Key_name = '" . $name . "'"));
    }
}
