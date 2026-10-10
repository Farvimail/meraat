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

        <button type="submit" class="btn btn-primary auth-submit">
            ورود
        </button>
    </form>
@endsection
