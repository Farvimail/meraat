<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\TimerController;
use App\Http\Controllers\FunctionsController;

?>

@extends('layouts.auth')

@section('title')
تقویم فعالیت سال 
{{$year}}
{{$customer->name}}
@endsection

@section('activity_month')
<style>
    .row {
    display: block !important;
    margin-right: -15px;
    margin-left: -15px;
}
</style>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header text-center" id="calendars">
                        @if(\App\Http\Controllers\PhotoController::show($customer_id)->exists())
                            <?php 
                                $pre = "http://localhost/public/images/users/";
                                $customer_profile = \App\Http\Controllers\PhotoController::show($customer_id)->orderBy('tbl_users_profile.id','desc')->first()->name;
                                $src = $pre.$customer_profile;
                            ?>
                            <img style="{ border-radius: 25px; padding: 3px; border: solid 3px gray; }" 
                                src="{{$src}}"
                                width="125px" height="125px"
                                alt="{{$customer->name}}">
                        @else
                            <img style="{ border-radius: 25px; padding: 3px; border: solid 3px gray; }" 
                                src="{{asset('images/users/PRP.jpg')}}" 
                                width="125px" height="125px"
                                alt="{{$customer->name}}">
                        @endif
                        <p>
                            <h4>
                                تقویم فعالیت سال 
                                {{FunctionsController::e2p($year)}}   
                               هـ . ش
                            </h4>
                            <h4>
                                {{$customer->name}}
                            </h4>
                        </p>
                    </div>

                    <div class="card-body">
                        <div class="activity_months" style="display: flex;">
                        
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

                                <div class="col-md-4" style="margin-bottom:15px">
                                    <div class="card">
                                        <div class="card-header">
                                            {{$item->fa_month}}
                                            <small><a href="{{url('')}}/edit/m/{{auth('manager')->id()}}/c/{{$customer_id}}/month/{{$item->package}}">اصلاح</a></small>
                                            <small> / </small>
                                            <small><a href="{{url('')}}/print/m/{{auth('manager')->id()}}/c/{{$customer_id}}/month/{{$item->package}}">چاپ</a></small>
                                        </div>
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
                                                ?>
                                                @for($j = 0; $j < 6; $j++)
                                                    <div class="row">
                                                        @for($i = 1; $i <= 6; $i++)
                                                            <?php

                                                            if( CalendarController::selectedPackage($item->package)->count() > ($day+1))
                                                            {
                                                                $calendar = CalendarController::selectedPackage($item->package)[$day++];
                                                                $elapced = TimerController::pastDays($calendar->dmy);
                                                                $classes = "";
                                                            } else
                                                                break;

                                                            if ( $elapced ):
                                                                $present = TimerController::savedTimes($customer_id, $calendar->id);
                                                                if ( $present->exists() ){
                                                                    if ( $calendar->status == 1) {
                                                                        if ( $present->first()->start == 1
                                                                            && $present->first()->pause == 1) {
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
                                        <footer class="card-footer" style="width:auto; overflow-x:auto;">
                                            <div class="btn-group">
                                                <button type="button" class="btn btn-goldenrod">
                                                    <?php $salary = \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['activity_value']+\App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['point_value']; ?>
                                                    مجموع کل فعالیت<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($salary))." ریال "}}</span>
                                                </button>
                                                <button type="button" class="btn btn-info">
                                                    <?php $activity = \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['activity_value']; ?>
                                                    مجموع عملکرد<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($activity))." ریال "}}</span>
                                                </button>
                                                <button type="button" class="btn btn-danger">
                                                    <?php $point = \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['point_value']; ?>
                                                    مجموع امتیاز<span class="badge bg-secondary" style="direction:rtl">{{FunctionsController::e2p(number_format($point))." ریال "}}</span>
                                                </button>
                                                <button type="button" class="btn btn-warning">
                                                    <?php $extra_time = \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['extra_time'] > -1? \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['extra_time']: 0; ?>
                                                    ساعت اضافه کاری <span class="badge bg-secondary">{{FunctionsController::e2p($extra_time)}}</span>
                                                </button>
                                                <button type="button" class="btn btn-success">
                                                    <?php $normal_time = \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['normal_time'] > -1 ? \App\Http\Controllers\SalaryController::getSum($item->package, $customer_id)['normal_time'] : 0; ?>
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
                                    </div>

                                </div>
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
                    <div class="card-footer text-center">
                        <p>
                            <h4>
                                {{$customer->name}}
                                دارای
                                <button type="button" class="btn btn-primary">
                                    {{FunctionsController::e2p($year_presents)}}
                                    حضور  
                                    <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumYearParts($year_normal_time))." ساعت "}}</span>
                                </button>
                                <button type="button" class="btn btn-danger">
                                    غیبت <span class="badge bg-secondary" style="direction:ltr"> {{FunctionsController::e2p($year_absents)}} </span>
                                </button>
                                و
                                <button type="button" class="btn btn-primary">
                                    {{FunctionsController::e2p($year_special)}}
                                    روز
                                    اضافه کاری
                                    <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumYearParts($year_extra_time))." ساعت "}}</span>
                                </button>
                                در
                                تقویم 
                                سال 
                                جاری
                                خود
                                است.
                            </h4>
                        </p>
                        <p>
                            <h4>
                                مجموع فعالیت سال
                                {{FunctionsController::e2p($year)}}   
                                هـ . ش   
                                <strong><u>
                                {{FunctionsController::e2p(number_format($year_salary))}}
                                </u></strong>
                                ریال
                                میباشد 
                            </h4>
                        </p>
                        <p>
                            <h5>
                                به
                                تفکیک
                                شامل
                                <button type="button" class="btn btn-danger">
                                   امتیاز <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(number_format($year_point))." ریال "}}</span>
                                </button>
                                و
                                <button type="button" class="btn btn-danger">
                                    هزینه عملکرد <span class="badge bg-secondary" style="direction:ltr">{{FunctionsController::e2p(number_format($year_activity))." ریال "}}</span>
                                </button>
                                می باشد.
                            </h5>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

@endsection