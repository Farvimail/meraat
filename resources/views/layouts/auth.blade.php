<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield("title")</title>

    <!-- Fonts -->
    <link rel="dns-prefetch" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css?family=Raleway:300,400,600" rel="stylesheet" type="text/css">
    <link rel="preload" href="{{ asset('fonts/IRANSansWeb.0b5055a.woff2') }}" as="font" type="font/woff2" crossorigin="">

    <!-- Favicon -->
    <link rel="apple-touch-icon" sizes="180x180" href="{{asset('/images/favicon/apple-touch-icon.png')}}">
    <link rel="icon" type="image/png" sizes="32x32" href="{{asset('/images/favicon/favicon-32x32.png')}}">
    <link rel="icon" type="image/png" sizes="16x16" href="{{asset('/images/favicon/favicon-16x16.png')}}">
    <link rel="manifest" href="{{asset('/images/favicon/site.webmanifest')}}">

    <link href="https://code.jquery.com/jquery-3.5.1.min.js" rel="preload" as="script" >
    <link href="{{ asset('js/popper.js') }}" rel="preload" as="script" defer>
    <link href="{{ asset('js/app.js') }}" rel="preload" as="script" defer>
    <link href="{{ asset('js/ajax.js') }}" rel="preload" as="script" defer>
    <link href="{{ asset('js/timer.js') }}" >

    <!-- Scripts -->
    <script src="https://code.jquery.com/jquery-3.5.1.min.js" rel="preload" as="script" ></script>
    <script src="{{ asset('js/popper.js') }}" rel="preload" as="script" defer></script>
    <script src="{{ asset('js/app.js') }}" rel="preload" as="script" defer></script>
    <script src="{{ asset('js/ajax.js') }}" rel="preload" as="script" defer></script>
    <script src="{{ asset('js/timer.js') }}" ></script>

    <!-- Styles -->
    <link href="{{ asset('css/app.css') }}" rel="stylesheet">
    <link href="{{ asset('css/custom.css') }}" rel="stylesheet">
    <link href="{{ asset('css/auth.css') }}" rel="stylesheet">
</head>
<body>

<div id="app">
    <nav class="navbar navbar-expand-md navbar-light navbar-laravel">
        <div class="container">
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="{{ __('Toggle navigation') }}">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <!-- Left Side Of Navbar -->
                <ul class="navbar-nav mr-auto">

                </ul>

                <!-- Right Side Of Navbar -->
                <ul class="navbar-nav ml-auto">
                    <!-- Authentication Links -->
                    <li class="nav-item dropdown">
                        <a id="navbarDropdown" class="nav-link dropdown-toggle" href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" v-pre>
                            میزکار <span class="caret"></span>
                        </a>

                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdown">
                            <a class="dropdown-item" href="#points">
                                امتیازها
                            </a>
                            <a class="dropdown-item" href="#roles">
                                نقش ها
                            </a>
                            <a class="dropdown-item" href="#customers">
                                کارمندها
                            </a>
                            <a class="dropdown-item" href="#history">
                                آرشیو ها
                            </a>
                            <a class="dropdown-item" href="#calendars">
                                تقویم ها
                            </a>
                            <a class="dropdown-item" href="{{ route('logout') }}"
                               onclick="event.preventDefault();
                                                     document.getElementById('logout-form').submit();">
                                خروج
                            </a>

                            <form id="logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
                                @csrf
                            </form>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <main class="py-4">
        @yield('rewards')
        @yield('points')
        @yield('roles')
        @yield('customers')
        @yield('history')
        @yield('calendars')
        @yield('activity_month')
        @yield('toasts')
        @yield('fishtable')
    </main>
</div>

@section('footer')
    <footer class="bg-light text-center" style="background: rgb(255 255 255 / 85%) !important; border-top: solid 1px lightgray; position: relative;">
        <!-- Grid container -->
        <div class="container p-4 pb-0">
            <!-- Section: Social media -->
            <section class="mb-4">
                <!-- Facebook -->
                <a role="button" href="https://www.facebook.com/mostafa.ghafari.1422/" class="btn btn-outline-dark btn-floating m-1"  data-bs-toggle="tooltip" data-bs-placement="left" title="اکانت توسعه دهنده">
                   فیسبوک
                </a>

                <!-- Instagram -->
                <a role="button" href="https://www.instagram.com/mgh.farvi/" class="btn btn-outline-dark"  data-bs-toggle="tooltip" data-bs-placement="top" title="اکانت توسعه دهنده">
                  اینستاگرام
                </a>

                <!-- Telegram -->
                <a role="button" href="https://t.me/mgh1320" class="btn btn-outline-dark btn-floating m-1"  data-bs-toggle="tooltip" data-bs-placement="top" title="پشتیبانی در تلگرام">
                 تلگرام
                </a>

                <!-- Whats app -->
                <a role="button" href="https://wa.me/989910733141" class="btn btn-outline-dark" data-bs-toggle="tooltip" data-bs-placement="right" title="اکانت توسعه دهنده">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-whatsapp" iewBox="0 0 16 16">
                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                    </svg>
                </a>
            </section>
            <!-- Section: Social media -->
        </div>
        <!-- Grid container -->

        <!-- Copyright -->
        <div class="text-center p-3" style="background-color: rgba(0, 0, 0, 0.02);">
            © 2021 Copyright:
            Developed by MOSTAFA GHAFARI (MGH)
        </div>
        <!-- Copyright -->
    </footer>
@show
<!-- Scripts -->
<!--script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script-->
</body>
</html>
