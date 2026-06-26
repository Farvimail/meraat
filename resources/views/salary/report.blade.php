@extends('layouts.print')

@section('report')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="fish-header">
                    <div class="col-md-3 text-right">
                        <h5><strong><input type="text" value="تاریخ گزارش: 01/01/1400" style="border:none;font-weight: bold; width:250px; text-align:right;"/></strong></h5>
                    </div>
                    <div class="col-md-6">
                        <img src="/public/images/logo/arm.jpg" class="fish-logo" width="100px" height="100px" />
                        <h5><strong><input type="text" value="صندوق قرض الحسنه مرآت الانبیاء شهر فرخی" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="گزارش ماهانه فعالیت مصطفی غفاری" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                        <h5><strong><input type="text" value="اسفند 99" style="text-align:center; border:none;font-weight: bold; width:450px;"/></strong></h5>
                    </div>
                    <div class="col-md-3 text-left">
                        <h5><strong><input type="text" value="سمت: حسابدار" style="border:none;font-weight: bold; width:250px; text-align:left;"/></strong></h5>
                    </div>
                </div>
                <table class="table table-bordered">
                    <thead>
                    <tr>
                        <th scope="col" style="width:5%">ردیف</th>
                        <th scope="col" style="width:19%">تاریخ</th>
                        <th scope="col" style="width:19%">وضعیت</th>
                        <th scope="col" style="width:19%">ورود</th>
                        <th scope="col" style="width:19%">توقف</th>
                        <th scope="col" style="width:19%">مبلغ روز</th>
                    </tr>
                    </thead>
                    <tbody>
                    <!--- change able part --->
                    <tr>
                        <th scope="row">1</th>
                        <td  rowspan="3">99/12/25</td>
                        <th>حضور</th>
                        <td>05:25:25</td>
                        <td>05:25:25</td>
                        <td>275000</td>
                    </tr>
                    <tr>
                        <th scope="row">2</th>
                        <th>غیبت</th>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <th scope="row">3</th>
                        <th>مرخصی</th>
                        <td>07:00:00</td>
                        <td>07:00:00</td>
                        <td>675000</td>
                    </tr>
                    <tr>
                        <th scope="row">4</th>
                        <td>99/12/28</td>
                        <th>اضافه کاری</th>
                        <td>02:00:00</td>
                        <td>02:00:00</td>
                        <td>175000</td>
                    </tr>
                    <tr class="sign_row">
                        <th colspan="3"><input type="text" value="امضا هیئت مدیره: احمد صفار" style="text-align:center; border:none;font-weight: bold; width:300px"/></th>
                        <th colspan="3"> <input type="text" value="امضا مدیر عامل: حسین ترابی" style="text-align:center; border:none;font-weight: bold; width:300px"/></th>
                    </tr>
                    <p class="text-center" style="font-size:16px">
                        آدرس: استان اصفهان، شهرستان خوروبیابانک، بخش مرکزی، شهر فرخی، محله مصلا، کوچه لاله، خیابان امام خمینی (ره)، پلاک
                        {{\App\Http\Controllers\FunctionsController::e2p(153)}}، طبقه همکف
                        <br>
                        کد پستی {{\App\Http\Controllers\FunctionsController::e2p("8364116113
                    ، تلفن: 2800-4637-031
                    ")}}
                    </p>
                    </tbody>
                </table>
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

            Array.from(document.querySelectorAll('input')).forEach(b => {
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
