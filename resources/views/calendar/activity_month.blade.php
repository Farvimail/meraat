<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\TimerController;
use App\Http\Controllers\FunctionsController;
use App\Http\Controllers\PhotoController;
use App\Http\Controllers\SalaryController;

?>

@extends('layouts.panel')

@php
    // این صفحه همان پوستهٔ پنل را می‌گیرد، پس منو هم باید همان چیزی باشد که
    // واقعاً در دسترس است: بازگشت به میزکار و پرش به فهرست ماه‌ها.
    $panelNav = array(
        array('label' => 'میزکار مدیریت', 'href' => url('/manager'), 'icon' => 'grid'),
        array('label' => 'ماه‌های سال', 'href' => '#calendars', 'icon' => 'calendar'),
    );
@endphp

@section('title')
تقویم فعالیت سال
{{$year}}
{{$customer->name}}
@endsection

@section('page_title')
    تقویم فعالیت سال {{ FunctionsController::e2p($year) }}
@endsection

@section('page_subtitle')
    {{ $customer->name }} — حضور، غیبت، مرخصی و اضافه‌کاری در یک نگاه
@endsection

@section('activity_month')
    <div class="att-content">
        <div class="card">
            <div class="card-header panel-cal-head" id="calendars">
                @php($profile = PhotoController::show($customer_id)->orderBy('tbl_users_profile.id','desc')->first())
                <img class="panel-cal-avatar"
                     src="{{ $profile ? asset('images/users/'.$profile->name) : asset('images/users/PRP.jpg') }}"
                     alt="{{ $customer->name }}">
                <span class="panel-cal-who">
                    <strong>{{ $customer->name }}</strong>
                    <small>تقویم فعالیت سال {{ FunctionsController::e2p($year) }} هـ . ش</small>
                </span>
            </div>

            <div class="card-body">
                <div class="panel-cal-months">

                    <?php
                        $year_presents = 0;
                        $year_absents = 0;
                        $year_special = 0;
                        $year_salary = 0;
                        $year_activity = 0;
                        $year_point = 0;
                        $year_normal_time = [];
                        $year_extra_time = [];
                    ?>

                    @foreach ( CalendarController::packageMonths($year) as $item)

                        <article class="card panel-cal-month">
                            <header class="card-header">
                                <span class="panel-cal-month-name">{{$item->fa_month}}</span>
                                <small class="panel-cal-month-links">
                                    <a href="{{url('')}}/edit/m/{{auth('manager')->id()}}/c/{{$customer_id}}/month/{{$item->package}}">اصلاح</a>
                                    <span>/</span>
                                    <a href="{{url('')}}/print/m/{{auth('manager')->id()}}/c/{{$customer_id}}/month/{{$item->package}}">چاپ</a>
                                </small>
                            </header>

                            <div class="card-body" style="direction: rtl">
                                <blockquote class="blockquote mb-0">
                                    <?php
                                    $day = 0;
                                    $presents = 0;
                                    $absents = 0;
                                    $vacations = 0;
                                    $special = 0;
                                    $holidays = 0;
                                    $salary = 0;
                                    $activity = 0;
                                    $point = 0;
                                    $normal_time = "";
                                    $extra_time = "";
                                    // one calendar read and one presence query per render
                                    // instead of two calendar reads and three presence
                                    // queries for every single day cell
                                    $calendarDays = CalendarController::selectedPackage($item->package);
                                    $presentByCalendar = TimerController::savedTimesMap($customer_id);
                                    ?>
                                    @for($j = 0; $j < 6; $j++)
                                        <div class="row">
                                            @for($i = 1; $i <= 6; $i++)
                                                <?php

                                                if( count($calendarDays) > ($day+1))
                                                {
                                                    $calendar = $calendarDays[$day++];
                                                    $elapced = TimerController::pastDays($calendar->dmy);
                                                    $classes = "";
                                                } else
                                                    break;

                                                if ( $elapced ):
                                                    $present = isset($presentByCalendar[$calendar->id]) ? $presentByCalendar[$calendar->id] : null;
                                                    if ( $present ){
                                                        if ( $calendar->status == 1) {
                                                            if ( $present->start == 1
                                                                && $present->pause == 1) {
                                                                $vacations++;
                                                                $classes .= "btn-primary ";
                                                            }else{
                                                                $classes .= "btn-success ";
                                                            }
                                                            $presents++;
                                                        }
                                                        if ( $calendar->status == 2) {
                                                            $classes .= "btn-warning ";
                                                            $special++;
                                                        }
                                                    }else{
                                                        if ( $calendar->status !== 3) {
                                                            $classes = "btn-danger";
                                                            if ( $calendar->status==2 ){
                                                                $classes = "btn-secondary";
                                                                $holidays++;
                                                            }else
                                                                $absents++;
                                                        }
                                                    }
                                                endif;
                                                ?>

                                                <div class="col {{$classes}} {{$calendar->status==2?'cln-holiday':($calendar->status==3?'cln-disabled':'')}}"><a href="{{url('')}}/single/edit/m/{{auth('manager')->id()}}/c/{{$customer_id}}/d/{{$calendar->dmy}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}">{{FunctionsController::e2p(explode("/",$calendar->fa_date)[0])}}</a></div>
                                            @endfor
                                        </div>
                                    @endfor
                                </blockquote>
                            </div>

                            <footer class="card-footer">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-goldenrod">
                                        <?php $salary = SalaryController::getSum($item->package, $customer_id)['activity_value']+SalaryController::getSum($item->package, $customer_id)['point_value']; ?>
                                        مجموع کل فعالیت<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($salary))." ریال "}}</span>
                                    </button>
                                    <button type="button" class="btn btn-info">
                                        <?php $activity = SalaryController::getSum($item->package, $customer_id)['activity_value']; ?>
                                        مجموع عملکرد<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($activity))." ریال "}}</span>
                                    </button>
                                    <button type="button" class="btn btn-danger">
                                        <?php $point = SalaryController::getSum($item->package, $customer_id)['point_value']; ?>
                                        مجموع امتیاز<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($point))." ریال "}}</span>
                                    </button>
                                    <button type="button" class="btn btn-warning">
                                        <?php $extra_time = SalaryController::getSum($item->package, $customer_id)['extra_time'] > -1? SalaryController::getSum($item->package, $customer_id)['extra_time']: 0; ?>
                                        ساعت اضافه کاری <span class="badge bg-secondary">{{FunctionsController::e2p($extra_time)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-success">
                                        <?php $normal_time = SalaryController::getSum($item->package, $customer_id)['normal_time'] > -1 ? SalaryController::getSum($item->package, $customer_id)['normal_time'] : 0; ?>
                                        ساعت کاری عادی <span class="badge bg-secondary">{{FunctionsController::e2p($normal_time)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-secondary">
                                        تعطیل<span class="badge bg-secondary">{{FunctionsController::e2p($holidays)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-primary">
                                        مرخصی <span class="badge bg-secondary">{{FunctionsController::e2p($vacations)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-warning">
                                        خاص <span class="badge bg-secondary">{{FunctionsController::e2p($special)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-danger">
                                        غیبت <span class="badge bg-secondary">{{FunctionsController::e2p($absents)}}</span>
                                    </button>
                                    <button type="button" class="btn btn-success">
                                        حضور <span class="badge bg-secondary">{{FunctionsController::e2p($presents)}}</span>
                                    </button>
                                </div>
                            </footer>
                        </article>

                        <?php
                            $year_presents += $presents;
                            $year_absents += $absents;
                            $year_special += $special;
                            $year_salary += $salary;
                            $year_activity += $activity;
                            $year_point += $point;
                            array_push($year_normal_time, $normal_time);
                            array_push($year_extra_time, $extra_time);
                        ?>
                    @endforeach

                </div>
            </div>

            <footer class="card-footer panel-cal-yearfoot">
                <p>
                    {{$customer->name}}
                    دارای
                    <span class="btn btn-primary">
                        {{FunctionsController::e2p($year_presents)}}
                        حضور
                        <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(SalaryController::sumYearParts($year_normal_time))." ساعت "}}</span>
                    </span>
                    <span class="btn btn-danger">
                        غیبت <span class="badge bg-secondary" style="direction:ltr"> {{FunctionsController::e2p($year_absents)}} </span>
                    </span>
                    و
                    <span class="btn btn-warning">
                        {{FunctionsController::e2p($year_special)}}
                        روز
                        خاص
                        <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(SalaryController::sumYearParts($year_extra_time))." ساعت "}}</span>
                    </span>
                    در تقویم سال جاری خود است.
                </p>
                <p>
                    مجموع فعالیت سال {{FunctionsController::e2p($year)}} هـ . ش
                    <strong>{{FunctionsController::e2p(number_format($year_salary))}}</strong>
                    ریال می‌باشد.
                </p>
                <p>
                    به تفکیک شامل
                    <span class="btn btn-danger">
                        امتیاز <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(number_format($year_point))." ریال "}}</span>
                    </span>
                    و
                    <span class="btn btn-danger">
                        هزینه عملکرد <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(number_format($year_activity))." ریال "}}</span>
                    </span>
                    می‌باشد.
                </p>
            </footer>
        </div>
    </div>
@endsection

@section('toasts')
    @include('partials.toasts')
@endsection
