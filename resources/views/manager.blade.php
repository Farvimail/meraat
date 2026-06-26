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
use App\Http\Controllers\AppendRewardsController;
use App\Http\Controllers\FunctionsController;
use Illuminate\Support\Facades\Auth;

//var_dump(auth()->guard('manager')->id());
//var_dump(PointsController::managerData(auth()->guard('manager')->id()))
?>

@extends('layouts.auth')

@section('title')
    مدیریت
@endsection

@section('rewards')
    @if( AppendRewardsController::rewardTime())
        <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card gold">
                    <div class="card-header" id="rewards">
                        عیدی و پاداش
                        <small><a style="color:black" href="reward/table/month/{{\App\Http\Controllers\CalendarController::findPackage()}}" id="reward_table">چاپ رسید</a></small>
                    </div>

                    <div class="card-body">
                        <div class="row">
                            <!--- create mode ----->
                            <div class="col-md-4">
                                <form action="{{ route('create.rewards') }}" method="get">
                                    @csrf
                                    <input type="hidden" name="package" value="{{\App\Http\Controllers\FunctionsController::package()}}"/>
                                    <div class="card text-white bg-goldenrod">
                                        <div class="card-body">
                                            <div class="input-group mb-3">
                                                <select name="customer_id" class="form-select form-control" id="inputGroupSelect0}">
                                                    @foreach(AppendRewardsController::showManagerCustomer() as $customer)
                                                        <option value="{{$customer->id}}">{{$customer->name}}</option>
                                                    @endforeach
                                                </select>
                                                <label class="input-group-text form-control" for="inputGroupSelect02">انتخاب کارمند</label>
                                            </div>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="number" class="form-control" name="reward_value" placeholder="اینجا بنویسید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">ارزش پاداش</span>
                                                </div>
                                            </h6>
                                            <input type="submit" style="background:transparent; border:none" class=" text-white" value="ایجاد" />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <!--- end create mode ---->
                            @foreach ( AppendRewardsController::selectedManagerCustomer() as $item )
{{--                                @dd(AppendRewardsController::selectedManagerCustomer(\App\Http\Controllers\FunctionsController::package(), $item->customer_id))--}}
                                <div class="col-md-4">
                                    <form action="{{ route('update.rewards') }}" method="post">
                                        @csrf
                                        <input type="hidden" name="id" value="{{$item->id}}"/>
                                        <input type="hidden" name="package" value="{{\App\Http\Controllers\FunctionsController::package()}}"/>
                                        <div class="card">
                                            <div class="card-body">
                                                <div class="input-group mb-3">
                                                    <select name="customer_id" class="form-select form-control" id="inputGroupSelect{{$item->customer_id}}">

                                                        @if(!empty(AppendRewardsController::selectedManagerCustomer(\App\Http\Controllers\FunctionsController::package(), $item->customer_id)) &&
                                                               AppendRewardsController::selectedManagerCustomer(\App\Http\Controllers\FunctionsController::package(), $item->customer_id)->count() )
                                                            <option selected>--- {{AppendRewardsController::selectedManagerCustomer(\App\Http\Controllers\FunctionsController::package(), $item->customer_id)[0]->name}}</option>
                                                        @else
                                                            <option selected>انتخاب..</option>
                                                        @endif
                                                        @foreach(AppendRewardsController::showManagerCustomer() as $role)
                                                            <option value="{{$role->id}}">{{$role->name}}</option>
                                                        @endforeach
                                                    </select>
                                                    <label class="input-group-text form-control" for="inputGroupSelect02">تغییر کارمند</label>
                                                </div>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="number" class="form-control" name="reward_value" placeholder="اینجا بنویسید" aria-label="point" value="{{$item->reward_value}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">ارزش پاداش</span>
                                                    </div>
                                                </h6>
                                                <input type="submit" style="background:transparent; border:none" class="" value="ذخیره" />
                                                <a href="rewards/delete/id/{{$item->id}}">حذف</a>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
    @endif
@endsection

