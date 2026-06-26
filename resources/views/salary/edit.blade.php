@extends('layouts.print')

@section('title')
    اصلاح حضور و غیاب {{$full_name}}
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
                        <a href="/public/print/m/{{$mid}}/c/{{$cid}}/month/{{$month}}"><img src="/public/images/logo/arm.jpg" class="fish-logo" width="100px" height="100px" /></a>
                        <h5><strong><input type="text" value="صندوق قرض الحسنه مرآت الانبیاء شهر فرخی" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="گزارش ماهانه فعالیت {{$full_name}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="{{$fish_month}} {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    </div>
                    <div class="col-md-3 text-left">
                        <h5><strong><input type="text" value="سمت: {{$role_name}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    </div>
                </div>
                <div class="container col-striped">
                    <div class="row">
                        <div class="col">
                            <strong>ردیف</strong>
                        </div>
                        <div class="col">
                            <strong>تاریخ</strong>
                        </div>
                        <div class="col">
                            <strong>وضعیت</strong>
                        </div>
                        <div class="col">
                            <strong>زمان</strong>
                        </div>
                        <div class="col">
                            <strong>مبلغ دوره</strong>
                        </div>
                        <div class="col">
                            <strong>بازه زمانی</strong>
                        </div>
                        <div class="col">
                            <strong>عمل</strong>
                        </div>
                    </div>

                    <?php $counter = 0;?>
                    @foreach(\App\Http\Controllers\SalaryController::thisMonth($month) as $days )
                        <?php $item = \App\Http\Controllers\SalaryController::getInfo($mid, $cid, $days->dmy, $month);?>
                            @if($item->count() == 0)
                            <form action="{{route('salary.edit')}}" method="get">
                                @csrf
                                <input type="hidden" name="customer_id" value="{{$cid}}"/>
                                <input type="hidden" name="cid" value="{{$cid}}"/>
                                <input type="hidden" name="mid" value="{{$mid}}"/>
                                <input type="hidden" name="month" value="{{$month}}"/>
                                <input type="hidden" name="calendar_id" value="{{$days->id}}"/>
                                <input type="hidden" name="saved_time_id" value="{{0}}"/>
                                <div class="row single-row">
                                    <div class="col">
                                        {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$days->fa_date)[0])}}
                                    </div>
                                    <div class="col">
                                        {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::ltrDate($days->fa_date))}}
                                    </div>
                                    <div class="col">
                                        <?php
                                        $info = $item;
                                        $time = "00:00";

                                        ?>
                                        <select class="arrow-left form-select" name="status" aria-label="Default select example">
                                            <option selected>--- غیبت</option>
                                            <option value="1">حضور</option>
                                            <option value="2">توقف</option>
                                            <option value="3">غیبت</option>
                                            <option value="4">مرخصی</option>
                                        </select>
                                    </div>
                                    <div class="col">
                                        <input type="time" name="time" value="{{$time!="00:00"?$time:"00:00 pm"}}" style="width:80%; text-align: center"/>
                                    </div>
                                    <div class="col">
                                        {{"_"}}
                                    </div>
                                    <div class="col">
                                        {{"_"}}
                                    </div>
                                    <div class="col">
                                        <input type="submit" class="btn btn-success" value="بروزرسانی"/>
                                    </div>
                                </div>
                            </form>
                        @else
                            <?php $counter++; ?>
                            @foreach($item as $index => $cus)
                                <?php
                                    $info = $item[$index];
                                    $status = "--- غیبت";
                                    $time = "00:00";

                                    if ( $info->pause == 0 && $info->start == 1 ):
                                        $status = "--- حضور";
                                        $time = $info->time;
                                    elseif ( $info->pause == 1 && $info->start == 0 ):
                                        $status = "--- توقف";
                                        $time = $info->time;
                                    elseif ( $info->pause == 1 && $info->start == 1 ):
                                        $status = "--- مرخصی";
                                        $time = $info->time;
                                    endif;
                                ?>
                                <?php
                                    if ( $counter % 2 == 0):
                                        if( $info->pause == 1 && $info->start == 1)
                                            $cus_class = $days->status==2?"multiple-row-even":"multiple-row-even bg-primary text-white";
                                        else{
                                            if ( $days->status==2 ){
                                                $cus_class = "multiple-row-even bg-warning";
                                            }else{
                                                if ( $index>0&&$item[$index-1]->pause==1&&$item[$index-1]->start==1 ){
                                                    $cus_class = "multiple-row-even bg-primary text-white";
                                                }else{
                                                    $cus_class = "multiple-row-even";
                                                }
                                            }
                                        }
                                    else:
                                        if ( $info->pause == 1 && $info->start == 1)
                                            $cus_class = $days->status==2?"multiple-row-odd":"multiple-row-odd bg-primary text-white";
                                        else{
                                            if ( $days->status==2 ){
                                                $cus_class = "multiple-row-odd bg-warning";
                                            }else{
                                                if ( $index>0&&$item[$index-1]->pause==1&&$item[$index-1]->start==1 ){
                                                    $cus_class = "multiple-row-odd bg-primary text-white";
                                                }else{
                                                    $cus_class = "multiple-row-odd";
                                                }
                                            }
                                        }
                                    endif;
                                ?>

                                <form action="{{route('salary.edit')}}" method="get">
                                    @csrf
                                    <input type="hidden" name="customer_id" value="{{$cid}}"/>
                                    <input type="hidden" name="cid" value="{{$cid}}"/>
                                    <input type="hidden" name="mid" value="{{$mid}}"/>
                                    <input type="hidden" name="month" value="{{$month}}"/>
                                    <input type="hidden" name="calendar_id" value="{{$days->id}}"/>
                                    <input type="hidden" name="saved_time_id" value="{{$cus->saved_time_id}}"/>
                                    <div class="row {{$cus_class}} {{( $status == "حضور" && ($index+1 < $item->count()) && ($item[$index+1]->pause != 1 && $item[$index+1]->start != 0) || $status == "--- حضور" && ($item->count()==1) )?'bg-forgot':null}}">
                                        <div class="col">
                                            {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$days->fa_date)[0])}}
                                        </div>
                                        <div class="col">
                                            {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::ltrDate($days->fa_date))}}
                                        </div>
                                        <div class="col">
                                            <select class="arrow-left form-select" name="status" aria-label="Default select example">
                                                <option selected>{{$status}}</option>
                                                <option value="1">حضور</option>
                                                <option value="2">توقف</option>
                                                <option value="3">غیبت</option>
                                                <option value="4">مرخصی</option>
                                            </select>
                                        </div>
                                        <div class="col">
                                            <input type="time" name="time" value="{{$time!="00:00"?$time:"00:00 pm"}}" style="width:80%; text-align: center"/>
                                        </div>
                                        <div class="col">
                                            {{trim($status)=="--- توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesPrint((int)$cid, $item, $days->status, $month)):"_"}}
                                        </div>
                                        <div class="col">
                                            {{trim($status)=="--- توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesTime((int)$cid, $item, $days->status, $month)):"_"}}
                                        </div>
                                        <div class="col">
                                            <input type="submit" class="btn btn-success" value="بروزرسانی"/>
                                        </div>
                                    </div>
                                </form>
                                    <?php if ( $status == "--- حضور" && ($index+1 < $item->count()) && ($item[$index+1]->pause != 1 && $item[$index+1]->start != 0) || $status == "--- حضور" && ($item->count()==$index+1) ):?>
                                    <form action="{{route('salary.edit')}}" method="get">
                                        @csrf
                                        <input type="hidden" name="customer_id" value="{{$cid}}"/>
                                        <input type="hidden" name="cid" value="{{$cid}}"/>
                                        <input type="hidden" name="mid" value="{{$mid}}"/>
                                        <input type="hidden" name="month" value="{{$month}}"/>
                                        <input type="hidden" name="calendar_id" value="{{$days->id}}"/>
                                        <input type="hidden" name="saved_time_id" value="{{0}}"/>
                                        <div class="row {{$cus_class}} bg-forgot">
                                            <div class="col">
                                                {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$days->fa_date)[0])}}
                                            </div>
                                            <div class="col">
                                                {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::ltrDate($days->fa_date))}}
                                            </div>
                                            <div class="col">
                                                <select class="arrow-left form-select" name="status" aria-label="Default select example">
                                                    <option selected>--- توقف</option>
                                                    <option value="1">حضور</option>
                                                    <option value="2">توقف</option>
                                                    <option value="3">غیبت</option>
                                                    <option value="4">مرخصی</option>
                                                </select>
                                            </div>
                                            <div class="col">
                                                <input type="time" name="time" value="{{$time!="00:00"?$time:"00:00 pm"}}" style="width:80%; text-align: center"/>
                                            </div>
                                            <div class="col">
                                                {{trim($status)=="--- توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesPrint((int)$cid, $item, $days->status, $month)):"_"}}
                                            </div>
                                            <div class="col">
                                                {{trim($status)=="--- توقف"?\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::sumActivitiesTime((int)$cid, $item, $days->status, $month)):"_"}}
                                            </div>
                                            <div class="col">
                                                <input type="submit" class="btn btn-success" value="بروزرسانی"/>
                                            </div>
                                        </div>
                                    </form>
                                    <?php endif;?>
                            @endforeach
                        @endif
                    @endforeach
                </div>
            </div>
        </div>
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
@endsection

