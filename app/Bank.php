<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Bank extends Model
{
    protected $fillable = [
        'sheba_num', 'account_num', 'card_num'
    ];

    public $timestamps = false;

    protected $table = 'tbl_bank_info';
}
