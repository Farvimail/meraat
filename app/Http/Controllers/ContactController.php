<?php

namespace App\Http\Controllers;

use App\Contact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactController extends Controller
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
        $contact = Contact::create([
            'phone_num' => $request['phone_num'],
            'mobile_num' => $request['mobile_num'],
            'address' => $request['address'],
        ]);

        if ( auth()->guard('manager')->check() ||
            auth()->check()){
            CustomerContactController::create(
                self::tableData($request['customer_id'],'users'),
                $contact->id);
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
