<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class AppendRoles extends Model
{
    protected $fillable = [
        'manager_id', 'manager_email', 'role_id', 'package'
    ];

    public $timestamps = false;

    protected $table = 'tbl_append_roles';
}
