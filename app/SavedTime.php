<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class SavedTime extends Model
{
    protected $fillable = [
        'time', 'start', 'pause', 'deleted', 'disabled'
    ];

    public $timestamps = false;

    protected $table = 'tbl_saved_time';
}
