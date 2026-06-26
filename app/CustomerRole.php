<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class CustomerRole extends Model
{
    protected $fillable = [
        'role_id', 'national_code', 'customer_id'
    ];

    public $timestamps = false;
    protected $table = 'tbl_customer_roles';
}
