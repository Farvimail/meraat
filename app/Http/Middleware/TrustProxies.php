<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Fideloper\Proxy\TrustProxies as Middleware;

class TrustProxies extends Middleware
{
    /**
     * پروکسی‌هایی که به آن‌ها اعتماد داریم.
     *
     * روی سرور، درخواست‌ها این مسیر را می‌آیند:
     *   مرورگر/گوشی → nginx میزبان (127.0.0.1) → nginx کانتینر → php-fpm
     * و در توسعهٔ لوکال، درست از همان کانتینر nginx.
     *
     * چرا عمداً فقط همین‌ها و نه `'*'`: مقدار `X-Forwarded-For` را می‌توان
     * جعل کرد. اگر همه به‌عنوان پروکسی معتبر شمرده شوند، آی‌پی سمت کلاینت از
     * هدرِ جعلی خوانده می‌شود و قید «ثبت فقط از شبکهٔ محل کار» با یک هدرِ
     * دست‌ساز دور زده می‌شود. با این فهرست، آی‌پی سمت راست زنجیره که مالِ
     * خودمان است نادیده گرفته می‌شود و آی‌پی واقعیِ کلاینت می‌ماند.
     *
     * شبکهٔ پیش‌فرض داکر در بازهٔ 172.16.0.0/12 است (172.16 تا 172.31).
     *
     * @var array
     */
    protected $proxies = [
        '127.0.0.1',
        '::1',
        '172.16.0.0/12',
    ];

    /**
     * The headers that should be used to detect proxies.
     *
     * @var int
     */
    protected $headers = Request::HEADER_X_FORWARDED_ALL;
}
