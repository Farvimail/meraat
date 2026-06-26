<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class AppendRewards extends Model
{
    protected $fillable = [
        'id',
        'manager_id',
        'manager_email',
        'reward_value',
        'customer_id',
        'package'
    ];

    public $timestamps = false;

    protected $table = 'tbl_append_rewards';
}
