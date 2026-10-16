{{--
    پوستهٔ صفحهٔ حضور و غیاب (صفحهٔ اصلی سایت).

    همان بدنهٔ داشبورد پنل (body.panel-page + panel.css) اما بدون نوار کناری:
    هدر چسبان بالا، سربرگ‌های سریع به بخش‌های همین صفحه، کنترل تاریخ فعال
    سامانه و خروج/ورود مدیر. بخش‌ها با همان @yieldهای پنل، پس نمایه‌های موجود
    بدون تغییر باقی می‌مانند.
--}}
@php
    $attUser = auth('manager')->user() ?: auth('admin')->user();
    $attRole = auth('manager')->check() ? 'میزکار' : (auth('admin')->check() ? 'مدیر ارشد' : null);
    $attInitial = $attUser ? mb_substr($attUser->name ?: $attUser->email, 0, 1) : '';
@endphp
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

        <nav class="att-nav" aria-label="بخش‌های صفحه">
            <a class="att-nav-link is-active" href="#customers">همکاران</a>
            <a class="att-nav-link" href="#calendars">فعالیت ماهانه</a>
        </nav>

        <div class="att-topbar-end">
            @include('partials.timer-hub-chip')

            @include('partials.date-jump')

            @if ($attUser)
                <a class="panel-iconbtn" href="{{ route('logout') }}" title="خروج از حساب"
                   onclick="event.preventDefault(); document.getElementById('att-logout-form').submit();">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </a>

                @if ($attRole)
                    {{-- کلاسِ اختصاصی و نه `btn btn-primary`: آبیِ `btn-primary`
                         عمداً در این سامانه نگه داشته شده چون رنگِ وضعیتِ روزهای
                         تقویم است؛ این دکمه به تقویم ربطی ندارد، پس با رنگِ خودِ
                         پنل می‌آید. توضیح در panel.css. --}}
                    <a class="att-topbtn"
                       href="{{ auth('manager')->check() ? url('manager') : url('admin') }}">پنل مدیریت</a>
                @endif
            @else
                <a class="btn btn-sm btn-outline-primary" href="{{ url('login/manager') }}">ورود مدیر</a>
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

@if ($attUser)
    <form id="att-logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
        @csrf
    </form>
@endif

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
