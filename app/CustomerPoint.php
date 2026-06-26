<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class CustomerPoint extends Model
{
    protected $fillable = [
        'point_id', 'national_code', 'customer_id'
    ];

    protected $table = 'tbl_customer_point';
}
