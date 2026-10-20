{{--
    پوستهٔ صفحهٔ حضور و غیاب (صفحهٔ اصلی سایت).

    همان بدنهٔ داشبورد پنل (body.panel-page + panel.css) اما بدون نوار کناری:
    هدر چسبان بالا، سربرگ‌های سریع به بخش‌های همین صفحه و کنترل تاریخ فعال
    سامانه. بخش‌ها با همان @yieldهای پنل، پس نمایه‌های موجود بدون تغییر باقی
    می‌مانند.

    دکمهٔ «پنل مدیریت» و «خروج» عمداً از این هدر برداشته شدند: این صفحه محلِ
    کارِ روزمرهٔ کارکنان است، نه میزکارِ مدیر. مدیر از `/manager/login` وارد
    می‌شود و پسوردش را هم از همان‌جا عوض می‌کند. جای آن‌ها دکمهٔ «اپلیکیشن»
    نشسته که صفحهٔ دانلود و QR آن را باز می‌کند.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('title', 'نرم افزار حضوروغیاب')</title>

    <!-- Fonts -->

    <link rel="preload"
          href="{{ asset('fonts/IRANSansWeb.0b5055a.woff2') }}"
          as="font"
          type="font/woff2"
          crossorigin>

    <!-- Favicon -->
    <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('images/favicon/apple-touch-icon.png') }}">
    <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('images/favicon/favicon-32x32.png') }}">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ asset('images/favicon/favicon-16x16.png') }}">
    <link rel="manifest" href="{{ asset('images/favicon/site.webmanifest') }}">

    <!-- Styles -->
    <link href="{{ asset('css/app.css') }}?v={{ filemtime(public_path('css/app.css')) }}" rel="stylesheet">
    <link href="{{ asset('css/custom.css') }}?v={{ filemtime(public_path('css/custom.css')) }}" rel="stylesheet">
    <link href="{{ asset('css/auth.css') }}?v={{ filemtime(public_path('css/auth.css')) }}" rel="stylesheet">
    <link href="{{ asset('css/panel.css') }}?v={{ filemtime(public_path('css/panel.css')) }}" rel="stylesheet">

    <!-- Scripts (clean + versioned) -->
    <script src="{{ asset('js/jquery.min.js') }}?v={{ filemtime(public_path('js/jquery.min.js')) }}"></script>

    <script src="{{ asset('js/popper.js') }}?v={{ filemtime(public_path('js/popper.js')) }}"></script>
    <script src="{{ asset('js/app.js') }}?v={{ filemtime(public_path('js/app.js')) }}"></script>
    <script src="{{ asset('js/ajax.js') }}?v={{ filemtime(public_path('js/ajax.js')) }}"></script>
    <script src="{{ asset('js/timer.js') }}?v={{ filemtime(public_path('js/timer.js')) }}"></script>

    {{-- QR تأییدِ حضور: کدگذارِ محلی (نسخهٔ کلاسیکِ toqr) + کدِ پنل.
         محلی است و نه CDN، تا بدونِ دسترسی به بیرون هم کد ساخته شود. --}}
    <script src="{{ asset('js/vendor/toqr.js') }}?v={{ filemtime(public_path('js/vendor/toqr.js')) }}"></script>
    <script src="{{ asset('js/panel-qr.js') }}?v={{ filemtime(public_path('js/panel-qr.js')) }}"></script>
</head>
<body class="panel-page attendance-page">

<header class="panel-topbar">
    <div class="att-topbar-inner">
        <div class="att-brand">
            <img class="panel-brand-logo" src="{{ asset('images/logo/arm.jpg') }}" alt="مِرآت">
            <span class="att-brand-text">
                <strong>حضور و غیاب مِرآت</strong>
                <small>ثبت تردد و فعالیت ماهانهٔ کارکنان</small>
            </span>
        </div>

        @php
            /*
             * صفحه‌هایی مثل `/app` بخش‌های #customers و #calendars را ندارند؛
             * در آن‌ها یک لینکِ لنگری (`#customers`) به هیچ عنصری نمی‌رسد و
             * کلیکش هیچ کاری نمی‌کند. آن صفحه‌ها با `nav_base` نشانیِ صفحهٔ
             * اصلی را می‌دهند تا سربرگ به همان بخش‌ها برگردد.
             */
            $navBase = trim($__env->yieldContent('nav_base'));
        @endphp
        <nav class="att-nav" aria-label="بخش‌های صفحه">
            <a class="att-nav-link{{ $navBase === '' ? ' is-active' : '' }}"
               href="{{ $navBase }}#customers">همکاران</a>
            <a class="att-nav-link" href="{{ $navBase }}#calendars">فعالیت ماهانه</a>
        </nav>

        <div class="att-topbar-end">
            {{-- دکمهٔ اپ: صفحهٔ جداگانه‌ای را باز می‌کند که QRِ لینکِ دانلود
                 مستقیم از همین سرور را دارد، همراهِ راهنمای نصب و استفاده. --}}
            <a class="att-topbtn att-topbtn-app" href="{{ url('app') }}" title="دانلود اپلیکیشن و راهنمای نصب">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                     width="16" height="16">
                    <rect x="6" y="2" width="12" height="20" rx="3"></rect>
                    <line x1="10" y1="18" x2="14" y2="18"></line>
                </svg>
                <span>اپلیکیشن</span>
            </a>

            @include('partials.timer-hub-chip')

            @include('partials.date-jump')

            @if (! auth('manager')->check() && ! auth('admin')->check())
                <a class="att-login-link" href="{{ url('manager/login') }}">ورود مدیر</a>
            @endif
        </div>
    </div>
</header>

@include('partials.date-notice')

<main class="panel-content att-content">
    @yield('content')
    @yield('customers')
    @yield('calendars')
    @yield('points')
    @yield('roles')
    @yield('rewards')
    @yield('history')
    @yield('backup')
    @yield('activity_month')
    @yield('toasts')
    @yield('fishtable')
</main>

<footer class="panel-footer">
    <span>© ۲۰۲۱ — توسعه‌یافته توسط MOSTAFA GHAFARI (MGH)</span>
    <span>
        <a href="https://t.me/mgh1320" target="_blank" rel="noopener">پشتیبانی تلگرام</a>
    </span>
</footer>

<script>
    (function () {
        'use strict';

        // سربرگ‌های سریع: هر بخشی که بالای دیدگاه است فعال می‌شود
        var links = document.querySelectorAll('.att-nav-link');
        if (!links.length) {
            return;
        }

        var anchors = [];
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            if (href.charAt(0) === '#' && href.length > 1) {
                var target = document.getElementById(href.slice(1));
                if (target) {
                    anchors.push({ link: links[i], target: target, id: href.slice(1) });
                }
            }
        }

        function update() {
            var current = anchors.length ? anchors[0].id : null;
            for (var n = 0; n < anchors.length; n++) {
                if (anchors[n].target.getBoundingClientRect().top <= 130) {
                    current = anchors[n].id;
                }
            }
            for (var m = 0; m < anchors.length; m++) {
                anchors[m].link.classList.toggle('is-active', anchors[m].id === current);
            }
        }

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    })();
</script>

</body>
</html>
