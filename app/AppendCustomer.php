<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class AppendCustomer extends Model
{
    protected $fillable = [
        'manager_id', 'national_code', 'customer_id', 'manager_email'
    ];

    public $timestamps = false;

    protected $table = 'tbl_append_customer';
}
