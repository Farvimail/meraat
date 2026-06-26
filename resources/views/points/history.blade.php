@extends('layouts.print')

@section('title')
    آرشیو امتیازها
    {{$fish_month}}
    {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}
@endsection

@section('points_history')
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
                        <h5><strong><input type="text" value=" صورت وضعیت امتیازهای حقوقی در ماه {{$fish_month}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="فیش حقوقی {{$fish_month}} {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    </div>
                    <div class="col-md-3 text-left">
                        <h5><strong><input type="text"  id="variz" value="تعداد امتیازها: {{\App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\SalaryController::pointsInfo($month_id)->count())}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    </div>

                </div>
                <table class="table table-bordered">
                    <thead>
                    <tr>
                        <th scope="col">ردیف</th>
                        <th scope="col">امتیاز</th>
                        <th scope="col">ارزش</th>
                    </tr>
                    </thead>
                    <tbody>
                    <!--- change able part --->
                    <?php $sum = 0;?>
                    @foreach( \App\Http\Controllers\SalaryController::pointsInfo($month_id) as $index=>$item)
                        <?php $sum+=$item->point_value; ?>
                        <tr>
                            <th width="25%">{{\App\Http\Controllers\FunctionsController::e2p($index+1)}}</th>
                            <th width="25%">{{\App\Http\Controllers\FunctionsController::e2p($item->point_name)}}</th>
                            <td width="25%">{{\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item->point_value))." ریال "}}</td>
                        </tr>
                    @endforeach
                    <!--- end change able part --->
                    <tr>
                        <th colspan="2"> <input type="text" value="مجموع کل امتیازهای ماه" style="text-align:center; border:none;font-weight: bold; width:300px"/></th>
                        <td colspan="2">{{\App\Http\Controllers\FunctionsController::e2p(number_format(((int)($sum))))." ریال "}}</td>
                    </tr>
                    <tr>
                        <th colspan="2">جمع مبلغ قابل پرداخت به حروف</th>
                        <th colspan="2" id="letterPrice">_</th>
                    </tr>
                    <tr class="sign_row">
                        <th colspan="2"><input type="text" value="امضا هیئت مدیره: احمد صفار" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
                        <th colspan="2"> <input type="text" value="امضا مدیر عامل: حسین ترابی" style="text-align:right; border:none;font-weight: bold; width:300px"/></th>
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
            $("#letterPrice").text(Num2persian({{(int)$sum}})+" ریال ")
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
