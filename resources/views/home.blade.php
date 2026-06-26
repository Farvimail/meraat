@extends('layouts.auth')
<?php
var_dump(auth()->id());
?>
@section('content')
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header">Dashboard</div>

                    <div class="card-body">
                        Hi Dear Customer
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
