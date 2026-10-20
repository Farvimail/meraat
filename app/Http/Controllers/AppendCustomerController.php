<?php

namespace App\Http\Controllers;

use App\AppendCustomer;
use App\SavedTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppendCustomerController extends Controller
{
    public static function firstPresent($id)
    {
        $savedTime = SavedTime::create([
            'time' => SavedTimeController::timeNow(),
            'start' => 1,
            'pause' => 0,
        ]);

        TimerController::create(
            SavedTimeController::tableData($id,'users'),
            SavedTimeController::findToday()->id,
            $savedTime->id
        );
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($managerData, $customerData)
    {
        AppendCustomer::create([
            'manager_id' => $managerData->id,
            'manager_email' => $managerData->email,
            'customer_id' => $customerData->id,
            'national_code' => $customerData->national_code,
        ]);

        self::firstPresent($customerData->id);
    }

    public static function managerId()
    {
        $auth = auth()->guard('manager');
        return $auth->id();
    }
    /**
     * Display the specified resource.
     *
     * @param  \App\AppendCustomer  $appendCustomer
     * @return \Illuminate\Http\Response
     */
    /**
     * فهرست کارمندان مدیر برای کارت‌های پنل.
     *
     * حالت پیش‌فرض فهرست «فعال» است؛ همهٔ فراخوان‌های موجود (کارت‌های
     * کارمند، تقویم‌ها، لیست‌های انتخاب کارمند) همین را می‌خواهند و با
     * ستون archived_at هم فیلتر می‌شوند تا کارمند آرشیوشده دیگر تایمر
     * و کارت فعال نداشته باشد. با true، کارمندان آرشیوشده برمی‌گردند
     * تا بخش «آرشیو کارمندها» همان کارت‌ها را با وضعیت غیرفعال نشان دهد.
     */
    public static function showManagerCustomers($archived = false)
    {
        // Memoised: several sections of the same page render the same list.
        static $cached = array();

        $key = $archived ? 'archived' : 'active';

        if (array_key_exists($key, $cached)) {
            return $cached[$key];
        }

        //find out what mannager is online
        $manager_id = self::managerId();
        //find manager's customers
        $query = DB::table('tbl_append_customer')
            ->join('users','tbl_append_customer.customer_id','=','users.id')
            ->join('tbl_timer',  'users.id', '=', 'tbl_timer.customer_id')
            ->where('manager_id', 3);

        if ($archived) {
            $query->whereNotNull('users.archived_at');
        } else {
            $query->whereNull('users.archived_at');
        }

        $customers = $query
            ->groupBy('tbl_timer.customer_id')
            ->select('*',DB::raw('count(tbl_timer.customer_id) as "activity"'))
            ->orderBy('activity', 'desc')
            ->get();

            // dd($customers);
        return $cached[$key] = $customers;
    }

    /**
     * گوشیِ فعالِ (هنوز آزادنشدهٔ) یک کارمند — برای تبِ «ویرایش» پنل.
     *
     * چرا لازم است: قیدِ «یک کارمند، یک گوشی» وقتی اپ پاک و دوباره نصب شود
     * (شناسهٔ نصب عوض می‌شود) یا گوشی عوض شود، ورودِ بعدی را با
     * `device_already_bound` رد می‌کند. تا امروز تنها راهِ باز کردنش دستورِ
     * `php artisan mobile:release` روی سرور بود؛ حالا مدیر همان کار را از
     * خودِ کارتِ کارمند می‌کند و اینجا فقط وضعیت نمایش داده می‌شود.
     */
    public static function activeDevice($id)
    {
        static $cache = array();

        if (array_key_exists($id, $cache))
        {
            return $cache[$id];
        }

        return $cache[$id] = DB::table('tbl_mobile_device')
            ->where('customer_id', $id)
            ->whereNull('released_at')
            ->orderBy('id', 'desc')
            ->first();
    }

    public static function showCustomer($id)
    {
        static $cache = array();

        if (array_key_exists($id, $cache)) {
            return $cache[$id];
        }

        return $cache[$id] = DB::table('users')
            ->where('id', $id)
            ->first();
    }
    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\AppendCustomer  $appendCustomer
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, AppendCustomer $appendCustomer)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\AppendCustomer  $appendCustomer
     * @return \Illuminate\Http\Response
     */
    public function destroy(AppendCustomer $appendCustomer)
    {
        //
    }
}
