<?php
use App\Http\Controllers\PointsController;
use App\Http\Controllers\RolesController;
use App\Http\Controllers\AppendPointsController;
use App\Http\Controllers\AppendRolesController;
use App\Http\Controllers\AppendCustomerController;
use App\Http\Controllers\CustomerPointController;
use App\Http\Controllers\CustomerBankController;
use App\Http\Controllers\CustomerContactController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\TimerController;
use App\Http\Controllers\FunctionsController;
use Illuminate\Support\Facades\Auth;

//var_dump(auth()->guard('manager')->id());
//var_dump(PointsController::managerData(auth()->guard('manager')->id()))
?>

@extends('layouts.auth')

@section('title')
    نرم افزار حضوروغیاب
@endsection

@section('points')
    <!--div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="points>امتیازها</div>

                    <div class="card-body">
                        <div class="row">
                            @foreach ( AppendPointsController::showManagerPoints() as $item )
                                <div class="col-md-4">
                                    <input type="hidden" name="point_id" value="{{$item->id}}"/>
                                    <div class="card">
                                        <div class="card-body">
                                            <h5 class="card-title">{{$item->name}}</h5>
                                            <h6 class="card-subtitle mb-2 text-muted" style="direction: rtl">{{FunctionsController::e2p($item->value)}} ریال </h6>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
@endsection

@section('roles')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="roles">نقش‌ها</div>

                    <div class="card-body">
                        <div class="row">
                            @foreach ( AppendRolesController::showManagerRoles() as $item)
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-body">
                                            <h5 class="card-title text-right">{{$item->name}}</h5>
                                            <p class="card-text text-right">{{$item->desc}}</p>
                                        </div>
                                        <table class="table text-center table-bordered border-primary table-warning" style="direction: rtl">
                                            <tbody>
                                            <tr>
                                                <th class="text-left">حداقل ساعت کاری:</th>
                                                <td class="text-right">{{FunctionsController::e2p($item->min_time)}}</td>
                                            </tr>
                                            <tr>
                                                <th class="text-left">حداکثر ساعت کاری:</th>
                                                <td class="text-right">{{FunctionsController::e2p($item->max_time)}}</td>
                                            </tr>
                                            <tr>
                                                <th class="text-left">نرخ ساعت عادی: </th>
                                                <td class="text-right">{{FunctionsController::e2p($item->normal_score)}}</td>
                                            </tr>
                                            <tr>
                                                <th class="text-left">نرخ اضافه کاری: </th>
                                                <td class="text-right">{{FunctionsController::e2p($item->high_score)}}</td>
                                            </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div-->
@endsection

