<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class CustomerContact extends Model
{
    protected $fillable = [
        'contact_id', 'national_code', 'customer_id'
    ];

    public $timestamps = false;

    protected $table = 'tbl_customer_contact';
}
