{{--
    پوستهٔ داشبورد پنل‌های مدیریتی (/manager و /admin).

    چیدمان: نوار ناوبری ثابت سمت راست، محتوای صفحه سمت چپ. آیتم‌های منو را هر
    پنل خودش با آرایهٔ $panelNav تعریف می‌کند تا فقط بخش‌هایی که واقعاً رندر
    می‌شوند در منو بیایند. شکل هر آیتم:

        array('label' => 'امتیازها', 'href' => '#points', 'icon' => 'star')

    آیکون‌ها درون‌خطی هستند تا پنل به فونت آیکون یا CDN وابسته نشود.
--}}
@php
    $panelUser = auth('manager')->user() ?: auth('admin')->user();
    $panelName = $panelUser && $panelUser->name ? $panelUser->name : 'کاربر';
    $panelMail = $panelUser ? (string) $panelUser->email : '';
    $panelRole = auth('manager')->check() ? 'میزکار' : 'مدیر ارشد';

    // منو را خودِ پنل تعریف می‌کند؛ اگر تعریف نشده باشد عمداً خالی می‌ماند تا
    // هیچ‌وقت منویی به بخشی اشاره نکند که در آن صفحه رندر نشده است.
    if (!isset($panelNav) || !is_array($panelNav)) {
        $panelNav = array();
    }

    $panelIcons = array(
        'grid'     => '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect>',
        'gift'     => '<polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>',
        'star'     => '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
        'shield'   => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
        'users'    => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        'calendar' => '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
        'archive'  => '<polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line>',
        'database' => '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
        'logout'   => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
        'menu'     => '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>',
        'close'    => '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
        'clock'    => '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline>',
    );

    // تاریخ بالای صفحه (و کنترل «تاریخ فعال سامانه») از partials.date-jump می‌آید
    // تا همان چیپ در صفحهٔ حضور و غیاب هم قابل استفاده باشد.
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('title')</title>

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

    {{-- تأییدِ حضور: همین پنل دکمهٔ «تأیید دستیِ حضور» را دارد (بخشِ کارمندها)
         و مارک‌آپِ QR هم در صفحهٔ حضور و غیاب است. هر دو از یک فایل می‌آیند،
         پس هر دو پوسته باید همان فایل‌ها را بیاورند — وگرنه یک صفحه دکمه‌ای
         می‌گیرد که کسی به کلیکش گوش نمی‌دهد. محلی و بدون CDN، مثل همهٔ
         اسکریپت‌های این پروژه. --}}
    <script src="{{ asset('js/vendor/toqr.js') }}?v={{ filemtime(public_path('js/vendor/toqr.js')) }}"></script>
    <script src="{{ asset('js/panel-qr.js') }}?v={{ filemtime(public_path('js/panel-qr.js')) }}"></script>
</head>
<body class="panel-page">

