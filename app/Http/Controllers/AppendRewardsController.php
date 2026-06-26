<?php

namespace App\Http\Controllers;

use App\AppendRewards;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class AppendRewardsController extends Controller
{

    public function validation($request, $rules, $messages = [], $customAttributes = [])
    {
        $validator = Validator::make($request->all(), $rules, $messages, $customAttributes);
        if ($validator->fails()) {
            return $validator->errors()->toArray();
        }
    }

    public function create(Request $request)
    {
        AppendRewards::create([
            'manager_id' => 3,
            'manager_email' => 'torabi16298@gmail.com',
            'customer_id' => $request['customer_id'],
            'reward_value' => $request['reward_value'],
            'package' => $request['package'],
        ]);

        $request->session()->flash('status', 'پاداش با موفقیت ثبت شد');
        return redirect()->route('desc');
    }

    public function update(Request $request)
    {
        $rules = [
            'customer_id' => 'required|integer|exists:App/User,id'
        ];
        $errors = $this->validation($request, $rules);
        if ($errors) $request->session()->flash('status', 'کاربر مورد نظر انتخاب نشده است!');
        else{
            AppendRewards::where('id', $request['id'])->update([
                'customer_id' => $request['customer_id'],
                'reward_value' => $request['reward_value'],
                'package' => $request['package'],
            ]);

            $request->session()->flash('status', 'پاداش با موفقیت بروزرسانی شد.');
        }
        return redirect()->route('desc');
    }

    public static function showManagerCustomer()
    {
        $customers = DB::table('users')
            ->join('tbl_append_customer','users.id','=','tbl_append_customer.customer_id')
            ->where([
                'manager_id' => 3,
            ])
            ->orderBy('users.id', 'desc')
            ->get();
        return $customers;
    }

    public static function showManagerRewards($package)
    {
        $customers = DB::table('users')
            ->join('tbl_append_customer','users.id','=','tbl_append_customer.customer_id')
            ->join('tbl_append_rewards','users.id','=','tbl_append_rewards.customer_id')
            ->where([
                'tbl_append_customer.manager_id' => 3,
                'package' => $package,
            ])
            ->orderBy('users.id', 'desc')
            ->get();
        return $customers;
    }

    public static function selectedManagerCustomer($package=null, $customer_id=null)
    {
        $restric = isset($package) && isset($customer_id) ? [
            'tbl_append_customer.manager_id' => 3,
            'package' => FunctionsController::package(),
            'users.id' => $customer_id
        ] : [
            'package' => FunctionsController::package(),
            'tbl_append_customer.manager_id' => 3,
        ];

        $customers = DB::table('users')
            ->join('tbl_append_customer','users.id','=','tbl_append_customer.customer_id')
            ->join('tbl_append_rewards','users.id','=','tbl_append_rewards.customer_id')
            ->where($restric)
            ->orderBy('tbl_append_rewards.id', 'desc')
            ->get();
        return $customers;
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy(Request $request)
    {
        DB::table('tbl_append_rewards')
            ->where('id','=',$request['id'])
            ->delete();

        $request->session()->flash('status', 'پاداش با موفقیت حذف شد.');
        return redirect()->route('desc');
    }

    public static function getReward($package, $customer_id)
    {
        $target = AppendRewards::where([
            'package' => $package,
            'customer_id' => $customer_id
        ])->first();

        return $target->reward_value;
    }

    public function rewardTable(Request $request)
    {
        $fishMonth = SalaryController::fishMonth($request['month_id']);
        $findToday = SalaryController::findMonth($request['month_id']);

        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('rewards.fishtable',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public function totalRewards(Request $request)
    {
        $fishMonth = SalaryController::fishMonth($request['month_id']);
        $findToday = SalaryController::findMonth($request['month_id']);

        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('rewards.total',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public static function rewardTime()
    {
        //dd(FunctionsController::package());
        return DB::table('tbl_calendar')
            ->where('package', '=', FunctionsController::package())
            ->where('fa_month' , '=', 'اسفند')
            ->exists();
    }
}