@section('points')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="points">امتیازها</div>

                    <div class="card-body">
                        <div class="row">
                            <!--- create mode ----->
                            <div class="col-md-4">
                                <form action="{{ route('create.points') }}" method="get">
                                    @csrf
                                    <input type="hidden" name="package" value="{{\App\Http\Controllers\FunctionsController::package()}}"/>
                                    <div class="card text-white bg-success">
                                        <div class="card-body">
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="text" class="form-control" name="name" placeholder="اینجا بنویسید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">نام امتیاز</span>
                                                </div>
                                            </h5>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="number" class="form-control" name="value" placeholder="اینجا بنویسید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">ارزش امتیاز</span>
                                                </div>
                                            </h6>
                                            <input type="submit" style="background:transparent; border:none" class=" text-white" value="ایجاد" />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <!--- end create mode ---->
                            @foreach ( AppendPointsController::showManagerPoints() as $item )
                                <div class="col-md-4">
                                    <form action="{{ route('update.points') }}" method="post">
                                        @csrf
                                        <input type="hidden" name="point_id" value="{{$item->id}}"/>
                                        <div class="card">
                                            <div class="card-body">
                                                <h5 class="card-title">
                                                    <div class="input-group mb-3">
                                                        <input type="text" class="form-control" name="name" placeholder="اینجا بنویسید" aria-label="point" value="{{$item->name}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">نام امتیاز</span>
                                                    </div>
                                                </h5>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="number" class="form-control" name="value" placeholder="اینجا بنویسید" aria-label="point" value="{{$item->value}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">ارزش امتیاز</span>
                                                    </div>
                                                </h6>
                                                <input type="submit" style="background:transparent; border:none" class="" value="ذخیره" />
                                                <a href="points/delete/id/{{$item->id}}">حذف</a>
                                            </div>
                                        </div>

                                    </form>
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
                            <!--- Create Role ---->
                            <div class="col-md-4">
                                <form action="{{ route('create.roles') }}" method="get">
                                    @csrf
                                    <input type="hidden" name="package" value="{{\App\Http\Controllers\FunctionsController::package()}}"/>
                                    <div class="card text-white bg-success">
                                        <div class="card-body">
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="text" class="form-control" name="name" placeholder="اینجا بنویسید" aria-label="role" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">نام نقش</span>
                                                </div>
                                            </h5>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="time" class="form-control" name="min_time" placeholder="اینجا وارد کنید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">حداقل ساعت کاری</span>
                                                </div>
                                            </h6>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="time" class="form-control" name="max_time" placeholder="اینجا وارد کنید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">حدااکثر ساعت کاری</span>
                                                </div>
                                            </h6>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="number" class="form-control" name="normal_score" placeholder="اینجا وارد کنید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">هزینه ساعتی عادی</span>
                                                </div>
                                            </h6>
                                            <h6 class="card-subtitle mb-2 text-muted">
                                                <div class="input-group mb-3">
                                                    <input type="number" class="form-control" name="high_score" placeholder="اینجا وارد کنید" aria-label="point" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">هزینه ساعتی خاص</span>
                                                </div>
                                            </h6>
                                            <div class="input-group">
                                                <textarea class="form-control" name="desc" aria-label="درباره نقش" placeholder="اینجا بنویسید.."></textarea>
                                                <span class="input-group-text text-truncate d-inline-block">درباره نقش</span>
                                            </div>
                                            <br>
                                            <input type="submit" style="background:transparent; border:none" class=" text-white" value="ایجاد" />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <!--- end Create Role ---->
                            @foreach ( AppendRolesController::showManagerRoles() as $item)
                                <div class="col-md-4">
                                    <form action="{{route('update.roles')}}" method="post">
                                        @csrf
                                        <input type="hidden" name="role_id" value="{{$item->id}}"/>
                                        <div class="card">
                                            <div class="card-body">
                                                <h5 class="card-title">
                                                    <div class="input-group mb-3">
                                                        <input type="text" class="form-control" name="name" placeholder="اینجا بنویسید" aria-label="role" value="{{$item->name}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">نام نقش</span>
                                                    </div>
                                                </h5>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="time" class="form-control" name="min_time" placeholder="اینجا وارد کنید" aria-label="point" value="{{$item->min_time}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">حداقل ساعت کاری</span>
                                                    </div>
                                                </h6>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="time" class="form-control" name="max_time" placeholder="اینجا وارد کنید" aria-label="point" value="{{$item->max_time}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">حداکثر ساعت کاری</span>
                                                    </div>
                                                </h6>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="number" class="form-control" name="normal_score" placeholder="اینجا وارد کنید" aria-label="point" value="{{$item->normal_score}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">هزینه ساعتی عادی</span>
                                                    </div>
                                                </h6>
                                                <h6 class="card-subtitle mb-2 text-muted">
                                                    <div class="input-group mb-3">
                                                        <input type="number" class="form-control" name="high_score" placeholder="اینجا وارد کنید" aria-label="point" value="{{$item->high_score}}" aria-describedby="basic-addon1">
                                                        <span class="input-group-text form-control text-truncate d-inline-block" id="basic-addon1">هزینه ساعتی خاص</span>
                                                    </div>
                                                </h6>
                                                <div class="input-group">
                                                    <textarea class="form-control" name="desc" aria-label="About role" placeholder="اینجا بنویسید..">{{$item->desc}}</textarea>
                                                    <span class="input-group-text text-truncate d-inline-block">درباره نقش</span>
                                                </div>
                                                <br>
                                                <input type="submit" style="background:transparent; border:none" class=""
                                                       value="ذخیره" />
                                                <a href="roles/delete/id/{{$item->id}}">حذف</a>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            @endforeach
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
@endsection

