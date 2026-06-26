<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Calendar extends Model
{
    protected $fillable = [
        'year', 'month', 'day', 'dmy', 'status', 'm_month', 'fa_date', 'fa_month', 'deleted', 'disabled', 'package'
    ];

    public $timestamps = false;

    protected $table = 'tbl_calendar';
}
