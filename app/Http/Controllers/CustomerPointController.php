<?php

namespace App\Http\Controllers;

use App\CustomerPoint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerPointController extends Controller
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
    public function save(Request $request)
    {
        DB::table('tbl_customer_points')
            ->where([
                'customer_id' => $request['customer_id'],
                'package'=>$request['package']
            ])
            ->delete();

        foreach($request['point_id'] as $point):
            DB::table('tbl_customer_points')
                ->insert(
                    [
                        'package'=>$request['package'],
                        'point_id' => $point,
                        'national_code' => $request['national_code'],
                        'customer_id' => $request['customer_id'],
                        'customer_email' => self::tableData($request['customer_id'], 'users')->email
                    ]
                );
        endforeach;
        $request->session()->flash('status', 'امتیاز کارمند با موفقیت بروزرسانی شد');
        return redirect()->route('desc');
    }

    public static function selectedCustomerPoints($id, $point_id)
    {
        $selected = DB::table('tbl_points')
            ->join('tbl_append_points', 'tbl_points.id', '=', 'tbl_append_points.point_id')
            ->join('tbl_customer_points', 'tbl_points.id', '=', 'tbl_customer_points.point_id')
            ->where([
                'manager_id' => AppendPointsController::getManagerAuth(),
                'customer_id' => $id,
                'tbl_points.id' => $point_id
            ])
            ->first();

        return $selected;
    }
    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        //
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
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        //
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
