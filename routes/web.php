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

// «انگشتِ تغییر» همهٔ تایمرهای بازِ صفحه در یک درخواست — تا ثبتِ گوشی
// بدون رفرشِ دستی و بدون یک درخواست سنگین برای هر کارت در پنل دیده شود.
Route::get('/read/timer-revision','TimerController@revision');

// کدهای QR تأییدِ حضور برای پنل (نشستِ مدیر) و ثبتِ تأییدِ دستیِ مدیر.
// GET است تا درخواستِ دوره‌ایِ پنل با همان چیزی که هست ساده بماند و کدهای
// کوتاه‌عمر در کش نیفتند؛ احراز هویت داخلِ خودِ کنترلر است.
Route::get('/read/qr-codes','PresenceQrController@codes');
Route::post('/read/qr-confirm-manual','PresenceQrController@manual');

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

/*
|--------------------------------------------------------------------------
| کارمندان: آرشیو و گزارش
|--------------------------------------------------------------------------
| آرشیو = انتقال کارمند به لیست غیرفعال‌ها (users.archived_at) بدون حذفِ
| داده‌ها؛ بازگردانی دوباره فعالش می‌کند. گزارش، صفحهٔ کامل سوابق یک
| کارمند است (ورود، اولین/آخرین فعالیت، حضور و غیبت، ساعت‌ها و دریافتی‌ها).
| برخلاف سایر مسیرهای این بخش، هر سه پشت گارد مدیر هستند.
*/
Route::get('/customers/archive/id/{id}', 'CustomerController@archive')
    ->name('customer.archive')->middleware('auth:manager');
Route::get('/customers/restore/id/{id}', 'CustomerController@restore')
    ->name('customer.restore')->middleware('auth:manager');
Route::get('/customers/report/id/{id}', 'CustomerController@report')
    ->name('customer.report')->middleware('auth:manager');


Route::get('/days', 'CalendarController@show');

Route::post('/upload/ajax', 'FunctionsController@uploadAjax')->name('upload.ajax');

Route::get('/delete/ajax', 'PhotoController@destroy')->name('delete.ajax');

/*
|--------------------------------------------------------------------------
| Database backup (management panel)
|--------------------------------------------------------------------------
| Manual backup from the management panel. The automatic daily run is
| declared in app/Console/Kernel.php. Unlike most routes in this file these
| two are behind a guard: a dump of the whole database must not be reachable
| anonymously.
|
| `real.month` هم می‌گوید وقتی مدیر یک ماه گذشته را فعال کرده، بکاپ‌گیری
| دستی متوقف شود؛ دامپ کل پایگاه داده به ماه کاریِ فعال مربوط نیست و نباید
| اشتباهی زیر عنوان «امروزِ سامانه» گرفته شود. اجرای خودکار روزانه (کنسول و
| بدون نشست) از این محافظ اثری نمی‌گیرد.
*/
Route::post('/backup/create', 'BackupController@create')
    ->name('backup.create')
    ->middleware(['auth:manager,admin', 'real.month']);

Route::get('/backup/download/{file}', 'BackupController@download')
    ->name('backup.download')
    ->middleware(['auth:manager,admin', 'real.month']);

/*
|--------------------------------------------------------------------------
| تاریخ فعال سامانه (پنل مدیریت)
|--------------------------------------------------------------------------
| روی سرور نمی‌توان ساعت سیستم را برای کار روی ماه‌های قبل عوض کرد، پس مدیر
| از نوار بالای پنل یک ماه یا روز را فعال می‌کند و در نشست خودش ذخیره می‌شود.
| چون فقط روی «امروزِ سامانه» اثر دارد، مثل بکاپ پشت گارد است.
*/
Route::post('/panel/date', 'PanelDateController@set')
    ->name('panel.date.set')
    ->middleware('auth:manager,admin');

Route::post('/panel/date/reset', 'PanelDateController@reset')
    ->name('panel.date.reset')
    ->middleware('auth:manager,admin');