<div class="panel-shell">

    {{-- ------------------------------------------------ نوار ناوبری --}}
    <aside class="panel-nav" id="panelNav" aria-label="ناوبری پنل">
        <div class="panel-brand">
            <img class="panel-brand-logo" src="{{ asset('images/logo/arm.jpg') }}" alt="مِرآت">
            <span class="panel-brand-text">
                <strong>مِرآت</strong>
                <small>{{ $panelRole }}</small>
            </span>
            <button type="button" class="panel-nav-close" data-panel-toggle aria-label="بستن منو">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{!! $panelIcons['close'] !!}</svg>
            </button>
        </div>

        <div class="panel-nav-scroll">
            @if (count($panelNav))
            <p class="panel-nav-label">منوی میزکار</p>
            <nav class="panel-nav-links">
                @foreach ($panelNav as $item)
                    <a class="panel-nav-link" href="{{ $item['href'] }}">
                        <span class="panel-nav-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                                 stroke-linecap="round" stroke-linejoin="round">
                                {!! isset($panelIcons[$item['icon']]) ? $panelIcons[$item['icon']] : $panelIcons['grid'] !!}
                            </svg>
                        </span>
                        <span class="panel-nav-text">{{ $item['label'] }}</span>
                    </a>
                @endforeach
            </nav>
            @endif

            <p class="panel-nav-label">حساب کاربری</p>
            <nav class="panel-nav-links">
                <a class="panel-nav-link" href="{{ route('logout') }}"
                   onclick="event.preventDefault(); document.getElementById('panel-logout-form').submit();">
                    <span class="panel-nav-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                             stroke-linecap="round" stroke-linejoin="round">{!! $panelIcons['logout'] !!}</svg>
                    </span>
                    <span class="panel-nav-text">خروج از حساب</span>
                </a>
            </nav>
        </div>

        <div class="panel-nav-user">
            <span class="panel-avatar" aria-hidden="true">{{ mb_substr($panelName, 0, 1) }}</span>
            <span class="panel-user-text">
                <strong>{{ $panelName }}</strong>
                <small>{{ $panelMail }}</small>
            </span>
        </div>

        <form id="panel-logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
            @csrf
        </form>
    </aside>

    <div class="panel-backdrop" data-panel-toggle></div>

    {{-- ------------------------------------------------ ستون محتوا --}}
    <div class="panel-wrap">
        <header class="panel-topbar">
            <button type="button" class="panel-burger" data-panel-toggle aria-label="نمایش منو">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{!! $panelIcons['menu'] !!}</svg>
            </button>

            <h1 class="panel-heading">
                @hasSection('page_title')@yield('page_title')@else @yield('title')@endif
                <small>@yield('page_subtitle', 'میزکار مدیریت')</small>
            </h1>

            <div class="panel-topbar-end">
                @include('partials.timer-hub-chip')

                @include('partials.date-jump')

                <a class="panel-iconbtn" href="{{ route('logout') }}" title="خروج"
                   onclick="event.preventDefault(); document.getElementById('panel-logout-form').submit();">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{!! $panelIcons['logout'] !!}</svg>
                </a>
            </div>
        </header>

        @include('partials.date-notice')

        <main class="panel-content">
            @yield('content')
            @yield('rewards')
            @yield('points')
            @yield('roles')
            @yield('customers')
            @yield('history')
            @yield('backup')
            @yield('calendars')
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
    </div>
</div>

<script>
    (function () {
        'use strict';

        var body = document.body;

        // کشوی منو در موبایل
        var toggles = document.querySelectorAll('[data-panel-toggle]');
        for (var i = 0; i < toggles.length; i++) {
            toggles[i].addEventListener('click', function (event) {
                event.preventDefault();
                body.classList.toggle('panel-nav-open');
            });
        }

        // با انتخاب یک بخش، کشو بسته شود
        var links = document.querySelectorAll('.panel-nav-link');
        for (var j = 0; j < links.length; j++) {
            links[j].addEventListener('click', function () {
                body.classList.remove('panel-nav-open');
            });
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                body.classList.remove('panel-nav-open');
            }
        });

        // بخش فعال بر اساس موقعیت اسکرول
        var anchors = [];
        for (var k = 0; k < links.length; k++) {
            var href = links[k].getAttribute('href') || '';
            if (href.charAt(0) !== '#' || href.length < 2) {
                continue;
            }
            var target = document.getElementById(href.slice(1));
            if (target) {
                anchors.push({ link: links[k], target: target, id: href.slice(1) });
            }
        }

        if (!anchors.length) {
            return;
        }

        function highlight(id) {
            for (var n = 0; n < anchors.length; n++) {
                var active = anchors[n].id === id;
                anchors[n].link.classList.toggle('is-active', active);
                if (active) {
                    anchors[n].link.setAttribute('aria-current', 'true');
                } else {
                    anchors[n].link.removeAttribute('aria-current');
                }
            }
        }

        function update() {
            var current = anchors[0].id;
            for (var n = 0; n < anchors.length; n++) {
                if (anchors[n].target.getBoundingClientRect().top <= 140) {
                    current = anchors[n].id;
                }
            }
            if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
                current = anchors[anchors.length - 1].id;
            }
            highlight(current);
        }

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    })();
</script>

</body>
</html>
