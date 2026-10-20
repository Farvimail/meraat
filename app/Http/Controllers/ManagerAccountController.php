<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * تغییر رمز عبورِ خودِ مدیر (میزکار).
 *
 * چرا جدا از `CustomerController::credentials`: آن یکی رمزِ **کارمندها** را
 * عوض می‌کند و از پنل صدا زده می‌شود؛ این یکی رمزِ خودِ کسی است که نشست
 * دارد و باید رمزِ فعلی را هم بداند. قاطی‌کردنشان یعنی یا مدیر می‌توانست
 * رمزِ خودش را بی‌دانستنِ رمزِ فعلی عوض کند، یا برای عوض‌کردن رمزِ کارمند
 * رمزِ خودش را می‌خواست.
 *
 * چرا صفحه بدونِ `auth:manager` است و خودش نشست را می‌سنجد: با میدل‌ورِ
 * گارد، لاراولِ این پروژه بی‌نشست‌ها را به روتِ `login` (فرمِ ورودِ مشتری)
 * می‌فرستد، نه به `/manager/login` که مدیر از آنجا آمده است.
 */
class ManagerAccountController extends Controller
{
    /** فرمِ تغییر رمز. */
    public function edit()
    {
        $manager = auth('manager')->user();

        if (empty($manager)) {
            return redirect('manager/login');
        }

        return view('manager-account', ['manager' => $manager]);
    }

    /** ذخیرهٔ رمزِ تازه. */
    public function update(Request $request)
    {
        $manager = auth('manager')->user();

        if (empty($manager)) {
            return redirect('manager/login');
        }

        // پیام‌ها فارسی و صریح‌اند: خطای اعتبارسنجی روی همان فرم نوشته
        // می‌شود و کاربر باید بداند کدام شرط رد شده، نه فقط «خطا».
        $this->validate($request, [
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'current_password.required' => 'رمز فعلی را وارد کنید.',
            'password.required' => 'رمز جدید را وارد کنید.',
            'password.min' => 'رمز جدید باید حداقل ۶ کاراکتر باشد.',
            'password.confirmed' => 'تکرارِ رمز جدید با آن یکی نیست.',
        ]);

        if (! Hash::check((string) $request['current_password'], $manager->password)) {
            return back()
                ->withErrors(['current_password' => 'رمز فعلی درست نیست.'])
                ->withInput($request->only('current_password'));
        }

        $manager->password = Hash::make((string) $request['password']);
        $manager->save();

        return redirect('manager/password')->with('status', 'رمز عبور با موفقیت تغییر کرد.');
    }
}
