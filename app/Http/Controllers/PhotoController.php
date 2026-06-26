<?php

namespace App\Http\Controllers;

use App\Photo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PhotoController extends Controller
{
    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public static function store($name, $path, $cid)
    {
        DB::table('tbl_users_profile')
            ->updateOrInsert(
                ['customer_id' => $cid],
                [
                    'name' => $name,
                    'path' => $path,
                    'customer_id' => $cid,
                    'uploaded_at' => SavedTimeController::timeNow()
                ]
            );
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Photo  $photo
     * @return \Illuminate\Http\Response
     */
    public static function show($cid)
    {
        return DB::table('users')
            ->join('tbl_users_profile', 'users.id', '=', 'tbl_users_profile.customer_id')
            ->where('users.id',$cid);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Photo  $photo
     * @return \Illuminate\Http\Response
     */
    public function destroy(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

        return DB::table('tbl_users_profile')
            ->where('customer_id', $request['cid'])
            ->delete();
    }
}
