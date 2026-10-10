{{--
    نوار هشدارِ «تاریخ فعال سامانه»: تا وقتی مدیری تاریخی غیر از امروز را فعال
    کرده باشد، این نوار بالای محتوا دیده می‌شود تا یادش نرود برگرداند.
--}}
@php
    $noticeActive = \App\Http\Controllers\FunctionsController::hasSystemDate();
    $noticeCanFix = auth('manager')->check() || auth('admin')->check();
    $noticeRealToday = \App\Http\Controllers\FunctionsController::e2p(
        substr(\App\Http\Controllers\FunctionsController::jdate(time()), 0, 10)
    );
@endphp

@if ($noticeActive)
    <div class="panel-datebar" role="status">
        <svg class="panel-datebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>

        <span class="panel-datebar-text">
            تاریخ فعال سامانه:
            <strong>{{ \App\Http\Controllers\FunctionsController::systemDateJalali() }}</strong>
            — امروز واقعی:
            {{ $noticeRealToday }}
            <small>ویرایش‌ها و ثبت تردد روی همین تاریخ انجام می‌شود.</small>
        </span>

        @if ($noticeCanFix)
            <form action="{{ route('panel.date.reset') }}" method="POST" class="panel-datebar-form">
                @csrf
                <button type="submit" class="btn btn-sm btn-light">بازگشت به امروز</button>
            </form>
        @endif
    </div>
@endif
