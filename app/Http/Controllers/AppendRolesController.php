<?php

namespace App\Http\Controllers;

use App\AppendRoles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppendRolesController extends Controller
{
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($data, $role_id, $package)
    {
        AppendRoles::create([
            'manager_id' => $data->id,
            'manager_email' => $data->email,
            'role_id' => $role_id,
            'package' => $package
        ]);
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\AppendRoles  $appendRoles
     * @return \Illuminate\Http\Response
     */

    public static function getManagerAuth()
    {
        $manager_auth = auth()->guard('manager');
        return $manager_auth->id();
    }

    public static function showManagerRoles()
    {
        $roles = DB::table('tbl_roles')
            ->join('tbl_append_roles','tbl_roles.id','=','tbl_append_roles.role_id')
            ->where([
                'manager_id' => 3,
                'package' => FunctionsController::package()
            ])
            ->orderBy('tbl_roles.id', 'desc')
            ->get();
        return $roles;
    }

    public static function selectedManagerRole($month_id, $id)
    {
        $roles = DB::table('tbl_roles')
            ->join('tbl_append_roles','tbl_roles.id','=','tbl_append_roles.role_id')
            ->join('tbl_customer_roles','tbl_roles.id','=','tbl_customer_roles.role_id')
            ->where([
                'manager_id'=>3,
                'customer_id'=>$id,
                'package'=>$month_id
            ])->first();


        return $roles;
    }
    /**
     * Show the form for editing the specified resource.
     *
     * @param  \App\AppendRoles  $appendRoles
     * @return \Illuminate\Http\Response
     */
    public function edit(AppendRoles $appendRoles)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\AppendRoles  $appendRoles
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, AppendRoles $appendRoles)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\AppendRoles  $appendRoles
     * @return \Illuminate\Http\Response
     */
    public function destroy(AppendRoles $appendRoles)
    {
        //
    }
}
