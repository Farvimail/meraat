<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Timer extends Model
{
    protected $fillable = [
        'calendar_id', 'saved_time_id', 'national_code', 'customer_id'
    ];

    public $timestamps = false;

    protected $table = 'tbl_timer';
}
