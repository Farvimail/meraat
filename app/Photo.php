<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Photo extends Model
{
    protected $fillable = [
        'name', 'path', 'customer_id', 'uploaded_at'
    ];

    public $timestamps = false;

    protected $table = 'tbl_users_profile';
}
