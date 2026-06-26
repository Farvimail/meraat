<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class CustomerBank extends Model
{
    protected $fillable =[
        'bank_id', 'national_code', 'customer_id'
    ];

    public $timestamps = false;

    protected $table = 'tbl_customer_bank';
}
