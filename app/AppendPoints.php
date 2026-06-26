<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class AppendPoints extends Model
{
    protected $fillable = [
        'manager_id', 'manager_email', 'point_id', 'package'
    ];

    public $timestamps = false;

    protected $table = 'tbl_append_points';
}