@section('customers')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header">کارمندها
                        <small><a style="color:black" href="salary/table/month/{{\App\Http\Controllers\CalendarController::findPackage()}}" id="customers">حقوق کارکنان</a></small>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <!----- create Customer ---->
                            <div class="col-md-4">
                                <form method="POST" action="{{ route('create.customer') }}">
                                    @csrf
                                    <div class="card text-white bg-success">
                                        <div class="card-header" style="background: transparent">
                                            <img src="{{asset('images/users/PRP.jpg')}}" style="opacity:0.7" class="card-img-top" alt="...">
                                            <div class="input-group upload-input">
                                                <button class="btn btn-outline-secondary disabled" disabled type="button" id="inputGroupFileAddon04">حذف تصویر</button>
                                                <input type="file" disabled class="form-control" id="inputGroupFile04" aria-describedby="inputGroupFileAddon04" aria-label="بارگذاری تصویر">
                                            </div>
                                        </div>
                                        <div class="card-body">
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="text" class="form-control" placeholder="اینجا بنویسید" name="name" aria-label="Username" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control" id="basic-addon1">نام ونام خانوادگی</span>
                                                </div>
                                                @if ($errors->has('name'))
                                                    <span class="invalid-feedback" role="alert">
                                                        <strong>{{ $errors->first('name') }}</strong>
                                                    </span>
                                                @endif
                                            </h5>
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="number" class="form-control" placeholder="اینجا وارد کنید" name="national_code" aria-label="National code" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control" id="basic-addon1">کد ملی</span>
                                                </div>
                                                @if ($errors->has('national_code'))
                                                    <span class="invalid-feedback" role="alert">
                                                        <strong>{{ $errors->first('national_code') }}</strong>
                                                    </span>
                                                @endif
                                            </h5>
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="email" class="form-control" placeholder="پست الکترونیک" name="email" aria-label="Email" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control" id="basic-addon1">ایمیل</span>
                                                </div>
                                                @if ($errors->has('email'))
                                                    <span class="invalid-feedback" role="alert">
                                                        <strong>{{ $errors->first('email') }}</strong>
                                                    </span>
                                                @endif
                                            </h5>
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="password" class="form-control" placeholder="اینجا وارد کنید" name="password" aria-label="Password" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control" id="basic-addon1">رمز عبور</span>
                                                </div>
                                                @if ($errors->has('password'))
                                                    <span class="invalid-feedback" role="alert">
                                                        <strong>{{ $errors->first('password') }}</strong>
                                                    </span>
                                                @endif
                                            </h5>
                                            <h5 class="card-title">
                                                <div class="input-group mb-3">
                                                    <input type="password" class="form-control" placeholder="تأیید رمز" name="password_confirmation" aria-label="password confirmation" aria-describedby="basic-addon1">
                                                    <span class="input-group-text form-control" id="basic-addon1">تکرار رمز</span>
                                                </div>
                                            </h5>
                                            <br><br>
                                            <br><br>
                                            <br>
                                            <input type="submit" style="background:transparent; border:none" class=" text-white" value="ایجاد" />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <!--- end create customer --->
                            @foreach ( AppendCustomerController::showManagerCustomers() as $item)
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header" style="background: transparent">
                                            @if(\App\Http\Controllers\PhotoController::show($item->customer_id)->exists())
                                                <img src="images/users/{{\App\Http\Controllers\PhotoController::show($item->customer_id)->orderBy('tbl_users_profile.id','desc')->first()->name}}" class="card-img-top" alt="...">
                                            @else
                                                <img src="{{asset('images/users/PRP.jpg')}}" class="card-img-top" alt="...">
                                            @endif
                                            <div class="input-group upload-input">
                                                <button class="btn btn-outline-danger" type="button" id="inputGroupFileAddon{{$item->customer_id}}">حذف تصویر</button>
                                                <input type="file" class="form-control" id="inputGroupFile{{$item->customer_id}}" aria-describedby="inputGroupFileAddon{{$item->customer_id}}" aria-label="بارگذاری تصویر">
                                            </div>
                                        </div>
                                        <div class="card-body">
                                            <form action="{{ route('update.customer') }}" method="post">
                                                @csrf
                                                <input type="hidden" name="customer_id" value="{{$item->customer_id}}"/>
                                                <h5 class="card-title">
                                                    <div class="input-group mb-3">
                                                        <input type="text" class="form-control" placeholder="اینجا بنویسید" name="name" aria-label="Username" aria-describedby="basic-addon1"
                                                               value="{{AppendCustomerController::showCustomer($item->customer_id)->name}}">
                                                        <span class="input-group-text form-control" id="basic-addon1">نام و نام خانوادگی</span>
                                                    </div>
                                                </h5>
                                                <h5 class="card-title">
                                                    <div class="input-group mb-3">
                                                        <input type="text" class="form-control" placeholder="اینجا وارد کنید" name="national_code" aria-label="National Code" aria-describedby="basic-addon1"
                                                               value="{{AppendCustomerController::showCustomer($item->customer_id)->national_code}}">
                                                        <span class="input-group-text form-control" id="basic-addon1">کد ملی</span>
                                                    </div>
                                                </h5>
                                                <div class="input-group mb-3">
                                                    <select name="role_id" class="form-select form-control" id="inputGroupSelect{{$item->customer_id}}">
                                                        @if(!empty(AppendRolesController::selectedManagerRole(\App\Http\Controllers\FunctionsController::package(), $item->customer_id)))
                                                            <option selected>--- {{AppendRolesController::selectedManagerRole(\App\Http\Controllers\FunctionsController::package(), $item->customer_id)->name}}</option>
                                                        @else
                                                            <option selected>انتخاب..</option>
                                                        @endif
                                                        @foreach(AppendRolesController::showManagerRoles() as $role)
                                                            <option value="{{$role->id}}">{{$role->name}}</option>
                                                        @endforeach
                                                    </select>
                                                    <label class="input-group-text form-control" for="inputGroupSelect02">نقش</label>
                                                </div>
                                                <input type="submit" style="background:transparent; border:none" class="" value="بروزرسانی" />
                                                <a href="customers/delete/id/{{$item->customer_id}}" class="">حذف</a>
                                                <a href="salary/activity/c/{{$item->customer_id}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}" class="">فعالیت</a>
                                            </form>
                                        </div>
                                        <ul class="list-group list-group-flush">
                                            <nav>
                                                <div class="nav nav-tabs" id="nav-tab" role="tablist">
                                                    <button class="nav-link" id="nav-points-tab-{{$item->customer_id}}" data-bs-toggle="tab" data-bs-target="#nav-points-{{$item->customer_id}}" type="button" role="tab" aria-controls="nav-points" aria-selected="true">امتیاز</button>
                                                    <button class="nav-link" id="nav-bank-tab-{{$item->customer_id}}" data-bs-toggle="tab" data-bs-target="#nav-bank-{{$item->customer_id}}" type="button" role="tab" aria-controls="nav-bank" aria-selected="false">بانک</button>
                                                    <button class="nav-link" id="nav-contact-tab-{{$item->customer_id}}" data-bs-toggle="tab" data-bs-target="#nav-contact-{{$item->customer_id}}" type="button" role="tab" aria-controls="nav-contact" aria-selected="false">تماس</button>
                                                    <button class="nav-link active" id="nav-presents-tab-{{$item->customer_id}}" data-bs-toggle="tab" data-bs-target="#nav-presents-{{$item->customer_id}}" type="button" role="tab" aria-controls="nav-presents" aria-selected="false">حضور</button>
                                                </div>
                                            </nav>
                                            <div class="tab-content" id="nav-tabContent">
                                                <div class="tab-pane fade" id="nav-points-{{$item->customer_id}}" role="tabpanel" aria-labelledby="nav-points-tab-{{$item->customer_id}}">
                                                    <form action="{{ route('save.customer.point') }}" method="post">
                                                        @csrf
                                                        <input type="hidden" name="package" value="{{\App\Http\Controllers\FunctionsController::package()}}"/>
                                                        <input type="hidden" name="customer_id" value="{{$item->customer_id}}"/>
                                                        <input type="hidden" name="national_code" value="{{$item->national_code}}"/>
                                                        <ul class="list-group">
                                                            @foreach(AppendPointsController::showManagerPoints() as $point)
                                                                <li class="list-group-item">
                                                                    <div class="form-check form-switch">
                                                                        <input class="form-check-input" type="checkbox" name="point_id[]" id="{{$item->customer_id.$point->id}}" value="{{$point->id}}" {{!empty(CustomerPointController::selectedCustomerPoints($item->customer_id, $point->id)) ? 'checked' : null}}>
                                                                        <label class="form-check-label" for="{{$item->customer_id.$point->id}}">{{$point->name}}</label>
                                                                    </div>
                                                                </li>
                                                            @endforeach
                                                        </ul>
                                                        <input type="submit" style="background:transparent; border:none" class="" value="ذخیره" />
                                                    </form>
                                                </div>
                                                <div class="tab-pane fade" id="nav-bank-{{$item->customer_id}}" role="tabpanel" aria-labelledby="nav-bank-tab-{{$item->customer_id}}">
                                                    <form action="{{ route('create.bank') }}" method="post">
                                                        @csrf
                                                        <input type="hidden" name="customer_id" value="{{$item->customer_id}}"/>
                                                        @if(!empty(CustomerBankController::showCustomerBankInfo($item->customer_id)))
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="card_num" placeholder="اینجا وارد کنید" aria-label="شماره کارت" value="{{CustomerBankController::showCustomerBankInfo($item->customer_id)->card_num}}" aria-describedby="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->card_num}}">
                                                                <span class="input-group-text" id="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->card_num}}">شماره کارت</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="sheba_num" placeholder="اینجا وارد کنید" aria-label="شبا" value="{{CustomerBankController::showCustomerBankInfo($item->customer_id)->sheba_num}}" aria-describedby="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->sheba_num}}">
                                                                <span class="input-group-text" id="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->sheba_num}}">شبا</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="account_num" placeholder="اینجا وارد کنید" aria-label="شماره حساب" value="{{CustomerBankController::showCustomerBankInfo($item->customer_id)->account_num}}" aria-describedby="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->account_num}}">
                                                                <span class="input-group-text" id="basic-{{CustomerBankController::showCustomerBankInfo($item->customer_id)->account_num}}">شماره حساب</span>
                                                            </div>
                                                        @else
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="card_num" placeholder="شماره کارت" aria-label="Card number" value="" aria-describedby="basic-card-num-{{$item->customer_id}}">
                                                                <span class="input-group-text" id="basic-card-num-{{$item->customer_id}}">شماره کارت</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="sheba_num" placeholder="شبا" aria-label="Sheba number" value="" aria-describedby="basic-card-num-{{$item->customer_id}}">
                                                                <span class="input-group-text" id="basic-sheba-num-{{$item->customer_id}}">شبا</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="account_num" placeholder="شماره حساب" aria-label="Account number" value="" aria-describedby="basic-card-num-{{$item->customer_id}}">
                                                                <span class="input-group-text" id="basic-account-num-{{$item->customer_id}}">شماره حساب</span>
                                                            </div>
                                                        @endif
                                                        <input type="submit" style="background:transparent; border:none" class="" value="ذخیره" />
                                                    </form>
                                                </div>
                                                <div class="tab-pane fade" id="nav-contact-{{$item->customer_id}}" role="tabpanel" aria-labelledby="nav-contact-tab-{{$item->customer_id}}">
                                                    <form action="{{ route('create.contact') }}" method="post">
                                                        @csrf
                                                        <input type="hidden" name="customer_id" value="{{$item->customer_id}}"/>
                                                        @if(!empty(CustomerContactController::showCustomerBankInfo($item->customer_id)))
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="mobile_num" placeholder="اینجا بنویسید" value="{{CustomerContactController::showCustomerBankInfo($item->customer_id)->mobile_num}}" aria-label="Username" aria-describedby="basic-addon1">
                                                                <span class="input-group-text" id="basic-addon1">شماره موبایل</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="phone_num" placeholder="اینجا بنویسید" value="{{CustomerContactController::showCustomerBankInfo($item->customer_id)->phone_num}}" aria-label="Username" aria-describedby="basic-addon1">
                                                                <span class="input-group-text" id="basic-addon1">شماره ثابت</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <textarea class="form-control" name="address" aria-label="Address" placeholder="اینجا بنویسید..">{{CustomerContactController::showCustomerBankInfo($item->customer_id)->address}}</textarea>
                                                                <span class="input-group-text">آدرس</span>
                                                            </div>
                                                        @else
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="mobile_num" placeholder="اینجا وارد کنید" aria-label="Username" aria-describedby="basic-addon1">
                                                                <span class="input-group-text" id="basic-addon1">شماره موبایل</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <input type="text" class="form-control" name="phone_num" placeholder="اینجا وارد کنید" aria-label="Username" aria-describedby="basic-addon1">
                                                                <span class="input-group-text" id="basic-addon1">شماره ثابت</span>
                                                            </div>
                                                            <div class="input-group mb-3">
                                                                <textarea class="form-control" name="address" aria-label="Address" placeholder="اینجا بنویسید"></textarea>
                                                                <span class="input-group-text">آدرس</span>
                                                            </div>
                                                        @endif
                                                        <input type="submit" style="background:transparent; border:none" class="" value="ذخیره" />
                                                    </form>
                                                </div>
                                                <div class="tab-pane fade col-12 show active" id="nav-presents-{{$item->customer_id}}" role="tabpanel" aria-labelledby="nav-presents-tab-{{$item->customer_id}}">
                                                    <div class="inverse-timer cc_cursor">
                                                        <div class="digital-timer digital-timer-{{$item->customer_id}} cc_cursor">{{FunctionsController::e2p('00 : 00\' : 00" ')}}</div>
                                                        <progress id="timer-progress" value="100" max="100" style="display: none;"></progress>زمان سپری شده
                                                    </div>
                                                    <div class="btn-group" role="group" style="display: flex; vertical-align: middle; justify-content: center;" aria-label="Basic mixed styles example">
                                                        <button type="button" id="timer-pause-{{$item->customer_id}}" class="btn btn-danger col-md-5">توقف</button>
                                                        <button type="button" id="timer-start-{{$item->customer_id}}" class="btn btn-success col-md-5">شروع</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </ul>
                                    </div>
                                </div>
                                @if ( !empty(TimerController::check($item->customer_id)) )

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
                    <div class="card-header" id="calendars">تقویم‌ها</div>

                    <div class="card-body">
                        <div class="row">

                            @foreach ( AppendCustomerController::showManagerCustomers() as $item)

                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-header">
                                            <a href="calendar/year/{{CalendarController::detectSolarDate()}}/c/{{$item->customer_id}}">{{$item->name}}</a>
                                            <small><a href="edit/m/{{auth('manager')->id()}}/c/{{$item->customer_id}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}">اصلاح</a></small>
                                            <small> / </small>
                                            <small><a href="print/m/{{auth('manager')->id()}}/c/{{$item->customer_id}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}">چاپ</a></small>
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
                                                            } else
                                                                break;

                                                            if ( $elapced ):
                                                                $present = TimerController::savedTimes($item->customer_id, $calendar->id);
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

                                                            <div class="col {{$classes}} {{$calendar->status==2?'cln-holiday':($calendar->status==3?'cln-disabled':'')}}"><a href="single/edit/m/{{auth('manager')->id()}}/c/{{$item->customer_id}}/d/{{$calendar->dmy}}/month/{{\App\Http\Controllers\CalendarController::findPackage()}}">{{FunctionsController::e2p(explode("/",$calendar->fa_date)[0])}}</a></div>
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

