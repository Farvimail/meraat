<?php

/**
 * بررسیِ زندهٔ «تغییر رمزِ خودِ مدیر» روی کدِ مستقر.
 *
 * سه چیز سنجیده می‌شود که اشتباه شدنشان گران است:
 *   ۱) بی‌نشست، فرمِ تغییر رمز به `/manager/login` می‌فرستد (نه به فرمِ ورودِ
 *      مشتری که با گاردِ لاراول پیش می‌آمد)؛
 *   ۲) «رمز فعلیِ» غلط، رمز را عوض نمی‌کند و خطا برمی‌گردد؛
 *   ۳) رمزِ درست عوض می‌شود و هش می‌نشیند (خام ذخیره نمی‌شود).
 *
 * همه داخلِ تراکنش و با rollback؛ مدیرِ ساختگی هم پاک می‌شود. اجرا:
 *
 *   scp scripts/tests/live-manager-password.check.php root@سرور:/tmp/
 *   ssh root@سرور "docker cp /tmp/live-manager-password.check.php meraat-prod-app-1:/tmp/ \
 *       && docker exec meraat-prod-app-1 php /tmp/live-manager-password.check.php"
 */

require '/var/www/html/vendor/autoload.php';

$app = require '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\ManagerAccountController;
use App\Manager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\ViewErrorBag;
use Illuminate\Validation\ValidationException;

$failures = 0;

function check($label, $ok, $detail = '')
{
    global $failures;

    if (! $ok) {
        $failures++;
    }

    echo ($ok ? 'PASS  ' : 'FAIL  ') . $label . ($detail === '' ? '' : '  [' . $detail . ']') . "\n";
}

echo "== manager password ==\n";

$routes = collect(app('router')->getRoutes()->getRoutes())
    ->map(function ($route) {
        return $route->uri() . ' ' . implode(',', $route->methods());
    })
    ->filter(function ($line) {
        return strpos($line, 'manager/password') !== false;
    })
    ->values()
    ->all();

check('روتِ GET و POST تغییر رمز ثبت شده', count($routes) === 2, implode(' | ', $routes));

DB::beginTransaction();

try {
    $email = 'live-manager-' . time() . '@example.com';
    $oldPassword = 'OldPass-' . time();
    $newPassword = 'NewPass-' . time();

    $manager = new Manager();
    $manager->name = 'بررسیِ زنده';
    $manager->email = $email;
    $manager->password = Hash::make($oldPassword);
    $manager->save();

    // نشستِ مدیر: همان گاردی که `/manager/login` می‌نشاند.
    auth('manager')->login($manager);

    check('نشستِ مدیر برقرار شد', auth('manager')->check() === true);

    $controller = new ManagerAccountController();

    // ۱) فرم باز می‌شود.
    //
    // `$errors` را میدل‌ورِ `ShareErrorsFromSession` در هر درخواستِ وب داخلِ
    // ویو می‌گذارد؛ در کنسول چنین میدل‌وری اجرا نمی‌شود. یک کیفِ خالی می‌گذاریم
    // تا رندر همان چیزی باشد که کاربر می‌بیند، نه استثنای «متغیر تعریف نشده».
    view()->share('errors', new ViewErrorBag());

    try {
        $view = $controller->edit();
        $rendered = $view instanceof Illuminate\View\View
            ? $view->render()
            : '';

        check('فرمِ تغییر رمز برای مدیر باز می‌شود', $rendered !== ''
            && strpos($rendered, 'current_password') !== false);
    } catch (\Throwable $error) {
        check('فرمِ تغییر رمز بدونِ استثنا رندر شد', false, get_class($error) . ': ' . $error->getMessage());
    }

    // ۲) رمزِ فعلیِ غلط: نباید چیزی عوض شود.
    $wrong = Request::create('/manager/password', 'POST', [
        'current_password' => 'definitely-not-it',
        'password' => $newPassword,
        'password_confirmation' => $newPassword,
    ]);

    // در HTTP این مسیر `back()->withErrors(...)` می‌دهد؛ در کنسول همان
    // RedirectResponse ساخته می‌شود (یا اعتبارسنجی استثنا می‌دهد). هر دو یعنی
    // «رد شد»؛ چیزی که واقعاً باید بسنجیم اثرِ دیتابیسی است.
    $rejected = false;

    try {
        $rejected = $controller->update($wrong) instanceof RedirectResponse;
    } catch (ValidationException $error) {
        $rejected = true;
    } catch (\Throwable $error) {
        $rejected = true;
    }

    $unchanged = Hash::check($oldPassword, Manager::find($manager->id)->password);

    check('رمزِ فعلیِ غلط با پیام رد می‌شود', $rejected);
    check('با رمزِ فعلیِ غلط، رمز عوض نمی‌شود', $unchanged);

    // ۳) رمزِ درست: هشِ تازه می‌نشیند.
    $good = Request::create('/manager/password', 'POST', [
        'current_password' => $oldPassword,
        'password' => $newPassword,
        'password_confirmation' => $newPassword,
    ]);

    try {
        $controller->update($good);
    } catch (\Throwable $error) {
        // redirect در کنسول؛ مهم اثری است که روی دیتابیس مانده.
    }

    $fresh = Manager::find($manager->id);

    check('رمزِ تازه با پسوردِ جدید می‌خواند', Hash::check($newPassword, $fresh->password));
    check('رمزِ قبلی دیگر کار نمی‌کند', ! Hash::check($oldPassword, $fresh->password));
    check('رمز خام ذخیره نشد', strpos($fresh->password, $newPassword) === false);
} catch (\Throwable $error) {
    check('اجرای سناریو بدونِ استثنا', false, get_class($error) . ': ' . $error->getMessage());
}

DB::rollBack();

$leftovers = Manager::where('email', 'like', 'live-manager-%@example.com')->count();
check('rollback: مدیرِ ساختگی باقی نماند', $leftovers === 0, 'rows=' . $leftovers);

echo "\n" . ($failures === 0 ? "همهٔ بررسی‌ها گذشت.\n" : $failures . " بررسی رد شد.\n");

exit($failures === 0 ? 0 : 1);
