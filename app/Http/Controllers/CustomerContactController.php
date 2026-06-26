<?php

namespace App\Http\Controllers;

use App\CustomerContact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerContactController extends Controller
{
    public static function create($data, $id)
    {
        DB::table('tbl_customer_contact')
            ->updateOrInsert(
                ['customer_id' => $data->id],
                [
                    'contact_id' => $id,
                    'national_code' => $data->national_code,
                    'customer_id' => $data->id,
                    'customer_email' => $data->email,
                ]
            );
    }

    public static function showCustomerBankInfo($id)
    {
        return DB::table('tbl_contact_info')
            ->join('tbl_customer_contact','tbl_contact_info.id','=','tbl_customer_contact.contact_id')
            ->where('customer_id', $id)
            ->select('mobile_num', 'phone_num', 'address')
            ->first();
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\CustomerContact  $customerContact
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, CustomerContact $customerContact)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\CustomerContact  $customerContact
     * @return \Illuminate\Http\Response
     */
    public function destroy(CustomerContact $customerContact)
    {
        //
    }
}
