@extends('layouts.auth')

@section('title')
    ورود به میزکار
@endsection

@section('content')
    @php
        $authTitle = 'ورود به میزکار';
        if (isset($url) && $url === 'admin') {
            $authTitle = 'ورود مدیر ارشد';
        } elseif (isset($url) && $url === 'manager') {
            $authTitle = 'ورود میزکار';
        }
    @endphp

    <h1 class="auth-title">{{ $authTitle }}</h1>
    <p class="auth-hint">پست الکترونیک و رمزعبور خود را وارد کنید تا به میزکار برگردید.</p>

    <form method="POST"
          id="login-form"
          action="{{ isset($url) ? url("login/$url") : route('login') }}"
          aria-label="{{ $authTitle }}"
          class="auth-form">
        @csrf

        <label class="auth-field" for="email">
            <span>پست الکترونیک</span>
            <input id="email" type="email"
                   class="form-control{{ $errors->has('email') ? ' is-invalid' : '' }}"
                   name="email" value="{{ old('email') }}" required autofocus>

            @if ($errors->has('email'))
                <span class="invalid-feedback" role="alert">
                    <strong>{{ $errors->first('email') }}</strong>
                </span>
            @endif
        </label>

        <label class="auth-field" for="password">
            <span>رمزعبور</span>
            <input id="password" type="password"
                   class="form-control{{ $errors->has('password') ? ' is-invalid' : '' }}"
                   name="password" required>

            @if ($errors->has('password'))
                <span class="invalid-feedback" role="alert">
                    <strong>{{ $errors->first('password') }}</strong>
                </span>
            @endif
        </label>

        <label class="auth-remember" for="remember">
            <input class="form-check-input" type="checkbox" name="remember" id="remember"
                   {{ old('remember') ? 'checked' : '' }}>
            <span>مرا به خاطر بسپار</span>
        </label>

        {{-- ---------------- اتصال به سرور ----------------
             به‌صورت پیش‌فرض پنهان است و فقط js/auth-connection.js آن را نشان
             می‌دهد: تا وقتی کاربر اینترنت ندارد، به‌جای صفحهٔ خطای مرورگر همان
             ورودی‌ها سرِ جایشان می‌مانند و کارت خودش هر چند ثانیه دوباره
             تلاش می‌کند. اگر جاوااسکریپت اجرا نشود، فرم مثل قبل پست می‌شود. --}}
        <div class="auth-connection" id="login-connection" role="alert" aria-live="polite" hidden>
            <span class="auth-connection-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round">
                    <path d="M3 4l18 16"/>
                    <path d="M2.5 8.6A14 14 0 0 1 8.4 5.3"/>
                    <path d="M15.9 5.4a14 14 0 0 1 5.6 3"/>
                    <path d="M6.6 12a9 9 0 0 1 3.1-1.8"/>
                    <path d="M17.3 11.7a9 9 0 0 0-2.7-1.4"/>
                    <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/>
                </svg>
            </span>

            <div class="auth-connection-text">
                <strong>اتصال به سرور برقرار نیست</strong>
                <small id="login-connection-note">اینترنتِ این دستگاه یا شبکهٔ محل کار را بررسی کنید.</small>
            </div>

            <button type="button" class="btn btn-primary auth-connection-retry" id="login-connection-retry">
                تلاش دوباره
            </button>
        </div>

        <button type="submit" class="btn btn-primary auth-submit" id="login-submit">
            ورود
        </button>
    </form>
@endsection
