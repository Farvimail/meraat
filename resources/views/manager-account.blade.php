@extends('layouts.auth')

@section('title')
    تغییر رمز عبور
@endsection

{{--
    صفحهٔ تغییر رمزِ خودِ مدیر.

    سه فیلد است و نه دو: بدونِ «رمزِ فعلی» هر کسی که یک نشستِ باز روی
    دستگاهِ مشترک پیدا کند می‌تواند رمز را عوض کند و صاحبِ حساب بیرون بماند.
--}}

@section('content')
    <h1 class="auth-title">تغییر رمز عبور</h1>
    <p class="auth-hint">
        رمزِ فعلی را وارد کنید و رمزِ تازه را دو بار بنویسید. بعد از ذخیره، برای
        ورودِ بعدی همان رمزِ تازه را بزنید.
    </p>

    {{-- پیامِ موفقیت را `partials.toasts` پایینِ همین پوسته نشان می‌دهد؛
         تکرارش اینجا دو پیامِ هم‌زمان می‌ساخت. --}}
    @if ($errors->any())
        <div class="auth-note auth-note-error" role="alert">
            @foreach ($errors->all() as $message)
                <span>{{ $message }}</span>
            @endforeach
        </div>
    @endif

    <form method="POST" action="{{ url('manager/password') }}" class="auth-form" autocomplete="off">
        @csrf

        <label class="auth-field" for="current_password">
            <span>رمز فعلی</span>
            <input id="current_password" type="password"
                   class="form-control{{ $errors->has('current_password') ? ' is-invalid' : '' }}"
                   name="current_password" required autofocus autocomplete="current-password">
        </label>

        <label class="auth-field" for="password">
            <span>رمز جدید</span>
            <input id="password" type="password"
                   class="form-control{{ $errors->has('password') ? ' is-invalid' : '' }}"
                   name="password" required autocomplete="new-password">
            <small class="auth-field-hint">حداقل ۶ کاراکتر.</small>
        </label>

        <label class="auth-field" for="password_confirmation">
            <span>تکرار رمز جدید</span>
            <input id="password_confirmation" type="password" class="form-control"
                   name="password_confirmation" required autocomplete="new-password">
        </label>

        <button type="submit" class="btn btn-primary auth-submit">ذخیرهٔ رمز تازه</button>
    </form>

    <div class="auth-links">
        <a href="{{ url('manager') }}">بازگشت به پنل مدیریت</a>

        <form method="POST" action="{{ route('logout') }}" class="auth-logout">
            @csrf
            <button type="submit">خروج از حساب</button>
        </form>
    </div>

    <p class="auth-foot-note">
        حساب: <strong>{{ $manager->email }}</strong>
    </p>
@endsection
