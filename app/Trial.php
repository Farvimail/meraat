<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Trial extends Model
{
    protected $fillable = [
        'bank_info', 'contact_info', 'roles_info', 'points_info', 'calendar_info', 'saved_time_info'
    ];

    protected $table = 'tbl_trail';
}
