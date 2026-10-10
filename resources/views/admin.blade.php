@extends('layouts.panel')

@php
    $panelNav = array(
        array('label' => 'داشبورد',        'href' => '#dashboard', 'icon' => 'grid'),
        array('label' => 'پشتیبان‌گیری',  'href' => '#backup',    'icon' => 'database'),
    );
@endphp

@section('title')
    مدیریت
@endsection

@section('page_title')
    داشبورد مدیر ارشد
@endsection

@section('page_subtitle')
    دسترسی سریع به وضعیت سامانه و پشتیبان‌گیری
@endsection

@section('content')
    <div class="container" id="dashboard">
        <div class="row justify-content-center">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header">خوش آمدید</div>

                    <div class="card-body">
                        <p class="mb-2">
                            {{ auth('admin')->user()->name ?? 'مدیر' }} عزیز، خوش آمدید.
                        </p>
                        <p class="text-muted mb-0">
                            از منوی سمت راست می‌توانید بین بخش‌های میزکار جابه‌جا شوید. وضعیت و
                            فایل‌های پشتیبان در بخش «پشتیبان‌گیری» پایین همین صفحه فهرست شده است.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

@section('backup')
    @include('partials.backup')
@endsection

@section('toasts')
    @include('partials.toasts')
@endsection
