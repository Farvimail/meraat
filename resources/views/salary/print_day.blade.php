@extends('layouts.print')

@section('title')
    چاپ روز {{$full_name}}
@endsection

@section('report')

    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="fish-header">
                    <div class="col-md-3 text-right">
                        <h5><strong><input type="text" value="تاریخ گزارش: {{$fa_da}}" style="border:none;font-weight: bold; width:250px; text-align:right;"/></strong></h5>
                    </div>
                    <div class="col-md-6">
                        <img src="/public/images/logo/arm.jpg" class="fish-logo" width="100px" height="100px" />
                        <h5><strong><input type="text" value="صندوق قرض الحسنه مرآت الانبیاء شهر فرخی" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="گزارش روزانه فعالیت {{$full_name}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="{{$fish_month}} {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    </div>
                    <div class="col-md-3 text-left">
                        <h5><strong><input type="text" value="سمت: {{$role_name}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    </div>
                </div>
                <table class="table table-bordered">
                    <thead>
                    <tr>
                        <th><strong>ردیف</strong></th>
                        <th><strong>تاریخ</strong></th>
                        <th><strong>وضعیت</strong></th>
                        <th><strong>زمان</strong></th>
                        <th><strong>مبلغ دوره</strong></th>
                        <th><strong>بازه زمانی</strong></th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php $counter = 0;?>
                    @foreach(\App\Http\Controllers\SalaryController::thisDay($dayid, $month) as $days )
                        <?php $item = \App\Http\Controllers\SalaryController::getInfo($mid, $cid, $days->dmy, $month);
                        $time = "00:00";$status=""?>
                        @if($item->count() == 0)
                            <tr class="single-row">
                                <td>
                                    {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$days->fa_date)[0])}}
                                </td>
                                <td>
                                    {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::ltrDate($days->fa_date))}}
                                </td>
                                <td>
                                    غیبت
                                </td>
                                <td>
                                    {{$time!="00:00"?\App\Http\Controllers\FunctionsController::e2p($time):"_"}}
                                </td>
                                <td>
                                    {{trim($status)=="توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesPrint((int)$cid, $item, $days->status, $month)):"_"}}
                                </td>
                                <td>
                                    {{trim($status)=="توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesTime((int)$cid, $item, $days->status, $month)):"_"}}
                                </td>
                            </tr>
                        @else
                            <?php $counter++; ?>
                            @foreach($item as $index => $cus)
                                <?php
                                $info = $item[$index];
                                $status = " غیبت";
                                $time = "00:00";

                                if ( $info->pause == 0 && $info->start == 1 ):
                                    $status = " حضور";
                                    $time = $info->time;
                                elseif ( $info->pause == 1 && $info->start == 0 ):
                                    $status = " توقف";
                                    $time = $info->time;
                                elseif ( $info->pause == 1 && $info->start == 1 ):
                                    $status = " مرخصی";
                                    $time = $info->time;
                                endif;
                                ?>

                                <tr class="{{( $status == "حضور" && ($index+1 < $item->count()) && ($item[$index+1]->pause != 1 && $item[$index+1]->start != 0) || $status == " حضور" && ($item->count()==1) )?'text-strong':null}}">
                                    <td>
                                        {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$days->fa_date)[0])}}
                                    </td>
                                    <td>
                                        {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::ltrDate($days->fa_date))}}
                                    </td>
                                    <td>
                                        {{$status}}
                                    </td>
                                    <td>
                                        {{$time!="00:00"?\App\Http\Controllers\FunctionsController::e2p($time):"_"}}
                                    </td>
                                    <td>
                                        {{trim($status)=="توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesPrint((int)$cid, $item, $days->status, $month)):"_"}}
                                    </td>
                                    <td>
                                        {{trim($status)=="توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesTime((int)$cid, $item, $days->status, $month)):"_"}}
                                    </td>
                                </tr>
                            @endforeach
                        @endif
                    @endforeach
                    <tr class="sign_row">
                        <th colspan="3"><input type="text" value="امضا هیئت مدیره: احمد صفار" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
                        <th colspan="3"><input type="text" value="امضا مدیر عامل: حسین ترابی" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
                    </tr>
                    </tbody>
                </table>
                <p class="text-center" style="font-size:16px">
                    آدرس: استان اصفهان، شهرستان خوروبیابانک، بخش مرکزی، شهر فرخی، محله مصلا، کوچه لاله، خیابان امام خمینی (ره)، پلاک
                    {{\App\Http\Controllers\FunctionsController::e2p(153)}}، طبقه همکف
                    <br>
                    کد پستی {{\App\Http\Controllers\FunctionsController::e2p("8364116113
                    ، تلفن: 2800-4637-031
                    ")}}
                </p>
            </div>
        </div>
        @endsection

        @section('toasts')
            <div class="position-fixed toasts-stack bottom-0 right-0 p-3" style="z-index: 5; right: 0; bottom: 0;">
                @if (session('status'))
                    <div id="liveToast" style="direction: ltr" class="toast php-toast fade" role="alert" aria-live="assertive" aria-atomic="true" data-animation="true" data-delay="2000">
                        <div class="toast-header">
                            <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="green"></rect></svg>
                            <strong class="mr-auto">انجام شد!</strong>
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
            <script type="text/javascript" rel="preload" as="script">
                $(document).ready(function(){

                    var persianNumbers = [/0/g, /1/g, /2/g, /3/g, /4/g, /5/g, /6/g, /7/g, /8/g, /9/g],
                        arabicNumbers  = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
                        d = document;

                    fixNumbers = function (str)
                    {
                        if( typeof str === 'string'){
                            for( var i = 0; i < 10; i++)
                                str = str.replace(persianNumbers[i],arabicNumbers[i]);}
                        return str;
                    }

                    Array.from(document.querySelectorAll('input[type="text"]')).forEach(b => {
                        b.onkeyup = function() {
                            myFunction(this)
                        }
                    });

                    function myFunction(e) {
                      e.value = fixNumbers(e.value);
                    }
                });
            </script>
@endsection

