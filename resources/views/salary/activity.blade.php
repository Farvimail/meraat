@extends('layouts.print')

@section('title')
حقوق و مزایای {{$full_name}}
@endsection

@section('fishtable')
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
                    <h5><strong><input type="text" value=" صورت وضعیت پرداخت حقوق و دستمزد {{$full_name}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    <h5><strong><input type="text" value="فیش حقوقی {{$fish_month}} {{\App\Http\Controllers\FunctionsController::e2p(explode("/",$find_today->fa_date)[2]%10000)}}" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                </div>
                <div class="col-md-3 text-left">
                    <h5><strong><input type="text"  id="variz" value="تاریخ واریز: {{$fa_da}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    <h5><strong><input type="text" value="سمت: {{$role_name}}" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                </div>

            </div>
            <table class="table table-bordered">
                <thead>
                <!--tr>
                    <th scope="col" colspan="4"><input type="text" value="حقوق و مزایای کارمند در ماه جاری" style="text-align:center;border:none;font-weight: bold; width:300px"/></th>
                </tr-->
                <tr>
                    <th scope="col" colspan="2">امتیاز</th>
                    <th scope="col" colspan="2">عملکرد</th>
                </tr>
                </thead>
                <tbody>
                <!--- change able part --->
                @foreach( \App\Http\Controllers\SalaryController::activityTable($month_id, $cid) as $index=>$item)
                    @if($index%2==0)
                    <tr>
                        <th width="25%">{{isset($item['point_name'])?\App\Http\Controllers\FunctionsController::e2p($item['point_name']):null}}</th>
                        <td width="25%">{{isset($item['point_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item['point_value']))." ریال ":null}}</td>

                        <th width="25%"><input type="text" value="{{isset($item['activity_name'])?\App\Http\Controllers\FunctionsController::e2p($item['activity_name']):null}}" style="font-weight:bold;border:none; text-align:center;"/></th>
                        <td width="25%">{{isset($item['activity_value'])?\App\Http\Controllers\FunctionsController::e2p($item['activity_value']):null}}</td>
                    </tr>
                    @else
                    <tr>
                        <th width="25%">{{isset($item['point_name'])?\App\Http\Controllers\FunctionsController::e2p($item['point_name']):null}}</th>
                        <td width="25%">{{isset($item['point_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item['point_value']))." ریال ":null}}</td>

                        <th width="25%"><input type="text" value="{{isset($item['activity_name'])?\App\Http\Controllers\FunctionsController::e2p($item['activity_name']):null}}" style="font-weight:bold;border:none; text-align:center;"/></th>
                        <td width="25%">{{isset($item['activity_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item['activity_value']))." ریال ":null}}</td>
                    </tr>

                    @endif
                @endforeach
                <!--- end change able part --->
                <tr>
                    <?php $item = \App\Http\Controllers\SalaryController::getSum($month_id, $cid) ?>
                    <th>{{isset($item['point_name'])?\App\Http\Controllers\FunctionsController::e2p($item['point_name']):null}}</th>
                    <td>{{isset($item['point_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item['point_value']))." ریال ":null}}</td>

                    <th>{{isset($item['activity_name'])?\App\Http\Controllers\FunctionsController::e2p($item['activity_name']):null}}</th>
                    <td>{{isset($item['activity_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format((int)$item['activity_value']))." ریال ":null}}</td>
                </tr>
                <?php $sum = $item['activity_value']+$item['point_value'] ?>
                <tr>
                    <th colspan="2"> <input type="text" value="مجموع کل فعالیت ماه" style="text-align:center; border:none;font-weight: bold; width:300px"/></th>
                    <td colspan="2">{{isset($item['activity_value'])&&isset($item['point_value'])?\App\Http\Controllers\FunctionsController::e2p(number_format(((int)($sum))))." ریال ":null}}</td>
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
