<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Stripe, Mailgun, SparkPost and others. This file provides a sane
    | default location for this type of information, allowing packages
    | to have a conventional place to find your various credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
    ],

    'ses' => [
        'key' => env('SES_KEY'),
        'secret' => env('SES_SECRET'),
        'region' => env('SES_REGION', 'us-east-1'),
    ],

    'sparkpost' => [
        'secret' => env('SPARKPOST_SECRET'),
    ],

    'stripe' => [
        'model' => App\User::class,
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
    ],

    /*
    |--------------------------------------------------------------------------
    | اپ موبایل حضور
    |--------------------------------------------------------------------------
    | کلید ایجنتِ داخل شبکهٔ محل کار. آن ایجنت هر یکی‌دو دقیقه آی‌پی خروجی
    | صندوق را با هدر `X-Agent-Key` به `POST /api/v1/office-ip` می‌فرستد و
    | سرور فقط همان آی‌پی‌ها را برای ثبت حضور قبول می‌کند.
    |
    | اگر این کلید خالی بماند، مسیر `office-ip` جواب ۵۰۳ می‌دهد و قید شبکه
    | خاموش می‌ماند (یعنی ثبت از هر شبکه‌ای پذیرفته می‌شود) تا سامانه بی‌دلیل
    | قفل نشود. جزئیات در `mobile/docs/API.md`.
    */

    'mobile' => [
        'office_agent_key' => env('MOBILE_OFFICE_AGENT_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | هابِ WebSocket پنل (تازه‌سازیِ زنده)
    |--------------------------------------------------------------------------
    | نشانی و کلیدِ مشترکِ هابِ `ws/`. پنل به این هاب وصل می‌شود و بعد از هر
    | ثبت، PHP همین‌جا را خبر می‌کند تا پنل همان لحظه فقط کارتِ همان کارمند را
    | بخواند (به‌جای درخواست‌های دوره‌ای).
    |
    | اگر `secret` خالی بماند، مسیرِ زنده خاموش است و سامانه مثل قبل با
    | درخواست‌های دوره‌ای کار می‌کند؛ پس استقرارِ کد بدون راه‌اندازیِ هاب چیزی
    | را نمی‌شکند. جزئیات در `ws/README.md`.
    */

    'timer_hub' => [
        // داخل استک داکر، سرویسِ هاب با همین نام در دسترس است.
        'url' => env('TIMER_HUB_URL', 'http://timer-hub:8090'),
        'secret' => env('TIMER_HUB_SECRET'),
    ],

];
