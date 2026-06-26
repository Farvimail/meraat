<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Points extends Model
{
    protected $fillable = [
          'name', 'value', 'deleted', 'disabled'
    ];

    public $timestamps = false;

    protected $table = 'tbl_points';
}