@section('customers')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="customers">همکاران</div>
                    <div class="card-body">
                        <div class="row">
                            @foreach ( AppendCustomerController::showManagerCustomers() as $item)
                                <div class="col-md-4">
                                    <div class="card">
                                        @if(\App\Http\Controllers\PhotoController::show($item->customer_id)->exists())
                                            <img src="images/users/{{\App\Http\Controllers\PhotoController::show($item->customer_id)->orderBy('tbl_users_profile.id','desc')->first()->name}}" class="card-img-top" alt="...">
                                        @else
                                            <img src="{{asset('images/users/PRP.jpg')}}" class="card-img-top" alt="...">
                                        @endif
                                        <div class="card-body">
                                            <input type="hidden" name="customer_id" value="{{$item->customer_id}}"/>
                                            <h5 class="card-title text-center">{{AppendCustomerController::showCustomer($item->customer_id)->name}}</h5>
                                            <h6 class="card-subtitle mb-2 text-center" style="direction: rtl">{{!empty(AppendRolesController::selectedManagerRole(\App\Http\Controllers\CalendarController::findPackage(), $item->customer_id))?AppendRolesController::selectedManagerRole(\App\Http\Controllers\CalendarController::findPackage(), $item->customer_id)->name:'در حال انتخاب'}}</h6>
                                        </div>
                                        <ul class="list-group list-group-flush">
                                            <div class="tab-pane fade col-12 show active" id="nav-presents-{{$item->customer_id}}" role="tabpanel" aria-labelledby="nav-presents-tab-{{$item->customer_id}}">
                                                <div class="inverse-timer cc_cursor">
                                                    <div class="digital-timer digital-timer-{{$item->customer_id}} cc_cursor">{{FunctionsController::e2p('00 : 00\' : 00" ')}}</div>
                                                    <progress id="timer-progress" value="100" max="100" style="display: none;"></progress>زمان سپری شده
                                                </div>
                                                <div class="btn-group mb-5" role="group" style="display: flex; vertical-align: middle; justify-content: center;" aria-label="Basic mixed styles example">
                                                    <button type="button" id="timer-pause-{{$item->customer_id}}" class="btn btn-danger col-md-5">توقف</button>
                                                    <button type="button" id="timer-start-{{$item->customer_id}}" class="btn btn-success col-md-5">شروع</button>
                                                </div>
                                            </div>
                                        </ul>
                                    </div>
                                </div>
                                @if ( !empty(TimerController::check($item->customer_id)) )
                                    <script src="{{ asset('js/timer.js') }}" rel="preload" as="script" ></script>
                                    <script type="text/javascript">
                                        var dt{{$item->customer_id}};
                                        runTimer({{$item->customer_id}});
                                    </script>
                                @endif
                            @endforeach
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>

@endsection

@section('calendars')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="calendars">فعالیت ماهانه</div>

                    <div class="card-body">
                        <div class="row">

                            @foreach ( AppendCustomerController::showManagerCustomers() as $item)

                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header">
                                            {{$item->name}}
                                        </div>
                                        <div class="card-body" style="direction: rtl">
                                            <blockquote class="blockquote mb-0">
                                                <?php
                                                $day = 0;
                                                $presents = 0;
                                                $absents = 0;
                                                $vacations = 0;
                                                $special = 0;
                                                $holidays = 0;?>
                                                @for($j = 0; $j < 6; $j++)
                                                    <div class="row">
                                                        @for($i = 1; $i <= 6; $i++)
                                                            <?php

                                                            if( CalendarController::show()->count() > ($day+1))
                                                            {
                                                                $calendar = CalendarController::show()[$day++];
                                                                $elapced = TimerController::pastDays($calendar->dmy);
                                                                $classes = "";
                                                            }
                                                             else
                                                                break;

                                                            if ( $elapced ):
                                                                $present = TimerController::savedTimes($item->customer_id, $calendar->id);
                                                                if ( $present->exists() ){
                                                                    if ( $calendar->status == 1) {
                                                                        if ( $present->first()->start == 0
                                                                            && $present->first()->pause == 0) {
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

                                                            <div class="col {{$classes}} {{$calendar->status==2?'cln-holiday':($calendar->status==3?'cln-disabled':'')}}">{{FunctionsController::e2p(explode("/",$calendar->fa_date)[0])}}</div>
                                                        @endfor
                                                    </div>
                                                @endfor
                                            </blockquote>
                                        </div>
                                        <footer class="card-footer" style="width:auto; overflow-x:auto;">
                                            <div class="btn-group">
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

                            @endforeach

                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>

@endsection

@section('toasts')
    <div class="position-fixed toasts-stack bottom-0 right-0 p-3" style="z-index: 5; right: 0; bottom: 0;">
        @if (session('status'))
            <div id="liveToast" class="toast php-toast fade" role="alert" aria-live="assertive" aria-atomic="true" data-animation="true" data-delay="2000">
                <div class="toast-header">
                    <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="green"></rect></svg>
                    <strong class="mr-auto">انجام شد</strong>
                    <small>Mgh-App</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="toast-body">
                    {{ session('status') }}
                </div>
            </div>
        @endif
    </div>
@endsection


