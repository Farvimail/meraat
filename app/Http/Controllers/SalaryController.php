<?php

namespace App\Http\Controllers;

use App\SavedTime;
use DateTime;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use NumberFormatter;
use phpDocumentor\Reflection\Types\Object_;

class SalaryController extends Controller
{
    public static function thisMonth($package)
    {
        $calendar = DB::table('tbl_calendar')
            ->where('package' , $package)
            ->where('status', '<>', 3)
            ->offset(0)
            ->limit(TimerController::todayOffset($package)+1)
            ->get();

        return $calendar;
    }

    public static function thisDay($id, $month)
    {
        $calendar = DB::table('tbl_calendar')
            ->where('dmy',$id)
            ->where('package',$month)
            ->orderBy('id','desc')
            ->get();

        return $calendar;
    }

    public function editDay(Request $request)
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where([
                'tbl_append_customer.manager_id' => $request['mid'],
                'users.id' => $request['cid'],
                'package' => $request['month']
            ])
            ->get();

        $fishMonth = self::fishMonth($request['month']);
        $findToday = SavedTimeController::findToday();
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.singledit',[
            'mid' => $request['mid'],
            'cid' => $request['cid'],
            'month' => $request['month'],
            'dayid' => $request['dayid'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
            'find_today' => $findToday,
            'fish_month' => $fishMonth->fa_month,
            'fa_da' => FunctionsController::e2p($fa_da),
            'info' => $info
        ]);
    }

    public function printDay(Request $request)
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->where([
                'tbl_append_customer.manager_id' => $request['mid'],
                'users.id' => $request['cid'],
            ])
            ->get();

        $fishMonth = self::fishMonth($request['month']);
        $findToday = SavedTimeController::findToday();
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.print_day',[
            'mid' => $request['mid'],
            'cid' => $request['cid'],
            'month' => $request['month'],
            'dayid' => $request['dayid'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
            'find_today' => $findToday,
            'fish_month' => $fishMonth->fa_month,
            'fa_da' => FunctionsController::e2p($fa_da),
            'info' => $info
        ]);
    }

    public function getActivity(Request $request)
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where([
                'tbl_append_customer.manager_id' => $request['mid'],
                'users.id' => $request['cid'],
                'package' => $request['month'],
            ])
            ->get();

        $fishMonth = self::fishMonth($request['month']);
        $findToday = SavedTimeController::findToday();
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
                .explode("/",$findToday->fa_date)[1].'/'
                .explode("/",$findToday->fa_date)[0];

        return view('salary.edit',[
            'mid' => $request['mid'],
            'cid' => $request['cid'],
            'month' => $request['month'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
            'find_today' => $findToday,
            'fish_month' => $fishMonth->fa_month,
            'fa_da' => FunctionsController::e2p($fa_da),
            'info' => $info
        ]);
    }

    public function getPrint(Request $request)
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->where([
                'tbl_append_customer.manager_id' => $request['mid'],
                'users.id' => $request['cid'],
                'package' => $request['month'],
            ])
            ->get();

        $fishMonth = self::fishMonth($request['month']);
        $findToday = SavedTimeController::findToday();
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
                .explode("/",$findToday->fa_date)[1].'/'
                .explode("/",$findToday->fa_date)[0];

        return view('salary.print_month',[
            'mid' => $request['mid'],
            'cid' => $request['cid'],
            'month' => $request['month'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
            'find_today' => $findToday,
            'fish_month' => $fishMonth->fa_month,
            'fa_da' => FunctionsController::e2p($fa_da),
            'info' => $info
        ]);
    }

    public static function getInfo($mid, $cid, $dmy, $month)
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->where([
                'tbl_append_customer.manager_id' => $mid,
                'users.id' => $cid,
                'tbl_calendar.dmy' => $dmy,
                'package' => $month
            ])
            ->select('*','dmy',DB::raw("concat(month,'/',day,'/',year,' ',SUBSTRING(time, 1, 5)) as 'date'"), 'start', 'pause');

        return $info->get();
    }

    public function info()
    {
        $info = DB::table('tbl_append_customer')
            ->join('users', 'tbl_append_customer.customer_id', '=', 'users.id')
            ->join('tbl_timer', 'tbl_append_customer.customer_id', '=', 'tbl_timer.customer_id')
            ->join('tbl_calendar', 'tbl_timer.calendar_id', '=', 'tbl_calendar.id')
            ->join('tbl_saved_time', 'tbl_timer.saved_time_id', '=', 'tbl_saved_time.id')
            ->where([
                'tbl_append_customer.manager_id' => 3,
                'users.id' => 26,
            ])
            ->orderBy('year', 'asc')
            ->orderBy('month', 'asc')
            ->orderBy('day', 'asc')
            ->groupBy('tbl_calendar.dmy')
            ->select(DB::raw('count(*) as merge_able'), 'manager_id', "users.national_code", "users.id", "users.name", "calendar_id", "saved_time_id", "dmy", "status", "package", "fa_date");

        return $info->get();
    }

    public function edit(Request $request)
    {
        $savedTime;
        if ( $request['status'] == 1 ):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
               $savedTime->update([
                   'time' => $request['time'],
                   'start' => 1,
                   'pause' => 0
               ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 0
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 2):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
                $savedTime->update([
                    'time' => $request['time'],
                    'start' => 0,
                    'pause' => 1
                ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 0,
                    'pause' => 1
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 3 ):
            DB::table('tbl_saved_time')
                ->where('id', '=', $request['saved_time_id'])
                ->delete();

            DB::table('tbl_timer')
                ->where('calendar_id', '=', $request['calendar_id'])
                ->where('customer_id', '=', $request['customer_id'])
                ->delete();
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 4):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
                $savedTime->update([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 1
                ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 1
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        else:
           $message='ورودی ها نامعتیر، ذخیره نشد!!';
        endif;


        $request->session()->flash('status', $message);
        return redirect()->route('salary.edit.page',[
            'mid'=>$request['mid'],
            'cid'=>$request['cid'],
            'month'=>$request['month'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
        ]);
    }

    public function singledit(Request $request)
    {
        $savedTime;
        if ( $request['status'] == 1 ):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
               $savedTime->update([
                   'time' => $request['time'],
                   'start' => 1,
                   'pause' => 0
               ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 0
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 2):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
                $savedTime->update([
                    'time' => $request['time'],
                    'start' => 0,
                    'pause' => 1
                ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 0,
                    'pause' => 1
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 3 ):
            DB::table('tbl_saved_time')
                ->where('id', '=', $request['saved_time_id'])
                ->delete();

            DB::table('tbl_timer')
                ->where('calendar_id', '=', $request['calendar_id'])
                ->where('customer_id', '=', $request['customer_id'])
                ->delete();
            $message='بروزرسانی با موفقیت انجام شد.';
        elseif( $request['status'] == 4):
            $savedTime = DB::table('tbl_saved_time')
                ->where('id', $request['saved_time_id']);

            if ( $savedTime->exists() )
            {
                $savedTime->update([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 1
                ]);
            }else{
                $savedTime = SavedTime::create([
                    'time' => $request['time'],
                    'start' => 1,
                    'pause' => 1
                ]);
                TimerController::create(
                    SavedTimeController::tableData($request['customer_id'],'users'),
                    $request['calendar_id'],
                    $savedTime->id
                );
            }
            $message='بروزرسانی با موفقیت انجام شد.';
        else:
           $message='ورودی ها نامعتیر، ذخیره نشد!!';
        endif;

        return redirect()->route('salary.single.page',[
            'mid'=>$request['mid'],
            'cid'=>$request['cid'],
            'dayid' => $request['dayid'],
            'month' => $request['month'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
        ]);
    }

    public static function customerInfo($id)
    {
        return DB::table('users')
            ->where('id', $id)
            ->first();
    }

    public static function customerRole($id)
    {
        return DB::table('tbl_customer_roles')
            ->join('tbl_roles','tbl_customer_roles.role_id','=','tbl_roles.id')
            ->where('customer_id', $id)
            ->first();
    }

    public static function monthTime($pid, $cid, $status)
    {
        $time = DB::table('tbl_saved_time')
            ->join('tbl_timer','tbl_saved_time.id','=','tbl_timer.saved_time_id')
            ->join('tbl_calendar','tbl_timer.calendar_id','=','tbl_calendar.id')
            ->where([
                'tbl_calendar.package'=> $pid,
                'customer_id'=> $cid,
                'tbl_calendar.status' => $status
            ])
            ->orderBy('year', 'asc')
            ->orderBy('month', 'asc')
            ->orderBy('day', 'asc')
            ->select('dmy',DB::raw("concat(month,'/',day,'/',year,' ',SUBSTRING(time, 1, 5)) as 'date'"), 'start', 'pause')
            ->get();

        return $time;
    }

    public static function sumParts($array)
    {
        //dd($array);
        if ( $array->count() > 0 )
        {
            // dd($array);
            $sum = 0;
            $min = 0;
            $point = +1;
            $res = [];
            foreach ($array as $index=>$b):
                $b->start ? $point=-1:$point=+1;
                $time = substr(explode(" ",$b->date)[1],0, 5);
                // $time = $b->time;
                $sum += ((int) explode(":",$time)[0])*60;
                $sum += ((int) explode(":",$time)[1]);
                $sum = $sum*$point;
                /*echo $index." ".$sum." ".$time." \n";*/
                $res[$index] = $sum;
                $sum = 0;
            endforeach;

            $s = 0;
            foreach ($res as $t):
                $s += $t;
            endforeach;

            return intval($s/60).":".$s%60;

        }
        return "00:00";
    }

    public static function sumParts2($array)
    {
        //var_dump($array);
        $sum = 0;
        $min = 0;
        $point = +1;
        $res = [];
        foreach ($array as $index=>$b):
            $point=+1;
            $time = $b;
            $sum += ((int) explode(":",$time)[0])*60;
            $sum += ((int) explode(":",$time)[1]);
            $sum = $sum*$point;
            /*echo $index." ".$sum." ".$time." \n";*/
            $res[$index] = $sum;
            $sum = 0;
        endforeach;

        $s = 0;
        foreach ($res as $t):
            $s += $t;
        endforeach;

        return intval($s/60).":".$s%60;
    }

    public static function sumYearParts($array)
    {
        // dd($array);
        if ( sizeof($array) > 0 )
        {
            $sum = 0;
            $res = [];
            foreach ($array as $index=>$time):
                if ( $time != 0 && $time != "")
                {
                    $sum += ((int) explode(":",$time)[0])*60;
                    $sum += ((int) explode(":",$time)[1]);
                    $res[$index] = $sum;
                    $sum = 0;                
                }
            endforeach;

            $s = 0;
            foreach ($res as $t):
                $s += $t;
            endforeach;

            return intval($s/60).":".$s%60;
        }
        return "00:00";
    }

    public static function sumWatch($array)
    {
        $sum = 0;
        foreach ($array as $index=>$b):
            $time = substr($b,0, 5);
            $sum += (int) str_replace(":","",$time);
        endforeach;

        $min = substr($sum,-2);
        $sum = abs($sum);
        $sum = (int) ($sum / 100);
        return intval(abs($min)/60)+ abs($sum).":".abs($min)%60;
    }

    public static function toSeconds($date)
    {
        $d = DateTime::createFromFormat(
            'm/d/Y H:i',
            $date,
            new DateTimeZone("Asia/Tehran")
        );

        if ($d === false) {
            die("Incorrect date string");
        } else {
            return $d->getTimestamp();
        }
    }

    public function getTimestamps()
    {
        return self::sumParts(self::monthTime(1, 18, 1));
    }

    public static function usersPoints($month_id, $id)
    {
        $selected = DB::table('tbl_points')
            ->join('tbl_append_points', 'tbl_points.id', '=', 'tbl_append_points.point_id')
            ->join('tbl_customer_points', 'tbl_points.id', '=', 'tbl_customer_points.point_id')
            ->where([
                'manager_id' => AppendPointsController::getManagerAuth(),
                'customer_id' => $id,
                'tbl_append_points.package' => $month_id
            ])
            ->select('name as point_name','value as point_value')
            ->get();

        return $selected;
    }

    public static function sumPoints($month_id, $id)
    {
        $points = self::usersPoints($month_id, $id);
        //dd($points, $month_id,$id );
        $sum = 0;
        foreach ( $points as $point):
            $sum += $point->point_value;
        endforeach;

        $array = [
            "point_name" => "مجموع هزینه امتیاز",
            "point_value" => $sum
        ];

        return $array;
    }

    public static function pointsInfo($month_id)
    {
        $selected = DB::table('tbl_points')
            ->join('tbl_append_points', 'tbl_points.id', '=', 'tbl_append_points.point_id')
            ->where([
                'manager_id' => 3,
                'tbl_append_points.package' => $month_id
            ])
            ->select('name as point_name','value as point_value')
            ->get();

        return $selected;
    }

    public static function rolesInfo($month_id, $id)
    {
        $roles = DB::table('tbl_roles')
            ->join('tbl_append_roles','tbl_roles.id','=','tbl_append_roles.role_id')
            ->where([
                'manager_id'=>3,
                'package'=>$month_id
            ])->get();

        return $roles;
    }

    public static function usersActivity($month_id, $id)
    {
        // dd(AppendRolesController::selectedManagerRole($month_id, $id));
        $normal_time = self::sumParts(self::monthTime($month_id, $id,1));
        $normal_score = !empty(AppendRolesController::selectedManagerRole($month_id, $id))?AppendRolesController::selectedManagerRole($month_id, $id)->normal_score:0;
        $extra_time = self::sumParts(self::monthTime($month_id, $id,2));
        $high_score = !empty(AppendRolesController::selectedManagerRole($month_id, $id))?AppendRolesController::selectedManagerRole($month_id, $id)->high_score:0;
        $array = [
            [
                "activity_name" => "جمع ساعت کاری",
                "activity_value" => $normal_time
            ],
            [
                "activity_name" => "نرخ ساعت کاری",
                "activity_value" => $normal_score
            ],
            [
                "activity_name" => "ساعت اضافه کاری",
                "activity_value" => $extra_time
            ],
            [
                "activity_name" => "نرخ اضافه کاری",
                "activity_value" => $high_score
            ]
        ];

        return $array;
    }

    public static function sumActivities($month_id, $id)
    {
        $normal_time = self::sumParts(self::monthTime($month_id,  $id,1));
        $normal_score = !empty(AppendRolesController::selectedManagerRole($month_id, $id))?AppendRolesController::selectedManagerRole($month_id, $id)->normal_score:0;
        $extra_time = self::sumParts(self::monthTime($month_id,  $id,2));
        $high_score = !empty(AppendRolesController::selectedManagerRole($month_id, $id))?AppendRolesController::selectedManagerRole($month_id, $id)->high_score:0;

        if ( isset($extra_time) && isset($normal_time)):
            $total = ((explode(":",$normal_time)[0]*60)+explode(":",$normal_time)[1])*($normal_score/60)+((explode(":",$extra_time)[0]*60)+explode(":",$extra_time)[1])*($high_score/60);
        elseif (isset($extra_time)):
            $total = (explode(":",$normal_time)[0]*60)+(explode(":",$normal_time)[1]*($normal_score/60));
        elseif(isset($normal_time)):
            $total = ((explode(":",$extra_time)[0]*60)+(explode(":",$extra_time)[1]*($high_score/60)));
        else:
            $total = 0;
        endif;

        //dd($normal_score, $total,$normal_time,$extra_time,isset($extra_time) && isset($normal_time),((explode(":",$normal_time)[0]*60)+explode(":",$normal_time)[1])*($normal_score/60)+((explode(":",$extra_time)[0]*60)+explode(":",$extra_time)[1])*($high_score/60));
        $salary = ((int)($total));

        if ( strlen((string)$salary) > 3 ):
            $salary = (int)($salary/1000)*1000;
        endif;

        $array = [
            "activity_name" => "مجموع هزینه عملکرد",
            "activity_value" => $salary,
            "normal_time" => $normal_time,
            "extra_time" => $extra_time
        ];

        return $array;
    }

    public static function sumActivitiesPrint($cid, $array, $status, $month_id)
    {
       $time = self::sumParts($array);
       $user_role = AppendRolesController::selectedManagerRole($month_id, $cid);
       $score = ($user_role!=null)?($status==1)?$user_role->normal_score:$user_role->high_score:0;

       if(isset($score)):
            $total = ((explode(":",$time)[0]*60)+(explode(":",$time)[1]))*($score/60);
        else:
            $total = 0;
        endif;

        $array = [
            "activity_name" => "مجموع هزینه عملکرد",
            "activity_value" => (int)$total
        ];

        $salary = ((int)($total));

        if ( strlen((string)$salary) > 3 ):
            $salary = (int)($salary/1000)*1000;
        endif;

        return $salary!=0?$salary." ریال ":$salary;
    }

    public static function sumActivitiesTime($cid, $array, $status, $month_id)
    {
       $time = self::sumParts($array);

        return $time;
    }

    public static function activityTable($month_id, $id)
    {
        $array = [];
        $cid = $id;
        $index = 0;

        $points = self::usersPoints($month_id, $cid);
        $activity = self::usersActivity($month_id, $cid);

        // dd($activity);
        $max = (count($points) > count($activity))?$points:$activity;
        foreach ( $max as $index=>$item):
            $points = isset(self::usersPoints($month_id, $cid)[$index])?(array)self::usersPoints($month_id, $cid)[$index]:[];
            $activity = (array_key_exists($index, self::usersActivity($month_id, $cid)))?self::usersActivity($month_id, $cid)[$index]:[];
            $array[$index] = array_merge( (array) $activity, $points);
        endforeach;

        return $array;
    }

    public static function getSum($month_id, $cid)
    {
        //dd(self::sumActivities($month_id, $cid));
        //dd(self::sumPoints($month_id, $cid), self::sumActivities($month_id, $cid));
        return array_merge( (array) self::sumPoints($month_id, $cid),  (array) self::sumActivities($month_id, $cid));
    }

    public function salaryActivity(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.activity',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'full_name' => self::customerInfo($request['cid'])->name,
            'role_name' => self::customerRole($request['cid'])->name,
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public function historyPoints(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('points.history',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public function historyRoles(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('roles.history',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public function salaryTable(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.fishtable',[
            'cid' => $request['cid'],
            'month_id' => $request['month_id'],
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public function salaryPerson(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.personal',[
            'id' => $request['id'],
            'month_id' => $request['month_id'],
            'full_name' => self::customerInfo($request['id'])->name,
            'fish_month' => $fishMonth->fa_month,
            'find_today' => $findToday,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public static function findMonth($package)
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->orderBy('id', 'desc')
            ->first();
    }

    public function total(Request $request)
    {
        $fishMonth = self::fishMonth($request['month_id']);
        $findToday = self::findMonth($request['month_id']);
        $fa_da = explode("/",$findToday->fa_date)[2].'/'
            .explode("/",$findToday->fa_date)[1].'/'
            .explode("/",$findToday->fa_date)[0];

        return view('salary.total',[
            'id' => $request['id'],
            'month_id' => $request['month_id'],
            'find_today' => $findToday,
            'fish_month' => $fishMonth->fa_month,
            'fa_da' => FunctionsController::e2p($fa_da),
        ]);
    }

    public static function ltrDate($date){
        $part = explode("/",$date);
        return $part[2]."/".$part[1]."/".$part[0];
    }

    public static function monthHistory()
    {
        return DB::table('tbl_calendar')
            ->where('package', '<=', FunctionsController::soonPackage())
            ->groupBy('package')
            ->get();
    }

    public static function rewardHistory()
    {
        return DB::table('tbl_calendar')
            ->where('package', '<=', FunctionsController::soonPackage())
            ->where('fa_month' , '=', 'اسفند')
            ->groupBy('package')
            ->get();
    }

    public static function monthNames($id)
    {
        return DB::table('tbl_calendar')
            ->where('package', $id)
            ->groupBy('m_month')
            ->select('m_month')
            ->get();
    }

    public static function fishMonth($package)
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('package', $package)
            ->orderBy('id', 'desc')
            ->first();
    }

}
