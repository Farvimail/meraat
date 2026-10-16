{{--
    پوستهٔ صفحه‌های بیرون از داشبورد (ورود و /home).

    همان زبانِ بصریِ پنل: پس‌زمینهٔ روشن، کارتِ گِرد و برندِ «مِرآت»؛ فقط بدون
    نوار کناری. برای همین panel.css هم بارگذاری می‌شود.
--}}
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

    {{-- فقط صفحه‌های ورود فرم دارند؛ اگر #login-form نباشد این فایل کاری
         نمی‌کند. --}}
    <script src="{{ asset('js/auth-connection.js') }}?v={{ filemtime(public_path('js/auth-connection.js')) }}"></script>
</head>
<body class="panel-page auth-page">

<div class="auth-wrap">
    <main class="auth-card">
        <header class="auth-head">
            <img class="auth-logo" src="{{ asset('images/logo/arm.jpg') }}" alt="مِرآت">
            <span class="auth-brand">
                <strong>مِرآت</strong>
                <small>سامانهٔ حضور و غیاب و فعالیت کارکنان</small>
            </span>
        </header>

        <div class="auth-body">
            @yield('content')
            @yield('activity_month')
        </div>
    </main>

    <p class="auth-foot">© ۲۰۲۱ — توسعه‌یافته توسط MOSTAFA GHAFARI (MGH)</p>
</div>

@include('partials.toasts')

</body>
</html>
