<?php
/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::view('/', 'customer');
Auth::routes();

Route::get('/login/admin', 'Auth\LoginController@showAdminLoginForm');
Route::get('/login/manager', 'Auth\LoginController@showManagerLoginForm')->name('login.manager');
Route::get('/register/admin', 'Auth\RegisterController@showAdminRegisterForm');
Route::get('/register/manager', 'Auth\RegisterController@showManagerRegisterForm')->name('register.manager');

Route::post('/login/admin', 'Auth\LoginController@adminLogin');
Route::post('/login/manager', 'Auth\LoginController@ManagerLogin');
Route::post('/register/admin', 'Auth\RegisterController@createAdmin');
Route::post('/register/manager', 'Auth\RegisterController@createManager');

Route::view('/home', 'home')->middleware('auth')->name('home');
Route::view('/admin', 'admin')->middleware('auth:admin');
Route::view('/manager', 'manager')->middleware('auth:manager')->name('desc');
Route::view('/customer', 'customer');

Route::get('/points/create','PointsController@create')->name('create.points');
Route::get('/roles/create','RolesController@create')->name('create.roles');
Route::get('/rewards/create','AppendRewardsController@create')->name('create.rewards');
Route::post('/rewards/update','AppendRewardsController@update')->name('update.rewards');
Route::post('/bank/create','BankController@create')->name('create.bank');
Route::post('/contact/create','ContactController@create')->name('create.contact');
Route::post('/points/update','PointsController@update')->name('update.points');
Route::post('/points/customer/save','CustomerPointController@save')->name('save.customer.point');
Route::post('/roles/update','RolesController@update')->name('update.roles');
Route::post('/customer/create','CustomerController@create')->name('create.customer');
Route::post('/customer/update','CustomerController@update')->name('update.customer');

Route::get('/time/now','CalendarController@show')->name('now');
Route::get('/present/start', 'SavedTimeController@start')->name('start.savetime');
Route::get('/present/pause', 'SavedTimeController@pause');

Route::get('/read/timer','TimerController@show');

Route::get('/past/day', 'TimerController@pastDays');

Route::get('/salary/table/month/{month_id}', 'SalaryController@salaryTable');
Route::get('/reward/table/month/{month_id}', 'AppendRewardsController@rewardTable');
Route::get('/salary/table/c/{id}/month/{month_id}', 'SalaryController@salaryPerson');
Route::get('/salary/table/total/month/{month_id}', 'SalaryController@total');
Route::get('/salary/activity/c/{cid}/month/{month_id}', 'SalaryController@salaryActivity');

Route::get('/history/roles/month/{month_id}', 'SalaryController@historyRoles');
Route::get('/history/points/month/{month_id}', 'SalaryController@historyPoints');

Route::get('/salary/report', function (){
    return view('salary.report');
});
/*
Route::get('/salary/edit', function (){
    return view('salary.edit');
});*/

Route::get('/edit/m/{mid}/c/{cid}/month/{month}', 'SalaryController@getActivity')->name('salary.edit.page');
Route::get('/salary/edit', 'SalaryController@edit')->name('salary.edit');

Route::get('month', 'SalaryController@monthTime');
Route::get('day/m/{mid}/c/{cid}/dmy/{dmy}', 'SalaryController@getInfo');

Route::get('navar', 'SalaryController@navarGhalb');

Route::get('getinfo', 'SalaryController@info');
Route::get('single/edit/m/{mid}/c/{cid}/d/{dayid}/month/{month}', 'SalaryController@editDay')->name('salary.single.page');
Route::get('/salary/single/edit', 'SalaryController@singledit')->name('salary.single.edit');

Route::get('/print/m/{mid}/c/{cid}/month/{month}', 'SalaryController@getPrint');
Route::get('single/print/m/{mid}/c/{cid}/d/{dayid}/month/{month}', 'SalaryController@printDay');

Route::get('/calendar/year/{y}/c/{cid}', 'CustomerController@showCalendarYear');

Route::get('/to/timestamps/', 'SalaryController@getTimestamps');

Route::get('/points/{id}', 'SalaryController@usersPoints');
Route::get('/activity', 'SalaryController@usersActivity');


Route::get('/activity/table/{id}', 'SalaryController@activityTable');

Route::get('/points/delete/id/{id}', 'PointsController@destroy');
Route::get('/rewards/delete/id/{id}', 'AppendRewardsController@destroy');
Route::get('/roles/delete/id/{id}', 'RolesController@destroy');
Route::get('/customers/delete/id/{id}', 'CustomerController@destroy');


Route::get('/days', 'CalendarController@show');

Route::post('/upload/ajax', 'FunctionsController@uploadAjax')->name('upload.ajax');

Route::get('/delete/ajax', 'PhotoController@destroy')->name('delete.ajax');
