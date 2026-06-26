<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerBankController extends Controller
{
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($data, $id)
    {
        DB::table('tbl_customer_bank')
            ->updateOrInsert(
                ['customer_id' => $data->id],
                [
                    'bank_id' => $id,
                    'national_code' => $data->national_code,
                    'customer_id' => $data->id,
                    'customer_email' => $data->email,
                ]
            );
    }

    public static function showCustomerBankInfo($id)
    {
        return DB::table('tbl_bank_info')
            ->join('tbl_customer_bank','tbl_bank_info.id','=','tbl_customer_bank.bank_id')
            ->where('customer_id', $id)
            ->select('sheba_num', 'account_num', 'card_num')
            ->first();
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