@section('roles_history')



@endsection

@section('history')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header" id="history">آرشیو ماهیانه</div>
                    <ul class="nav nav-tabs" style="width:auto;" id="myTab" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="history-role-tab" data-bs-toggle="tab" data-bs-target="#history_role_tab" type="button" role="tab" aria-controls="roles history" aria-selected="true">نقش ها</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="history-point-tab" data-bs-toggle="tab" data-bs-target="#history_point_tab" type="button" role="tab" aria-controls="points history" aria-selected="false">امتیاز ها</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="history-salary-tab" data-bs-toggle="tab" data-bs-target="#history_salary_tab" type="button" role="tab" aria-controls="salary history" aria-selected="false">حقوق</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="reward-salary-tab" data-bs-toggle="tab" data-bs-target="#reward_salary_tab" type="button" role="tab" aria-controls="reward history" aria-selected="false">پاداش</button>
                        </li>
                    </ul>
                    <div class="tab-content" style=" height:auto; padding: 20px 0 20px 0;" id="myTabContent">
                        <div class="tab-pane fade show active" id="history_role_tab" role="tabpanel" aria-labelledby="history-role-tab">
                            <div class="container">
                                <div class="row justify-content-center">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <!--- Show monthly roles ---->
                                            @foreach(\App\Http\Controllers\SalaryController::monthHistory() as $index=>$history)
                                                <div class="col-md-3">
                                                    <div class="card text-center">
                                                        <div class="card-header text-center">
                                                            <h5 class="card-title">{{$history->fa_month}} {{\App\Http\Controllers\FunctionsController::e2p(substr($history->fa_date,-4))}}</h5>
                                                            <?php $monthName = \App\Http\Controllers\SalaryController::monthNames($history->package);?>
                                                            <h6 class="card-subtitle mb-2 text-muted">{{(isset($monthName[1]->m_month)?$monthName[1]->m_month:null)." - ".(isset($monthName[0]->m_month)?$monthName[0]->m_month:null)}}</h6>
                                                        </div>
                                                        <div class="card-body">
                                                            <p class="card-text"> لیست نقش های هر ماه و ساعات کاری عادی و خاص </p>
                                                        </div>
                                                        <div class="card-footer text-center">
                                                            <a href="history/roles/month/{{$history->package}}" class="">لیست نقش ها</a>
                                                        </div>
                                                    </div>
                                                </div>
                                        @endforeach
                                        <!--- end Show monthly roles ---->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tab-pane fade" id="history_point_tab" role="tabpanel" aria-labelledby="profile-tab">
                            <div class="container">
                                <div class="row justify-content-center">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <!--- Show monthly points ---->
                                            @foreach(\App\Http\Controllers\SalaryController::monthHistory() as $index=>$history)
                                                <div class="col-md-3">
                                                    <div class="card text-center">
                                                        <div class="card-header text-center">
                                                            <h5 class="card-title">{{$history->fa_month}} {{\App\Http\Controllers\FunctionsController::e2p(substr($history->fa_date,-4))}}</h5>
                                                            <?php $monthName = \App\Http\Controllers\SalaryController::monthNames($history->package);?>
                                                            <h6 class="card-subtitle mb-2 text-muted">{{(isset($monthName[1]->m_month)?$monthName[1]->m_month:null)." - ".(isset($monthName[0]->m_month)?$monthName[0]->m_month:null)}}</h6>
                                                        </div>
                                                        <div class="card-body">
                                                            <p class="card-text"> لیست امتیازات ماه و ارزش هر امتیاز </p>
                                                        </div>
                                                        <div class="card-footer text-center">
                                                            <a href="history/points/month/{{$history->package}}" class="">جدول امتیازات</a>
                                                        </div>
                                                    </div>
                                                </div>
                                        @endforeach
                                        <!--- end Show monthly points ---->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tab-pane fade" id="history_salary_tab" role="tabpanel" aria-labelledby="contact-tab">
                            <div class="container">
                                <div class="row justify-content-center">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <!--- Show passed months ---->
                                            @foreach(\App\Http\Controllers\SalaryController::monthHistory() as $index=>$history)
                                                <div class="col-md-3">
                                                    <div class="card text-center">
                                                        <div class="card-header text-center">
                                                            <h5 class="card-title">{{$history->fa_month}} {{\App\Http\Controllers\FunctionsController::e2p(substr($history->fa_date,-4))}}</h5>
                                                            <?php $monthName = \App\Http\Controllers\SalaryController::monthNames($history->package);?>
                                                            <h6 class="card-subtitle mb-2 text-muted">{{(isset($monthName[1]->m_month)?$monthName[1]->m_month:null)." - ".(isset($monthName[0]->m_month)?$monthName[0]->m_month:null)}}</h6>
                                                        </div>
                                                        <div class="card-body">
                                                            <p class="card-text"> لیست حقوق کارمندان و جدول فعالیت حقوق و مزایا </p>
                                                        </div>
                                                        <div class="card-footer text-center">
                                                            <a href="salary/table/month/{{$history->package}}" class="">حقوق کارکنان</a>
                                                        </div>
                                                    </div>
                                                </div>
                                        @endforeach
                                        <!--- end Show passed months ---->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="tab-pane fade" id="reward_salary_tab" role="tabpanel" aria-labelledby="contact-tab">
                            <div class="container">
                                <div class="row justify-content-center">
                                    <div class="col-md-12">
                                        <div class="row">
                                            <!--- Show passed months ---->
                                            @foreach(\App\Http\Controllers\SalaryController::rewardHistory() as $index=>$history)
                                                <div class="col-md-3">
                                                    <div class="card text-center">
                                                        <div class="card-header text-center bg-goldenrod">
                                                            <h5 class="card-title text-light">{{$history->fa_month}} {{\App\Http\Controllers\FunctionsController::e2p(substr($history->fa_date,-4))}}</h5>
                                                            <?php $monthName = \App\Http\Controllers\SalaryController::monthNames($history->package);?>
                                                            <h6 class="card-subtitle mb-2 text-light">{{(isset($monthName[1]->m_month)?$monthName[1]->m_month:null)." - ".(isset($monthName[0]->m_month)?$monthName[0]->m_month:null)}}</h6>
                                                        </div>
                                                        <div class="card-body">
                                                            <p class="card-text"> لیست پاداش و عیدی کارمندان  </p>
                                                        </div>
                                                        <div class="card-footer text-center bg-goldenrod">
                                                            <a href="reward/table/month/{{$history->package}}" class="text-light">جدول پاداش</a>
                                                        </div>
                                                    </div>
                                                </div>
                                        @endforeach
                                        <!--- end Show passed months ---->
                                        </div>
                                    </div>
                                </div>
                            </div>
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


