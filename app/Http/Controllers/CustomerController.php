<?php

namespace App\Http\Controllers;

use App\CustomerRole;
use App\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\AppendRolesController;

class CustomerController extends Controller
{
    public static function tableData($id, $table_name)
    {
        $data = DB::table($table_name)
            ->where('id', $id)
            ->first();

        return $data;
    }

    public function create(Request $data)
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'national_code' => $data['national_code'],
            'password' => Hash::make($data['password']),
        ]);

        if ( auth()->guard('manager')->check() )
        {
            $manager_id = AppendRolesController::getManagerAuth();
            AppendCustomerController::create(
                self::tableData($manager_id, 'managers'),
                self::tableData($user->id, 'users'));

            $data->session()->flash('status', 'کارمند جدید با موفقیت به سیستم اضافه شد');
            return redirect()->route('desc');
        }
    }

    public function showCalendarYear(Request $request)
    {
        $manager_id = AppendRolesController::getManagerAuth();
        return view('calendar.activity_month',[
            'year' => $request['y'],
            'customer_id' => $request['cid'],
            'customer' => User::where('id',$request['cid'])->first(),
            'role' => AppendRolesController::selectedManagerRole(\App\Http\Controllers\FunctionsController::soonPackage(), $request['cid'])
        ]);
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request)
    {
        /*dd($request['role_id']*10/10);
        return 0;*/

        DB::table('users')
            ->where('id', $request['customer_id'])
            ->update([
                'name' => $request['name'],
                'national_code' => $request['national_code'],
            ]);

        if ( intval($request['role_id']) )
        {
            CustomerRole::create([
                'role_id' => $request['role_id'],
                'national_code' => $request['national_code'],
                'customer_id' =>  $request['customer_id'],
                'customer_email' =>  self::tableData($request['customer_id'], 'users')->email,
            ]);
        }

        $request->session()->flash('status', 'Customer info updated successfully');
        return redirect()->route('desc');
    }

    /**
     * انتقال کارمند به آرشیو.
     *
     * کارمند آرشیوشده از فهرست «کارمندها» (و در نتیجه از کارت‌های تایمر و
     * لیست‌های انتخاب کارمند) خارج می‌شود ولی همهٔ داده‌هایش در سیستم می‌ماند
     * و با «بازگردانی» دوباره فعال می‌شود. ستون users.archived_at را
     * مهاجرت 2026_10_09_000001 می‌سازد.
     */
    public function archive(Request $request, $id)
    {
        DB::table('users')
            ->where('id', $id)
            ->update(['archived_at' => date('Y-m-d H:i:s')]);

        $request->session()->flash('status', 'کارمند در آرشیو قرار گرفت');
        return redirect(route('desc') . '#customers_archive');
    }

    /**
     * خارج‌کردن کارمند از آرشیو و بازگشت به فهرست فعال‌ها.
     */
    public function restore(Request $request, $id)
    {
        DB::table('users')
            ->where('id', $id)
            ->update(['archived_at' => null]);

        $request->session()->flash('status', 'کارمند از آرشیو خارج شد و دوباره فعال است');
        return redirect(route('desc') . '#customers');
    }

    /**
     * گزارش کامل یک کارمند.
     *
     * شامل: تاریخ ورود به مجموعه، اولین و آخرین فعالیت، آمار حضور/غیبت از
     * زمان ورود تا امروز، مجموع ساعت‌های کاری و اضافه‌کاری، مجموع دریافتی
     * (عملکرد + امتیازات + پاداش) و جدول ماهانهٔ کامل از اولین ماه حضور.
     *
     * همهٔ اعداد با همان توابع کارت‌های داشبورد (getSum/sumParts/monthTime)
     * به‌دست می‌آیند تا دقیقاً همان چیزی باشند که مدیر در کارت‌ها می‌بیند.
     */
    public function report(Request $request, $id)
    {
        date_default_timezone_set('Asia/Tehran');

        $customer = DB::table('users')->where('id', $id)->first();
        if (empty($customer)) {
            abort(404);
        }

        $cid = (int) $id;

        // ----------------------------------------------------------
        // روزهای حضور: هر ردیف tbl_timer یک رویداد است؛ روی روز گروه می‌گیریم.
        // تقویم بین دو بسته چند روز را تکرار می‌کند، پس روی تاریخ میلادی
        // یکتا می‌شویم تا «روزهای فعال» درست شمرده شوند.
        // ----------------------------------------------------------
        $dayRows = DB::table('tbl_timer')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where('tbl_timer.customer_id', $cid)
            ->groupBy('tbl_timer.calendar_id')
            ->select(
                'tbl_calendar.year', 'tbl_calendar.month', 'tbl_calendar.day',
                'tbl_calendar.fa_date', 'tbl_calendar.status', 'tbl_calendar.package'
            )
            ->get();

        $eventCount = DB::table('tbl_timer')->where('customer_id', $cid)->count();

        $present = [];
        foreach ($dayRows as $row) {
            $row->ymd = $row->year * 10000 + $row->month * 100 + $row->day;
            if (!isset($present[$row->ymd])) {
                $present[$row->ymd] = $row;
            }
        }
        ksort($present);

        $firstAct = count($present) ? reset($present) : null;
        $lastAct  = count($present) ? end($present) : null;

        // ----------------------------------------------------------
        // بازهٔ گزارش: از ورود (یا اولین فعالیت، هر کدام زودتر) تا امروز.
        // اگر آخرین فعالیت از امروز جلوتر باشد، انتهای بازه تا همان روز
        // کشیده می‌شود تا غیبت منفی نشود.
        // ----------------------------------------------------------
        $joined = $customer->created_at ? strtotime($customer->created_at) : null;
        $endYmd = (int) date('Ymd');
        if ($lastAct && $lastAct->ymd > $endYmd) {
            $endYmd = $lastAct->ymd;
        }

        $startYmd = $joined ? (int) date('Ymd', $joined) : $endYmd;
        if ($firstAct && $firstAct->ymd < $startYmd) {
            $startYmd = $firstAct->ymd;
        }

        $presentSet = [];
        foreach ($present as $ymd => $row) {
            $presentSet[$ymd] = true;
        }

        // ----------------------------------------------------------
        // روزهای تقویم داخل بازه، بدون تکرار بین دو بسته (MIN(id) همان
        // ردیفی است که خودِ برنامه با first() پیدا می‌کند).
        // وضعیت: ۱ کاری، ۲ جمعه/موارد خاص، ۳ تعطیل.
        // ----------------------------------------------------------
        $windowDays = DB::select(
            "SELECT c.package, c.status, k.y*10000 + k.m*100 + k.d AS ymd
             FROM (SELECT year y, month m, day d, MIN(id) mid FROM tbl_calendar GROUP BY year, month, day) k
             JOIN tbl_calendar c ON c.id = k.mid
             WHERE k.y*10000 + k.m*100 + k.d BETWEEN ? AND ?",
            [$startYmd, $endYmd]
        );

        $statWork = 0; $statHoliday = 0; $statFriday = 0;
        $statPresent = 0; $statAbsent = 0;
        $workingByPkg = [];

        foreach ($windowDays as $day) {
            if ($day->status == 1) {
                $statWork++;
                $workingByPkg[$day->package][] = $day->ymd;
                if (!isset($presentSet[$day->ymd])) {
                    $statAbsent++;
                }
            } elseif ($day->status == 2) {
                $statFriday++;
            } else {
                $statHoliday++;
            }
        }

        foreach ($present as $ymd => $row) {
            if ($ymd >= $startYmd && $ymd <= $endYmd) {
                $statPresent++;
            }
        }

        // ----------------------------------------------------------
        // بازهٔ ماه‌های جدول: از بستهٔ روز شروع تا بستهٔ امروز (یا تاریخ
        // فعال سامانه، هر کدام جلوتر) تا جدول همیشه تا امروز ادامه داشته باشد.
        // ----------------------------------------------------------
        $endPkg = FunctionsController::package();
        $realPkg = DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->where('status', '<>', 3)
            ->orderBy('id', 'desc')
            ->first();
        if ($realPkg && $realPkg->package > $endPkg) {
            $endPkg = (int) $realPkg->package;
        }

        $startPkg = DB::selectOne(
            'SELECT MIN(package) p FROM tbl_calendar WHERE year*10000 + month*100 + day = ?',
            [$startYmd]
        );
        $startPkg = $startPkg && $startPkg->p ? (int) $startPkg->p : 1;
        if ($startPkg > $endPkg) {
            $startPkg = $endPkg;
        }

        // برچسب ماه هر بسته از اولین روزِ همان بسته خوانده می‌شود.
        $monthMeta = DB::select(
            "SELECT c.package, c.fa_month, c.fa_date
             FROM tbl_calendar c
             JOIN (SELECT package, MIN(id) mid FROM tbl_calendar WHERE package BETWEEN ? AND ? GROUP BY package) f
               ON f.mid = c.id
             ORDER BY c.package",
            [$startPkg, $endPkg]
        );

        // روزهای حضور به تفکیک بسته (برای ستون حضور جدول)
        $presentByPkg = [];
        foreach ($present as $row) {
            if (!isset($presentByPkg[$row->package])) {
                $presentByPkg[$row->package] = 0;
            }
            $presentByPkg[$row->package]++;
        }

        // پاداش‌ها؛ اولین ردیف هر ماه (همان چیزی که کارت پاداش نشان می‌دهد)
        $rewardByPkg = [];
        $rewardRows = DB::table('tbl_append_rewards')
            ->where('customer_id', $cid)
            ->orderBy('id')
            ->get();
        foreach ($rewardRows as $reward) {
            if (!isset($rewardByPkg[$reward->package])) {
                $rewardByPkg[$reward->package] = (int) $reward->reward_value;
            }
        }

        // ----------------------------------------------------------
        // جدول ماهانه: همان getSum کارت‌های «گذشته» + پاداش + حضور/غیبت.
        // ----------------------------------------------------------
        $rows = [];
        $normalTimes = [];
        $extraTimes = [];
        $totalIncome = 0;
        $totalActivity = 0;
        $totalPoints = 0;
        $totalRewards = 0;
        $totalPresent = 0;
        $totalAbsent = 0;

        foreach ($monthMeta as $meta) {
            $pkg = (int) $meta->package;

            $sum = SalaryController::getSum($pkg, $cid);

            $presentDays = isset($presentByPkg[$pkg]) ? $presentByPkg[$pkg] : 0;

            $absentDays = 0;
            if (isset($workingByPkg[$pkg])) {
                foreach ($workingByPkg[$pkg] as $ymd) {
                    if (!isset($presentSet[$ymd])) {
                        $absentDays++;
                    }
                }
            }

            $reward = isset($rewardByPkg[$pkg]) ? $rewardByPkg[$pkg] : 0;
            $activity = (int) $sum['activity_value'];
            $points = (int) $sum['point_value'];
            $income = $activity + $points + $reward;

            $normalTimes[] = $sum['normal_time'];
            $extraTimes[] = $sum['extra_time'];

            $totalIncome += $income;
            $totalActivity += $activity;
            $totalPoints += $points;
            $totalRewards += $reward;
            $totalPresent += $presentDays;
            $totalAbsent += $absentDays;

            $rows[] = [
                'label'    => $meta->fa_month . ' ' . FunctionsController::e2p(substr($meta->fa_date, -4)),
                'present'  => $presentDays,
                'absent'   => $absentDays,
                'normal'   => $sum['normal_time'],
                'extra'    => $sum['extra_time'],
                'activity' => $activity,
                'points'   => $points,
                'reward'   => $reward,
                'income'   => $income,
            ];
        }

        // ----------------------------------------------------------
        // اطلاعات تکمیلی کارت بالای گزارش
        // ----------------------------------------------------------
        $weekNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
        $weekdayOf = function ($day) use ($weekNames) {
            if (!$day) {
                return '';
            }
            $dow = (int) date('w', mktime(0, 0, 0, $day->month, $day->day, $day->year));
            return ' (' . $weekNames[$dow] . ')';
        };

        $role = AppendRolesController::selectedManagerRole(FunctionsController::package(), $cid);
        if (!empty($role)) {
            $roleName = $role->name;
        } else {
            $roleFallback = SalaryController::customerRole($cid);
            $roleName = !empty($roleFallback) ? $roleFallback->name : '—';
        }

        return view('customers.report', [
            'customer'      => $customer,
            'roleName'      => $roleName,
            'joinedFa'      => $joined ? FunctionsController::e2p(FunctionsController::jdate($joined)) : '—',
            'memberDays'    => $joined ? (int) floor((time() - $joined) / 86400) : 0,
            'firstFa'       => $firstAct ? FunctionsController::e2p($firstAct->fa_date) . $weekdayOf($firstAct) : '—',
            'lastFa'        => $lastAct ? FunctionsController::e2p($lastAct->fa_date) . $weekdayOf($lastAct) : '—',
            'archivedFa'    => $customer->archived_at
                ? FunctionsController::e2p(FunctionsController::jdate(strtotime($customer->archived_at)))
                : null,
            'eventCount'    => $eventCount,
            'activeDays'    => count($present),
            'statWork'      => $statWork,
            'statPresent'   => $statPresent,
            'statAbsent'    => $statAbsent,
            'statHoliday'   => $statHoliday,
            'statFriday'    => $statFriday,
            'totalNormal'   => SalaryController::sumYearParts($normalTimes),
            'totalExtra'    => SalaryController::sumYearParts($extraTimes),
            'totalIncome'   => $totalIncome,
            'totalActivity' => $totalActivity,
            'totalPoints'   => $totalPoints,
            'totalRewards'  => $totalRewards,
            'totalPresent'  => $totalPresent,
            'totalAbsent'   => $totalAbsent,
            'rows'          => $rows,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy(Request $request)
    {
        DB::table('tbl_customer_bank')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_customer_contact')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_timer')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_customer_points')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_customer_roles')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_append_customer')
            ->where('customer_id', '=', $request['id'])
            ->delete();

        $request->session()->flash('status', 'کارمند با موفقیت حذف شد.');
        return redirect()->route('desc');
    }
}
