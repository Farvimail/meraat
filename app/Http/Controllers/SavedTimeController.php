<?php

namespace App\Http\Controllers;

use App\Calendar;
use App\SavedTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use DateTimeZone;
use DateTime;

class SavedTimeController extends Controller
{
    public static function todayDate()
    {
        date_default_timezone_set("Asia/Tehran");
        return (string) date('dmY');
    }

    public static function noDuplicate($id, $mode)
    {
        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.dmy'=> self::todayDate(),
                'customer_id'=> $id
            ])
            ->orderBy('tbl_saved_time.id','desc')
            ->first();

        if ( empty($time) )
            return false;

        switch ($mode):
            case 'start':
                $output = $time->start;
                break;
            case 'pause':
                $output = $time->pause;
                break;
        endswitch;

        return $output;
    }

    public static function tableData($id, $table_name)
    {
        $data = DB::table($table_name)
            ->where('id', $id)
            ->first();

        return $data;
    }

    public static function findToday()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->where('status', '<>', '3')
            ->orderBy('id', 'desc')
            ->first();
    }



    public static function timeNow()
    {
        date_default_timezone_set('Asia/Tehran'); // normal, but may apply DST

        // Use a fixed offset timezone:
        $fixedTz = new DateTimeZone("+03:30");
        $dt = new DateTime('now', $fixedTz);
        return  $dt->format('H:i:s');
    }

    /**
     * Save start work of customer.
     *
     * @return \Illuminate\Http\Response
     */
    public function start(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

       /* if ( auth()->guard('manager')->check() ||
            auth()->check() ){*/

            /*** don't save "start" just after "start" ***/
            if ( self::noDuplicate($request['id'], 'start') == 1)
                return false;

            $savedTime = SavedTime::create([
                'time' => self::timeNow(),
                'start' => 1,
                'pause' => 0,
            ]);

            TimerController::create(
                self::tableData($request['id'],'users'),
                self::findToday()->id,
                $savedTime->id
            );

            $findToday = TimerController::findToday();
            $timerDate = TimerController::timerDate($request['id'], $findToday);
            return json_encode($timerDate);
       /* }*/
    }

    /**
     * Save pause work of customer.
     *
     * @return \Illuminate\Http\Response
     */
    public function pause(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

        /*if ( auth()->guard('manager')->check() ||
            auth()->check() ){*/

            if ( self::noDuplicate($request['id'], 'pause') == 1)
                return false;

            $toDay = TimerController::noPause($request['id']);
            if ($toDay->doesntExist())
                return false;

            $savedTime = SavedTime::create([
                'time' => self::timeNow(),
                'start' => 0,
                'pause' => 1,
            ]);

            TimerController::create(
                self::tableData($request['id'],'users'),
                self::findToday()->id,
                $savedTime->id
            );

            $findToday = TimerController::findToday();
            $timerDate = TimerController::timerDate($request['id'], $findToday);
            return json_encode($timerDate);
       /* }*/
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
