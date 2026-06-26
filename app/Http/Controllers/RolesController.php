<?php

namespace App\Http\Controllers;

use App\Roles;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RolesController extends Controller
{

    public static function managerData($id)
    {
        $data = DB::table('managers')
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
        $role = Roles::create([
            'name' => $request['name'],
            'normal_score' => $request['normal_score'],
            'high_score' => $request['high_score'],
            'min_time' => $request['min_time'],
            'max_time' => $request['max_time'],
            'desc' => $request['desc'],
        ]);

        if ( auth()->guard('manager')->check() )
        {
            $manager_auth = auth()->guard('manager');
            $manager_id = $manager_auth->id();
            AppendRolesController::create(self::managerData($manager_id), $role->id, $request['package']);
        }

        $request->session()->flash('status', 'نقش جدید با موفقیت به اپلیکیشن اضافه شد');
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
        DB::table('tbl_roles')
            ->where('id', $request['role_id'])
            ->update([
                'name' => $request['name'],
                'min_time' => $request['min_time'],
                'max_time' => $request['max_time'],
                'normal_score' => $request['normal_score'],
                'high_score' => $request['high_score'],
                'desc' => $request['desc'],
            ]);

        $request->session()->flash('status', 'نقش با موفقیت بروزرسانی شد');
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
        DB::table('tbl_roles')
            ->where('id','=',$request['id'])
            ->delete();

        DB::table('tbl_append_roles')
            ->where('role_id', '=', $request['id'])
            ->delete();

        DB::table('tbl_customer_roles')
            ->where('role_id', '=', $request['id'])
            ->delete();

        $request->session()->flash('status', 'سمت با موفقیت حذف شد.');
        return redirect()->route('desc');
    }
}
