{{--
    مهر «ماه فعال» برای صفحه‌های چاپی (صورت‌وضعیت حقوق، فیش‌ها، گزارش‌ها).

    روی صفحه‌های چاپی نوار هشدار پنل دیده نمی‌شود، پس اگر مدیر یک ماه گذشته را
    فعال کرده باشد، ممکن است برگهٔ چاپ‌شده با ماه جاری اشتباه گرفته شود. این
    مهر فقط در همان حالت نمایش داده می‌شود و وقتی سامانه روی امروز واقعی است
    هیچ چیزی چاپ نمی‌کند.
--}}
@if (\App\Http\Controllers\FunctionsController::isOffRealToday())
    <div style="direction: rtl; text-align: right; margin: .4rem .6rem; padding: .45rem .7rem;
                border: 1px dashed #b45309; border-radius: 8px; background: #fff8e4; color: #8a5a00;
                font-size: .82rem;">
        تاریخ فعال سامانه:
        <strong>{{ \App\Http\Controllers\FunctionsController::systemDateJalali() }}</strong>
        — امروز واقعی:
        {{ \App\Http\Controllers\FunctionsController::e2p(substr(\App\Http\Controllers\FunctionsController::jdate(time()), 0, 10)) }}
        <span style="display: block; font-size: .75rem;">
            این برگه به ماه فعال سامانه تعلق دارد، نه به امروز واقعی.
        </span>
    </div>
@endif
