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
    public static function showManagerCustomers()
    {
        //find out what mannager is online
        $manager_id = self::managerId();
        //find manager's customers
        $customers = DB::table('tbl_append_customer')
            ->join('users','tbl_append_customer.customer_id','=','users.id')
            ->join('tbl_timer',  'users.id', '=', 'tbl_timer.customer_id')
            ->where('manager_id', 3)
            ->groupBy('tbl_timer.customer_id')
            ->select('*',DB::raw('count(tbl_timer.customer_id) as "activity"'))
            ->orderBy('activity', 'desc')
            ->get();

            // dd($customers);
        return $customers;
    }

    public static function showCustomer($id)
    {
        return DB::table('users')
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
