<?php

namespace App\Http\Controllers;

use App\AppendPoints;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppendPointsController extends Controller
{
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($request, $point_id, $package)
    {
        AppendPoints::create([
            'manager_id' => $request->id,
            'manager_email' => $request->email,
            'point_id' => $point_id,
            'package' => $package
        ]);
    }

    public static function getManagerAuth()
    {
        $manager_auth = auth()->guard('manager');
        return $manager_auth->id();
    }

    public static function showManagerPoints()
    {
        $manager_auth = auth()->guard('manager');
        $manager_id = $manager_auth->id();
        $points = DB::table('tbl_points')
            ->join('tbl_append_points','tbl_points.id','=','tbl_append_points.point_id')
            ->where([
                'manager_id' => $manager_id,
                'package' => FunctionsController::package()
            ])
            ->orderBy('tbl_points.id', 'desc')
            ->get();
        return $points;
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\AppendPoints  $appendPoints
     * @return \Illuminate\Http\Response
     */
    public static function show(AppendPoints $appendPoints)
    {
        $roles = DB::table('tbl_points')->get();
        return $roles;
    }


    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\AppendPoints  $appendPoints
     * @return \Illuminate\Http\Response
     */
    public function destroy(AppendPoints $appendPoints)
    {
        //
    }
}
