<?php

namespace App\Http\Controllers;

use App\Bank;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BankController extends Controller
{
    public static function tableData($id, $table_name)
    {
        $data = DB::table($table_name)
            ->where('id', $id)
            ->first();

        return $data;
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create(Request $request)
    {
       $bank = Bank::create([
           'sheba_num' => $request['sheba_num'],
           'account_num' => $request['account_num'],
           'card_num' => $request['card_num'],
       ]);

       if ( auth()->guard('manager')->check() ||
            auth()->check()){
            CustomerBankController::create(
                self::tableData($request['customer_id'],'users'),
                $bank->id);
       }

       return redirect()->route('home');
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
