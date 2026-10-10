{{--
    گزارش کامل یک کارمند (CustomerController::report).

    صفحهٔ مستقل پشت گارد مدیر؛ از کارت‌های هر بخش اصلی پنل (کارمندها / آرشیو)
    باز می‌شود. اعداد را کنترلر با همان توابع کارت‌های داشبورد آماده می‌کند
    تا گزارش و کارت‌ها هیچ‌وقت با هم ناسازگار نشوند.
--}}
@extends('layouts.panel')

@php
    $panelNav = array(
        array('label' => 'بازگشت به داشبورد', 'href' => route('desc'), 'icon' => 'menu'),
        array('label' => 'گزارش کارمند', 'href' => '#report', 'icon' => 'users'),
    );

    $e2p = function ($value) {
        return \App\Http\Controllers\FunctionsController::e2p($value);
    };
    $money = function ($value) {
        return \App\Http\Controllers\FunctionsController::e2p(number_format((int) $value)) . ' ریال';
    };
@endphp

@section('title')
    گزارش کارمند — {{ $customer->name }}
@endsection

@section('page_title')
    گزارش کامل کارمند
@endsection

@section('page_subtitle')
    {{ $customer->name }} — سوابق حضور، فعالیت و دریافتی‌ها
@endsection

@section('content')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">

                {{-- ================= کارت هویت ================= --}}
                <div class="card">
                    <div class="card-header" id="report">
                        گزارش کامل کارمند
                        <small><a style="color:black" href="{{ route('desc') }}">بازگشت به داشبورد</a></small>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                @if(\App\Http\Controllers\PhotoController::show($customer->id)->exists())
                                    <img src="/images/users/{{\App\Http\Controllers\PhotoController::show($customer->id)->orderBy('tbl_users_profile.id','desc')->first()->name}}"
                                         class="rounded" style="max-height: 240px; max-width: 100%; width: auto;" alt="{{ $customer->name }}">
                                @else
                                    <img src="{{asset('images/users/PRP.jpg')}}" class="rounded" style="max-height: 240px; max-width: 100%; width: auto;" alt="{{ $customer->name }}">
                                @endif
                            </div>
                            <div class="col-md-9">
                                <h4 class="mb-2">
                                    {{ $customer->name }}
                                    <small class="text-muted">— {{ $roleName }}</small>
                                    @if($archivedFa)
                                        <span class="badge bg-secondary">آرشیو شده</span>
                                    @else
                                        <span class="badge bg-success">فعال</span>
                                    @endif
                                </h4>
                                <p class="mb-1">
                                    کد ملی: <bdi>{{ $e2p($customer->national_code) }}</bdi>
                                    &nbsp; / &nbsp;
                                    ایمیل: <bdi>{{ $customer->email }}</bdi>
                                </p>
                                @if($archivedFa)
                                    <p class="mb-1">تاریخ آرشیو: <bdi>{{ $archivedFa }}</bdi></p>
                                @endif
                                <p class="mb-0">
                                    {{-- لینک‌ها باید ریشه‌محور باشند: این صفحه در /customers/report/id/… است و
                                         لینک نسبی به /customers/report/id/calendar/… می‌خورد و 404 می‌شود. --}}
                                    <a href="/salary/activity/c/{{$customer->id}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}">مشاهدهٔ فعالیت ماه جاری</a>
                                    <span> / </span>
                                    <a href="/calendar/year/{{\App\Http\Controllers\CalendarController::detectSolarDate()}}/c/{{$customer->id}}">تقویم حضور و غیبت</a>
                                    @if($archivedFa)
                                        <span> / </span>
                                        <a href="/customers/restore/id/{{$customer->id}}">بازگردانی از آرشیو</a>
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- ============ کارت‌های کلیدی سوابق ============ --}}
                <div class="card mt-3">
                    <div class="card-header">سوابق حضور و فعالیت</div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">ورود به مجموعه</small>
                                        <h5 class="mb-0"><bdi>{{ $joinedFa }}</bdi></h5>
                                        <small class="text-muted">
                                            مدت عضویت: {{ $e2p($memberDays) }} روز
                                        </small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">اولین فعالیت</small>
                                        <h5 class="mb-0"><bdi>{{ $firstFa }}</bdi></h5>
                                        <small class="text-muted">نخستین روزی که تایمر ثبت کرده است</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">آخرین فعالیت</small>
                                        <h5 class="mb-0"><bdi>{{ $lastFa }}</bdi></h5>
                                        <small class="text-muted">آخرین روزی که تایمر ثبت کرده است</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">روزهای فعال</small>
                                        <h5 class="mb-0">{{ $e2p($activeDays) }} روز</h5>
                                        <small class="text-muted">{{ $e2p($eventCount) }} رویداد تایمر ثبت شده</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="btn-group" role="group" style="display:flex; flex-wrap:wrap;">
                                    <button type="button" class="btn btn-success">
                                        روزهای حضور <span class="badge bg-light text-dark">{{ $e2p($statPresent) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-outline-secondary">
                                        روزهای کاری <span class="badge bg-secondary">{{ $e2p($statWork) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-danger">
                                        غیبت <span class="badge bg-light text-dark">{{ $e2p($statAbsent) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-secondary">
                                        تعطیلات رسمی <span class="badge bg-light text-dark">{{ $e2p($statHoliday) }}</span>
                                    </button>
                                    <button type="button" class="btn btn-warning">
                                        جمعه / موارد خاص <span class="badge bg-dark">{{ $e2p($statFriday) }}</span>
                                    </button>
                                </div>
                                <small class="text-muted">
                                    آمار از تاریخ ورود تا امروز؛ غیبت = روزهای کاری که تایمری ثبت نشده است.
                                </small>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- ============ کارت‌های دریافتی‌ها ============ --}}
                <div class="card mt-3">
                    <div class="card-header">مجموع دریافتی‌ها و ساعت‌ها</div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="card text-white bg-primary">
                                    <div class="card-body py-2">
                                        <small>مجموع دریافتی کل</small>
                                        <h5 class="mb-0"><bdi>{{ $money($totalIncome) }}</bdi></h5>
                                        <small>از اولین ماه حضور تا امروز</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">حقوق و عملکرد</small>
                                        <h5 class="mb-0"><bdi>{{ $money($totalActivity) }}</bdi></h5>
                                        <small class="text-muted">ساعت کاری و اضافه‌کاری × نرخ نقش</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">امتیازات</small>
                                        <h5 class="mb-0"><bdi>{{ $money($totalPoints) }}</bdi></h5>
                                        <small class="text-muted">مجموع ارزش امتیازهای ثبت‌شده</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">پاداش‌ها</small>
                                        <h5 class="mb-0"><bdi>{{ $money($totalRewards) }}</bdi></h5>
                                        <small class="text-muted">عیدی و پاداش‌های ثبت‌شده</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row mt-3">
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">مجموع ساعت کاری</small>
                                        <h5 class="mb-0"><bdi>{{ $e2p($totalNormal) }}</bdi> ساعت</h5>
                                        <small class="text-muted">جمع ستون «ساعت کاری» جدول زیر</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-light">
                                    <div class="card-body py-2">
                                        <small class="text-muted">مجموع اضافه‌کاری</small>
                                        <h5 class="mb-0"><bdi>{{ $e2p($totalExtra) }}</bdi> ساعت</h5>
                                        <small class="text-muted">جمع ستون «اضافه‌کاری» جدول زیر</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- ============ جدول ماهانه ============ --}}
                <div class="card mt-3 mb-4">
                    <div class="card-header">جدول ماهانهٔ سوابق</div>
                    <div class="card-body">
                        @if(count($rows) == 0)
                            <p class="mb-0 text-muted">هنوز سوابق ماهانه‌ای ثبت نشده است.</p>
                        @else
                            <div class="table-responsive">
                                <table class="table table-striped table-bordered" style="vertical-align: middle">
                                    <thead class="table-light">
                                        <tr>
                                            <th scope="col">ماه</th>
                                            <th scope="col">حضور</th>
                                            <th scope="col">غیبت</th>
                                            <th scope="col">ساعت کاری</th>
                                            <th scope="col">اضافه‌کاری</th>
                                            <th scope="col">عملکرد</th>
                                            <th scope="col">امتیازات</th>
                                            <th scope="col">پاداش</th>
                                            <th scope="col">جمع دریافتی</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($rows as $row)
                                            <tr>
                                                <th scope="row">{{ $row['label'] }}</th>
                                                <td>{{ $e2p($row['present']) }}</td>
                                                <td>{{ $e2p($row['absent']) }}</td>
                                                <td><bdi>{{ $e2p($row['normal']) }}</bdi></td>
                                                <td><bdi>{{ $e2p($row['extra']) }}</bdi></td>
                                                <td><bdi>{{ $money($row['activity']) }}</bdi></td>
                                                <td><bdi>{{ $money($row['points']) }}</bdi></td>
                                                <td><bdi>{{ $money($row['reward']) }}</bdi></td>
                                                <td><bdi><b>{{ $money($row['income']) }}</b></bdi></td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                    <tfoot class="table-light">
                                        <tr>
                                            <th scope="row">جمع کل</th>
                                            <td>{{ $e2p($totalPresent) }}</td>
                                            <td>{{ $e2p($totalAbsent) }}</td>
                                            <td><bdi>{{ $e2p($totalNormal) }}</bdi></td>
                                            <td><bdi>{{ $e2p($totalExtra) }}</bdi></td>
                                            <td><bdi>{{ $money($totalActivity) }}</bdi></td>
                                            <td><bdi>{{ $money($totalPoints) }}</bdi></td>
                                            <td><bdi>{{ $money($totalRewards) }}</bdi></td>
                                            <td><bdi><b>{{ $money($totalIncome) }}</b></bdi></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <small class="text-muted">
                                ماه‌ها به ترتیب از اولین ماه حضور تا امروز؛ در ماه‌های بدون فعالیت،
                                غیبت برابر تعداد روزهای کاری همان ماه است.
                            </small>
                        @endif
                    </div>
                </div>

            </div>
        </div>
    </div>
@endsection
