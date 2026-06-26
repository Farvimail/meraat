<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CalendarController extends Controller
{
    public static function findPackage()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->where('status', '<>', '3')
            ->orderBy('id', 'desc')
            ->first()
            ->package;
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function show()
    {
        return DB::table('tbl_calendar')
            ->where('package', self::findPackage())
            ->get();
    }

    /**
     * Display the specified month days.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function packageMonths($year)
    {
        return DB::table('tbl_calendar')
            ->where('fa_date', 'like', '%'.$year)
            ->groupBy('package')
            ->orderBy('package','asc')
            ->get();
    }

    /**
     * Display the specified month days.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public static function selectedPackage($package)
    {
        return DB::table('tbl_calendar')
            ->where('package', $package)
            ->get();
    }

    public static function detectSolarDate()
    {
        // dd(date("dmY"),
        $today = DB::table('tbl_calendar')
            ->where('dmy',date("dmY"))
            ->where('status','<>',3)
            ->orderBy('id','desc')
            ->first();

        return explode('/',$today->fa_date)[2];
    }

}
