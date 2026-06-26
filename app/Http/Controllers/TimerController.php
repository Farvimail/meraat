<?php

namespace App\Http\Controllers;

use App\Timer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TimerController extends Controller
{
    public static function findToday()
    {
        date_default_timezone_set("Asia/Tehran");
        return (string) date('dmY');
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($data, $calendar_id, $saved_time_id)
    {
        Timer::create([
            'calendar_id' => $calendar_id,
            'saved_time_id' => $saved_time_id,
            'national_code' => $data->national_code,
            'customer_id' => $data->id,
            'customer_email' => $data->email
        ]);
    }

    public static function check($id)
    {
        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ])
            ->select('dmy',DB::raw("concat(month,'/',day,'/',year,', ',time) as 'date'"))
            ->orderBy('tbl_saved_time.id','asc')
            ->get();
        //mdy

        return $time;
    }

    public static function timerDate($id, $dmy)
    {
        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->join('users','tbl_timer.customer_id','=','users.id')
            ->where([
                'tbl_calendar.dmy'=> $dmy,
                'customer_id'=> $id
            ])
            ->select('dmy',DB::raw("concat(month,'/',day,'/',year,', ',time) as 'date'"), 'start', 'pause', 'users.name')
            ->orderBy('tbl_saved_time.id','asc')
//            ->groupBy('tbl_timer.customer_id')
            ->get();

        return $time;
    }

    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

        $findToday = self::findToday();
        $time = self::timerDate($request['id'], $findToday);
        return json_encode($time);
    }

    public static function noPause($id)
    {
        $toDay = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ]);
        return $toDay;
    }

    public static function todayOffset($package)
    {
        if ( CalendarController::findPackage() > $package)
            return 35;
// dd(self::findToday());
// dd(DB::table('tbl_calendar')
// ->where('package' , $package)
// ->where('status', '<>', 3)->get());

        $start = DB::table('tbl_calendar')
            ->where('package' , $package)
            ->where('status', '<>', 3)
            ->first()
            ->id;

        $target = DB::table('tbl_calendar')
            ->where([
                'dmy'=> self::findToday()
            ])
            ->where('package' , $package);

        if ( $target->exists()):
            $target = $target
                ->orderBy('month')
                ->orderBy('year')
                ->first()
                ->id;
            return $target-$start;
        endif;

        return 0;
    }

    public static function pastDays($dmy)
    {
        $pakage = CalendarController::findPackage();
// dd($pakage,self::todayOffset($pakage)+1);
        $calendar = DB::table('tbl_calendar')
            ->where('package' , $pakage)
            ->where('status', '<>', 3)
            ->offset(0)
            ->limit(self::todayOffset($pakage)+1)
            ->get();

        $found = false;
        foreach ($calendar as $item):
//            if ( $item->dmy == $dmy )
                $found = true;
        endforeach;

        return $found;
    }

    public function calendarData()
    {
        $days = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::findToday(),
                'customer_id'=> $id
            ]);
    }

    public static function savedTimes($id, $cid)
    {
        $times = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->where([
                'calendar_id' => $cid,
                'customer_id'=> $id
            ]);
        return $times;
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
