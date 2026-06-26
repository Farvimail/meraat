<?php

namespace App\Http\Controllers;

use App\AppendPoints;
use App\Points;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PointsController extends Controller
{
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */

    static function managerData($id)
    {
        $data = DB::table('managers')
                ->where('id', $id)
                ->first();

        return $data;
    }

    public function create(Request $request)
    {
        $point = Points::create([
            'name' => $request['name'],
            'value' => $request['value']
        ]);

        if ( auth()->guard('manager')->check() )
        {
            $manager_id = auth()->guard('manager')->id();
            AppendPointsController::create(self::managerData($manager_id ), $point->id, $request['package']);
        }
        $request->session()->flash('status', 'امتیاز جدید با موفقیت به اپلیکیشن اضافه شد');
        return redirect()->route('desc');
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request)
    {
        DB::table('tbl_points')
            ->where('id', $request['point_id'])
            ->update([
                'name' => $request['name'],
                'value' => $request['value'],
            ]);

        $request->session()->flash('status', 'امتیاز با موفقیت بروزرسانی شد');
        return redirect()->route('desc');
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy(Request $request)
    {
        DB::table('tbl_points')
            ->where('id','=',$request['id'])
            ->delete();

        DB::table('tbl_append_points')
            ->where('point_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_customer_points')
            ->where('point_id', '=', $request['id'])
            ->delete();

        $request->session()->flash('status', 'امتیاز با موفقیت حذف شد');
        return redirect()->route('desc');
    }
}
