<?php

namespace App\Console\Commands;

use App\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * آزاد کردن گوشیِ بسته‌شده به یک کارمند.
 *
 * چرا لازم است: قید «یک کارمند، یک گوشی» باعث می‌شود اگر کارمند برنامه را پاک
 * کند و دوباره نصب کند (شناسهٔ نصب عوض می‌شود)، یا گوشی‌اش را عوض کند، ورود
 * بعدی با خطای `device_already_bound` رد شود. آزادسازی این قید را باز می‌کند.
 *
 * پنل مدیریت هنوز بخش «دستگاه‌های موبایل» ندارد، پس تا آن‌موقع این دستور
 * داخل سرور اجرا می‌شود:
 *
 *   docker compose -f docker-compose.prod.yml exec app \
 *       php artisan mobile:release --email=mostafa@example.com
 *
 *   php artisan mobile:release --list
 *   php artisan mobile:release --customer=18
 *   php artisan mobile:release --device=<device-id>
 */
class ReleaseMobileDevice extends Command
{
    protected $signature = 'mobile:release
        {--customer= : شناسهٔ کاربر در جدول users}
        {--email= : ایمیل حساب کارمند}
        {--device= : شناسهٔ دستگاه (برای آزاد کردن فقط یک گوشی)}
        {--list : فقط لیست دستگاه‌های بسته‌شده را نشان بده}';

    protected $description = 'آزاد کردن گوشی بسته‌شده به کارمند در اپ موبایل حضور';

    public function handle()
    {
        if ($this->option('list') || (!$this->option('customer') && !$this->option('email'))) {
            return $this->listDevices();
        }

        $customerId = $this->option('customer');

        if (!$customerId) {
            $user = User::query()->where('email', $this->option('email'))->first();

            if (empty($user)) {
                $this->error('کارمندی با این ایمیل پیدا نشد.');

                return 1;
            }

            $customerId = $user->id;
        }

        $query = DB::table('tbl_mobile_device')
            ->where('customer_id', $customerId)
            ->whereNull('released_at');

        if ($this->option('device')) {
            $query->where('device_id', $this->option('device'));
        }

        $devices = $query->get();

        if ($devices->isEmpty()) {
            $this->info('گوشیِ فعالی برای این کارمند ثبت نشده است.');

            return 0;
        }

        $now = date('Y-m-d H:i:s');

        foreach ($devices as $device) {
            DB::table('tbl_mobile_device')
                ->where('id', $device->id)
                ->update(['released_at' => $now]);

            // توکن‌های همان گوشی هم باطل می‌شوند؛ وگرنه نشستِ بازِ گوشیِ قبلی
            // تا وقتی خودش logout نکند معتبر می‌ماند.
            DB::table('tbl_mobile_token')
                ->where('device_id', $device->device_id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => $now]);

            $this->info(sprintf('گوشی %s آزاد شد.', $device->device_id));
        }

        $this->info('تمام. کارمند می‌تواند از گوشی جدید وارد شود.');

        return 0;
    }

    private function listDevices()
    {
        $rows = DB::table('tbl_mobile_device')
            ->leftJoin('users', 'users.id', '=', 'tbl_mobile_device.customer_id')
            ->orderBy('tbl_mobile_device.id', 'desc')
            ->select(
                'tbl_mobile_device.id',
                'tbl_mobile_device.customer_id',
                'users.name',
                'users.email',
                'tbl_mobile_device.device_id',
                'tbl_mobile_device.device_name',
                'tbl_mobile_device.platform',
                'tbl_mobile_device.bound_at',
                'tbl_mobile_device.last_seen_at',
                'tbl_mobile_device.last_ip',
                'tbl_mobile_device.released_at'
            )
            ->get();

        if ($rows->isEmpty()) {
            $this->info('هنوز هیچ گوشی‌ای به اپ بسته نشده است.');

            return 0;
        }

        $table = [];

        foreach ($rows as $row) {
            $table[] = [
                $row->id,
                $row->name ?? '—',
                $row->email ?? '—',
                mb_substr($row->device_id, 0, 12).'…',
                $row->device_name,
                $row->last_ip,
                $row->released_at === null ? 'فعال' : 'آزادشده',
                $row->last_seen_at,
            ];
        }

        $this->table(
            ['id', 'کارمند', 'ایمیل', 'دستگاه', 'برچسب', 'آخرین آی‌پی', 'وضعیت', 'آخرین بازدید'],
            $table
        );

        return 0;
    }
}
