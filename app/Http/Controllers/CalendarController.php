<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CalendarController extends Controller
{
    public static function findPackage()
    {
        // Memoised: the dashboard calls this dozens of times per render
        // (once per customer and once per calendar cell) for the same answer.
        static $cached = null;

        if ($cached !== null) {
            return $cached;
        }

        date_default_timezone_set("Asia/Tehran");

        return $cached = DB::table('tbl_calendar')
            ->where('dmy', FunctionsController::systemDmy())
            ->where('status', '<>', '3')
            ->orderBy('id', 'desc')
            ->first()
            ->package;
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function show()
    {
        // Memoised: the dashboard used to re-read the whole calendar table
        // twice per rendered cell (hundreds of full table scans per page).
        static $cached = null;

        if ($cached === null) {
            $cached = DB::table('tbl_calendar')
                ->where('package', self::findPackage())
                ->get();
        }

        return $cached;
    }

    /**
     * Display the specified month days.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function packageMonths($year)
    {
        return DB::table('tbl_calendar')
            ->where('fa_date', 'like', '%'.$year)
            ->groupBy('package')
            ->orderBy('package','asc')
            ->get();
    }

    /**
     * Display the specified month days.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function selectedPackage($package)
    {
        // Memoised: the yearly calendar re-read the whole package twice per
        // rendered cell, i.e. hundreds of full table scans per page.
        static $cache = array();

        if (!array_key_exists($package, $cache)) {
            $cache[$package] = DB::table('tbl_calendar')
                ->where('package', $package)
                ->get();
        }

        return $cache[$package];
    }

    public static function detectSolarDate()
    {
        $today = DB::table('tbl_calendar')
            ->where('dmy', FunctionsController::systemDmy())
            ->where('status','<>',3)
            ->orderBy('id','desc')
            ->first();

        return explode('/',$today->fa_date)[2];
    }

    /**
     * آیا تاریخ میلادی این ردیف با تاریخ شمسی‌اش می‌خواند؟
     *
     * در این جدول برای بعضی روزها دو ردیف ثبت شده: یکی با میلادی درست و یکی
     * با میلادی یک ماه جابه‌جا. ردیف ناهمخوان را نباید مبنای مهرزمان گرفت،
     * وگرنه «امروزِ سامانه» یک ماه عقب/جلو می‌افتد.
     *
     * @param  object $row
     * @return bool
     */
    protected static function datesAgree($row)
    {
        $jalali = FunctionsController::gregorianToJalali(
            (int) $row->year,
            (int) $row->month,
            (int) $row->day
        );

        // fa_date به شکل «روز/ماه/سال» است و روزِ یک‌رقمی صفر ابتدایی ندارد.
        $expected = sprintf('%d/%02d/%04d', $jalali[2], $jalali[1], $jalali[0]);

        return trim((string) $row->fa_date) === $expected;
    }

    /**
     * بستهٔ تقویمیِ یک تاریخ میلادی (برای نمایش «کدام ماه فعال است»).
     *
     * @param  string $date Y-m-d
     * @return int|null
     */
    public static function packageOfDate($date)
    {
        $row = DB::table('tbl_calendar')
            ->where('dmy', date('dmY', strtotime($date)))
            ->orderBy('id', 'desc')
            ->first();

        return empty($row) ? null : (int) $row->package;
    }

    /**
     * ردیف آغاز یک بستهٔ تقویمی (روز اول همان ماه شمسی).
     *
     * @param  int $package
     * @return object|null
     */
    protected static function firstRowOfPackage($package)
    {
        // حافظهٔ درون‌درخواستی: در یک رندر هم فهرست ماه‌ها و هم کنترل تاریخ
        // همین ردیف را می‌خواهند، پس هر بسته فقط یک بار خوانده می‌شود.
        static $cache = array();

        if (array_key_exists($package, $cache)) {
            return $cache[$package];
        }

        $columns = ['year', 'month', 'day', 'fa_month', 'fa_date'];

        $starts = DB::table('tbl_calendar')
            ->where('package', $package)
            ->whereRaw("substring_index(fa_date, '/', 1) = '1'")
            ->orderByRaw('year * 10000 + month * 100 + day asc')
            ->get($columns);

        foreach ($starts as $row) {
            if (self::datesAgree($row)) {
                return $cache[$package] = $row;
            }
        }

        // بسته‌ای که ردیف «روز اول» ندارد (مثلاً داده‌اش از نیمهٔ ماه شروع
        // می‌شود): اولین ردیفِ موثق، وگرنه اولین ردیف.
        $rows = DB::table('tbl_calendar')
            ->where('package', $package)
            ->orderByRaw('year * 10000 + month * 100 + day asc')
            ->get($columns);

        foreach ($rows as $row) {
            if (self::datesAgree($row)) {
                return $cache[$package] = $row;
            }
        }

        return $cache[$package] = $rows->first();
    }

    /**
     * اولین روز یک بستهٔ تقویمی (ماه) به شکل میلادی Y-m-d.
     *
     * ستون dmy عددی است و برای روزهای یک‌رقمی صفر ابتدایی‌اش را از دست
     * می‌دهد، پس از ستون‌های سال/ماه/روز استفاده می‌کنیم که همیشه عددی‌اند.
     *
     * @param  int $package
     * @return string|null
     */
    public static function firstDayOfPackage($package)
    {
        $row = self::firstRowOfPackage($package);

        if (empty($row)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $row->year, $row->month, $row->day);
    }

    /**
     * فهرست ماه‌های موجود در تقویم سامانه (جدیدترین اول) برای انتخاب در
     * کنترل «تاریخ فعال سامانه».
     *
     * @param  int $limit
     * @return array
     */
    public static function availablePeriods($limit = 30)
    {
        // ترتیب تقویمی با ymd است، نه با ستون dmy (دایمی: 09102026 عدد کمتری
        // از 10102026 دارد و مرز سال هم درهم می‌ریزد).
        // سقف، امروزِ واقعی است (نه تاریخ فعال سامانه) تا وقتی مدیر روی ماهی
        // در گذشته کار می‌کند، ماه جاری هم در فهرست بماند و بتواند برگردد.
        $ceiling = (int) str_replace('-', '', FunctionsController::realDate());

        // یک ردیف برای هر بسته، و همان ردیفی که PanelDateController با انتخاب
        // آن تاریخ را فعال می‌کند؛ پس برچسب فهرست با تاریخ فعال همیشه می‌خواند.
        $packages = DB::table('tbl_calendar')
            ->select('package')
            ->groupBy('package')
            ->havingRaw('min(year * 10000 + month * 100 + day) <= ?', [$ceiling])
            ->orderByRaw('min(year * 10000 + month * 100 + day) desc')
            ->limit((int) $limit)
            ->get();

        $periods = array();

        foreach ($packages as $package) {
            $row = self::firstRowOfPackage((int) $package->package);

            if (empty($row)) {
                continue;
            }

            $parts = explode('/', trim((string) $row->fa_date));
            $year  = isset($parts[2]) ? trim($parts[2]) : '';

            $periods[] = array(
                'package' => (int) $package->package,
                'month'   => $row->fa_month,
                'year'    => (int) $year,
                'label'   => FunctionsController::e2p(trim($row->fa_month . ' ' . $year)),
            );
        }

        return $periods;
    }

}
