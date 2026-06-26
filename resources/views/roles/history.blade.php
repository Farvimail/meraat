@extends('layouts.print')

@section('title')
    آرشیو نقش ها
    {{$fish_month}}
    {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}
@endsection

@section('roles_history')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="fish-header">
                    <div class="col-md-3 text-right">
                        <h5><strong><input type="text" value="{{\App\Http\Controllers\FunctionsController::e2p("شناسه ملی: 14004924286")}}" style="border:none;font-weight: bold; width:250px"/></strong></h5>
                        <h5><strong><input type="text" value="{{\App\Http\Controllers\FunctionsController::e2p("کد ثبت: 23")}}" style="border:none;font-weight: bold; width:250px"/></strong></h5>
                    </div>
                    <div class="col-md-6">
                        <a href="/public/manager"><img src="/public/images/logo/arm.jpg" class="fish-logo" width="100px" height="100px" /></a>
                        <h5><strong><input type="text" value="صندوق قرض الحسنه مرآت الانبیاء شهر فرخی" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value=" صورت وضعیت اطلاعات نقش ها در ماه {{$fish_month}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="آرشیو {{$fish_month}} {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    </div>
                    <div class="col-md-3 text-left">
                        <h5><strong><input type="text"  id="variz" value="تعداد نقش ها: {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::rolesInfo($month_id, $cid)->count())}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    </div>

                </div>
                <table class="table table-bordered">
                    <thead>
                    <tr>
                        <th scope="col">ردیف</th>
                        <th scope="col">نقش</th>
                        <th scope="col">حداقل ساعت کاری</th>
                        <th scope="col">حداکثر ساعت کاری</th>
                        <th scope="col">نرخ عادی</th>
                        <th scope="col">نرخ اضافه کاری</th>
                    </tr>
                    </thead>
                    <tbody>
                    <!--- change able part --->

                    @foreach( \App\Http\Controllers\SalaryController::rolesInfo($month_id, $cid) as $index=>$item)
                        <tr>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p($index+1)}}</th>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p($item->name)}}</th>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p($item->min_time)}}</th>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p($item->max_time)}}</th>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item->normal_score))}}</th>
                            <th width="16.66%">{{\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item->high_score))}}</th>
                        </tr>
                    @endforeach
                    <!--- end change able part --->
                    <tr class="sign_row">
                        <th colspan="3"><input type="text" value="امضا هیئت مدیره: احمد صفار" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
                        <th colspan="3"> <input type="text" value="امضا مدیر عامل: حسین ترابی" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
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
