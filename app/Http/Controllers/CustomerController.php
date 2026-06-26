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
