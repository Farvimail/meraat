<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Roles extends Model
{
    protected $fillable = [
        'name', 'min_time', 'max_time',
        'normal_score', 'high_score',
        'desc', 'deleted', 'disabled'
    ];

    public  $timestamps = false;

    protected $table = 'tbl_roles';
}
