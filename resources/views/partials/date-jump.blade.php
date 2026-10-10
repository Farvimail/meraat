{{--
    کنترل «تاریخ فعال سامانه».

    روی سرور نمی‌توان ساعت سیستم را برای کار روی ماه‌های قبل عوض کرد؛ این
    چیپ در نوار بالا با کلیک یک منو باز می‌کند که می‌شود یک ماه از تقویم
    سامانه یا یک روز دقیق را فعال کرد. مقدار انتخاب‌شده در نشست ذخیره می‌شود
    و همهٔ جای‌هایی که «امروز» می‌خواندند از همان استفاده می‌کنند.

    برای کاربر مهمان (بدون ورود) فقط نمایش تاریخ است.
--}}
@php
    $dateActive   = \App\Http\Controllers\FunctionsController::hasSystemDate();
    $dateSelected = \App\Http\Controllers\FunctionsController::systemDateJalali();
    $dateRealNow  = \App\Http\Controllers\FunctionsController::e2p(substr(\App\Http\Controllers\FunctionsController::jdate(time()), 0, 10));
    $dateRaw      = \App\Http\Controllers\FunctionsController::systemDate();
    $datePeriods  = \App\Http\Controllers\CalendarController::availablePeriods(30);
    $dateCanEdit  = auth('manager')->check() || auth('admin')->check();
    // ماهی که همین حالا فعال است، تا در فهرست انتخاب‌شده دیده شود.
    $dateActivePackage = $dateActive
        ? \App\Http\Controllers\CalendarController::packageOfDate($dateRaw)
        : null;
    // نمایش شمسیِ همان روز، برای دکمهٔ انتخاب‌گر جلالی
    $dateJalali = \App\Http\Controllers\FunctionsController::systemDateJalali();
@endphp

@if ($dateCanEdit)
    <div class="panel-datepick dropdown">
        <button type="button"
                class="panel-chip panel-chip-btn {{ $dateActive ? 'is-override' : '' }}"
                data-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
                title="{{ $dateActive ? 'تاریخ فعال سامانه (غیر از امروز واقعی)' : 'تاریخ امروز سامانه' }}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline>
            </svg>
            {{ $dateSelected }}
            <svg class="panel-chip-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>

        <div class="dropdown-menu panel-datepick-menu">
            <p class="panel-datepick-title">پرش به یک ماه</p>

            <form action="{{ route('panel.date.set') }}" method="POST">
                @csrf
                <select name="package" class="form-control form-control-sm" aria-label="انتخاب ماه">
                    @foreach ($datePeriods as $period)
                        <option value="{{ $period['package'] }}" @if ($period['package'] === $dateActivePackage) selected @endif>{{ $period['label'] }}</option>
                    @endforeach
                </select>
                <button type="submit" class="btn btn-primary btn-sm btn-block mt-2">فعال کردن این ماه</button>
            </form>

            <div class="panel-datepick-sep"><span>یا</span></div>

            <form action="{{ route('panel.date.set') }}" method="POST">
                @csrf
                {{--
                    انتخاب‌گر جلالی جای ورودی بومی میلادی را می‌گیرد: نمایش و
                    انتخاب به شمسی است اما مقدار فهمیده‌شده توسط سرور همچنان
                    Y-m-d میلادی می‌ماند (پنهان) تا PanelDateController بدون
                    تغییر کار کند. جاوااسکریپت: js/jdate-picker.js
                --}}
                <label class="panel-datepick-label" for="panelDateTrigger">یک روز دقیق</label>
                <input id="panelDateInput" type="hidden" name="date" value="{{ $dateRaw }}">
                <button type="button" id="panelDateTrigger"
                        class="form-control form-control-sm panel-datepick-value"
                        aria-haspopup="dialog" aria-expanded="false"
                        data-today="{{ \App\Http\Controllers\FunctionsController::realDate() }}">
                    {{ $dateJalali }}
                </button>
                <div class="jdp" id="panelJdp" role="dialog"
                     aria-label="تقویم جلالی برای انتخاب روز" hidden></div>
                <button type="submit" class="btn btn-outline-primary btn-sm btn-block mt-2">فعال کردن این روز</button>
            </form>

            @if ($dateActive)
                <form action="{{ route('panel.date.reset') }}" method="POST" class="mt-3">
                    @csrf
                    <button type="submit" class="btn btn-outline-secondary btn-sm btn-block">
                        بازگشت به امروز واقعی ({{ $dateRealNow }})
                    </button>
                </form>
            @endif
        </div>

        <script src="{{ asset('js/jdate-picker.js') }}?v={{ filemtime(public_path('js/jdate-picker.js')) }}"></script>
    </div>
@else
    <span class="panel-chip" title="تاریخ امروز سامانه">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline>
        </svg>
        {{ $dateSelected }}
    </span>
@endif
