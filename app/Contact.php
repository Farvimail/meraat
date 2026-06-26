<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    protected $fillable = [
        'phone_num', 'mobile_num', 'address'
    ];

    public $timestamps = false;

    protected $table = 'tbl_contact_info';
}
