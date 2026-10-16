<?php

namespace App\Http\Controllers;

use App\Timer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TimerController extends Controller
{
    public static function findToday()
    {
        // «تاریخ فعال سامانه» (پیش‌فرض: امروز) تا مدیر بتواند مثل گذشته
        // داخل ماه‌های قبل کار کند، بدون دست زدن به ساعت سرور.
        return FunctionsController::systemDmy();
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($data, $calendar_id, $saved_time_id)
    {
        Timer::create([
            'calendar_id' => $calendar_id,
            'saved_time_id' => $saved_time_id,
            'national_code' => $data->national_code,
            'customer_id' => $data->id,
            'customer_email' => $data->email
        ]);
    }

    public static function check($id)
    {
        static $cache = array();

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ])
            ->select('dmy',DB::raw("concat(month,'/',day,'/',year,', ',time) as 'date'"))
            ->orderBy('tbl_saved_time.id','asc')
            ->get();
        //mdy

        return $cache[$id] = $time;
    }

    /**
     * رکوردهای یک روز که تایمر پنل روی آن حساب می‌شود.
     *
     * همین خروجی به اپ هم می‌رسد (`MobileApiController::todayPayload`) و هر
     * دو طرف عدد را از همین رکوردها می‌سازند؛ پس شرطِ «رکوردهای حذف‌شده»
     * باید در هر دو یکی باشد، وگرنه کارکردِ پنل و اپ از هم جدا می‌افتد.
     */
    public static function timerDate($id, $dmy)
    {
        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->join('users','tbl_timer.customer_id','=','users.id')
            ->where([
                'tbl_calendar.dmy'=> $dmy,
                'customer_id'=> $id
            ])
            ->where(function ($query) {
                $query->where('tbl_saved_time.deleted', 0)
                    ->orWhereNull('tbl_saved_time.deleted');
            })
            ->select('dmy',DB::raw("concat(month,'/',day,'/',year,', ',time) as 'date'"), 'start', 'pause', 'users.name')
            ->orderBy('tbl_saved_time.id','asc')
//            ->groupBy('tbl_timer.customer_id')
            ->get();

        return $time;
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

        $findToday = self::findToday();
        $time = self::timerDate($request['id'], $findToday);
        return json_encode($time);
    }

    /**
     * «انگشتِ تغییر» امروزِ چند کارمند، در **یک** درخواست.
     *
     * چرا لازم است: پنل باید بفهمد روی گوشی ثبت تازه‌ای انجام شده یا نه.
     * اگر هر کارت خودش هر ۱۰ ثانیه کل رکوردهایش را بخواند، صفحه‌ای با ۳۰
     * کارمند ۳ درخواست در ثانیه می‌فرستد — روی هاست اشتراکی یعنی کندیِ همه.
     * اینجا با یک کوئریِ جمع‌زده فقط می‌گوییم «برای هر کارمند چند رکورد و
     * آخرینشان کدام است»؛ پنل این عدد را با قبلی مقایسه می‌کند و فقط کارتی
     * که عوض شده رکوردهایش را می‌خواند.
     *
     * خروجی: `{"12":"3:918","15":"0:0"}` — یعنی کارمند ۱۲ سه رکورد دارد که
     * آخرینشان id=918 است، و کارمند ۱۵ امروز هیچ رکوردی ندارد.
     */
    public function revision(Request $request)
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', (array) $request['ids']))));

        if (! $ids)
            return json_encode(array());

        $rows = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where('tbl_calendar.dmy', self::findToday())
            ->whereIn('tbl_timer.customer_id', $ids)
            ->where(function ($query) {
                $query->where('tbl_saved_time.deleted', 0)
                    ->orWhereNull('tbl_saved_time.deleted');
            })
            ->groupBy('tbl_timer.customer_id')
            ->select('tbl_timer.customer_id', DB::raw('count(*) as rows_count'), DB::raw('max(tbl_saved_time.id) as last_id'))
            ->get();

        $map = array();

        // کارمندِ بی‌ثبت هم کلید می‌گیرد؛ وگرنه «نبودنِ کلید» با «عوض‌نشدن»
        // قاطی می‌شود و پنل نمی‌فهمد اولین ثبتِ روز رسیده است.
        foreach ($ids as $id)
            $map[$id] = '0:0';

        foreach ($rows as $row)
            $map[$row->customer_id] = $row->rows_count . ':' . $row->last_id;

        return json_encode($map);
    }

    public static function noPause($id)
    {
        $toDay = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ]);
        return $toDay;
    }

    public static function todayOffset($package)
    {
        if ( CalendarController::findPackage() > $package)
            return 35;
// dd(self::findToday());
// dd(DB::table('tbl_calendar')
// ->where('package' , $package)
// ->where('status', '<>', 3)->get());

        $start = DB::table('tbl_calendar')
            ->where('package' , $package)
            ->where('status', '<>', 3)
            ->first()
            ->id;

        $target = DB::table('tbl_calendar')
            ->where([
                'dmy'=> self::findToday()
            ])
            ->where('package' , $package);

        if ( $target->exists()):
            $target = $target
                ->orderBy('month')
                ->orderBy('year')
                ->first()
                ->id;
            return $target-$start;
        endif;

        return 0;
    }

    public static function pastDays($dmy)
    {
        // The result does not depend on $dmy (the comparison below is
        // commented out in the original code), so it is the same for every
        // cell of every customer - compute it once per request.
        static $cached = null;

        if ($cached !== null) {
            return $cached;
        }

        $pakage = CalendarController::findPackage();
// dd($pakage,self::todayOffset($pakage)+1);
        $calendar = DB::table('tbl_calendar')
            ->where('package' , $pakage)
            ->where('status', '<>', 3)
            ->offset(0)
            ->limit(self::todayOffset($pakage)+1)
            ->get();

        $found = false;
        foreach ($calendar as $item):
//            if ( $item->dmy == $dmy )
                $found = true;
        endforeach;

        return $cached = $found;
    }

    public function calendarData()
    {
        $days = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ]);
    }

    /**
     * All presence rows of one customer keyed by calendar id, so a page that
     * draws a whole month can use one query instead of one query per day.
     * The first row per calendar id wins, which matches the original
     * ->first() call in the views.
     */
    public static function savedTimesMap($id)
    {
        static $cache = array();

        if (isset($cache[$id])) {
            return $cache[$id];
        }

        $rows = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->where('customer_id', $id)
            ->select('calendar_id','start','pause')
            ->get();

        $map = array();
        foreach ($rows as $row) {
            if (!array_key_exists($row->calendar_id, $map)) {
                $map[$row->calendar_id] = $row;
            }
        }

        return $cache[$id] = $map;
    }

    public static function savedTimes($id, $cid)
    {
        $times = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->where([
                'calendar_id' => $cid,
                'customer_id'=> $id
            ]);
        return $times;
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
    }
}
