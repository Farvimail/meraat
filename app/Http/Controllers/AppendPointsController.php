<?php

namespace App\Http\Controllers;

use App\AppendPoints;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppendPointsController extends Controller
{
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public static function create($request, $point_id, $package)
    {
        AppendPoints::create([
            'manager_id' => $request->id,
            'manager_email' => $request->email,
            'point_id' => $point_id,
            'package' => $package
        ]);
    }

    public static function getManagerAuth()
    {
        $manager_auth = auth()->guard('manager');
        return $manager_auth->id();
    }

    /**
     * نام همهٔ امتیازهای ثبت‌شده، پس از یکسان‌سازی موارد تکراری.
     *
     * مواردی که فقط در پرانتز، فاصله، نیم‌فاصله، اعراب، املای حروف عربی یا
     * توضیح اضافه فرق دارند (و در اصل یکی‌اند) در یک گروه جمع می‌شوند و از هر
     * گروه فقط بهترین/رسمی‌ترین نام باقی می‌ماند تا فهرست پیشنهادی شلوغ نشود.
     *
     * @return \Illuminate\Support\Collection
     */
    public static function allPointNames()
    {
        $rows = DB::table('tbl_points')
            ->whereNotNull('name')
            ->where('name', '<>', '')
            ->pluck('name');

        // گروه‌بندی بر اساس شکل یکسان‌شدهٔ نام.
        $groups = [];
        foreach ($rows as $raw) {
            $name = self::cleanPointName((string) $raw);
            if ($name === '') {
                continue;
            }

            $key = self::pointNameKey($name);
            if ($key === '') {
                continue;
            }

            if (!isset($groups[$key])) {
                $groups[$key] = [];
            }
            $groups[$key][] = $name;
        }

        // ادغام کلیدهایی که یکی ادامهٔ دیگری است (مثل «حسن انجام کار» و
        // «حسن انجام کار با تایید ...»)؛ کوتاه‌ترین کلید نام پایه می‌شود.
        $keys = array_keys($groups);
        $merged = [];

        foreach ($keys as $key) {
            $base = $key;
            foreach ($keys as $candidate) {
                if (self::pointKeyIsBaseOf($candidate, $key)
                    && mb_strlen($candidate) < mb_strlen($base)) {
                    $base = $candidate;
                }
            }

            if (!isset($merged[$base])) {
                $merged[$base] = [];
            }
            $merged[$base] = array_merge($merged[$base], $groups[$key]);
        }

        $names = [];
        foreach ($merged as $baseKey => $variants) {
            $names[] = self::bestPointName($variants, $baseKey);
        }

        $names = array_values(array_unique($names));
        sort($names, SORT_STRING);

        return collect($names);
    }

    /**
     * نام را از فاصله‌ها و کاراکترهای صفرعرض اضافی اطراف پاک می‌کند.
     *
     * @param  string $name
     * @return string
     */
    private static function cleanPointName($name)
    {
        $name = preg_replace('/^[\s\x{200B}-\x{200F}\x{FEFF}]+|[\s\x{200B}-\x{200F}\x{FEFF}]+$/u', '', $name);
        $name = preg_replace('/\s+/u', ' ', $name);

        return trim($name);
    }

    /**
     * شکل یکسان‌شدهٔ نام برای تشخیص تکرارها.
     *
     * حروف عربی→فارسی، حذف اعراب و نیم‌فاصله، حذف محتوای پرانتز، حذف سال
     * پایانی و یکسان‌سازی فاصله‌ها.
     *
     * @param  string $name
     * @return string
     */
    private static function pointNameKey($name)
    {
        $key = FunctionsController::p2e($name);
        $key = str_replace(
            ['ي', 'ك', 'ة', 'ۀ', 'ؤ', 'إ', 'أ', 'ٱ', 'ى'],
            ['ی', 'ک', 'ه', 'ه', 'و', 'ا', 'ا', 'ا', 'ی'],
            $key
        );
        // نیم‌فاصله ممکن است درست باشد («نرم‌افزاری») یا غلط به‌جای فاصله
        // («هزینه‌بهداشتی»)؛ برای تشخیص تکرار، هر دو را یکی می‌کنیم.
        $key = preg_replace('/[\x{200C}\x{200D}]/u', ' ', $key);
        $key = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{200B}\x{200E}\x{200F}\x{FEFF}]/u', '', $key);
        $key = preg_replace('/\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】/u', ' ', $key);
        $key = preg_replace('/[0-9]{2,4}\s*$/u', '', $key);
        $key = preg_replace('/[.,،؛;:!؟?\-_\/\\\\|«»<>]+/u', ' ', $key);
        $key = preg_replace('/\s+/u', ' ', $key);

        return trim($key);
    }

    /**
     * آیا کلید $candidate نام پایهٔ $key است؟ (فقط برای نام‌های دوکلمه‌ای و
     * بیشتر تا یک واژهٔ عام بقیه را نبلعد.)
     *
     * @param  string $candidate
     * @param  string $key
     * @return bool
     */
    private static function pointKeyIsBaseOf($candidate, $key)
    {
        if ($candidate === '' || $candidate === $key) {
            return false;
        }
        if (count(preg_split('/\s+/u', $candidate)) < 2) {
            return false;
        }

        return mb_strpos($key, $candidate . ' ') === 0;
    }

    /**
     * از میان چند املای یک نام، بهترین را برمی‌گرداند.
     *
     * اولویت: هم‌شکل با نام پایه ← پرکاربردتر ← بدون غلط نگارشی (حروف عربی،
     * فاصلهٔ دوتایی، فاصلهٔ نبوده پیش از پرانتز، کاراکتر صفرعرض) ← کوتاه‌تر.
     *
     * @param  array  $variants
     * @param  string $baseKey
     * @return string
     */
    private static function bestPointName(array $variants, $baseKey)
    {
        $counts = array_count_values($variants);

        $best = null;
        $bestScore = null;

        foreach ($counts as $name => $count) {
            $score = 0;

            if (self::pointNameKey($name) === $baseKey) {
                $score += 1000; // نام پایه بر نام دارای توضیح اضافه ترجیح دارد
            }

            $score += min((int) $count, 100) * 10; // پرکاربردترین/رسمی‌ترین

            if (preg_match('/[\x{064A}\x{0643}\x{0629}]/u', $name)) {
                $score -= 60; // حروف عربی به‌جای فارسی
            }
            if (preg_match('/\s{2,}/u', $name)) {
                $score -= 25;
            }
            if (preg_match('/\S\(/u', $name)) {
                $score -= 15; // نبود فاصله پیش از پرانتز
            }
            if (preg_match('/[\x{200B}-\x{200F}\x{FEFF}]/u', $name)) {
                $score -= 10;
            }
            if (preg_match('/[0-9]/u', $name)) {
                $score -= 5;
            }

            $score -= mb_strlen($name) * 0.01;

            if ($bestScore === null || $score > $bestScore) {
                $best = $name;
                $bestScore = $score;
            }
        }

        return $best;
    }

    public static function showManagerPoints()
    {
        $manager_auth = auth()->guard('manager');
        $manager_id = $manager_auth->id();
        $points = DB::table('tbl_points')
            ->join('tbl_append_points','tbl_points.id','=','tbl_append_points.point_id')
            ->where([
                'manager_id' => $manager_id,
                'package' => FunctionsController::package()
            ])
            ->orderBy('tbl_points.id', 'desc')
            ->get();
        return $points;
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\AppendPoints  $appendPoints
     * @return \Illuminate\Http\Response
     */
    public static function show(AppendPoints $appendPoints)
    {
        $roles = DB::table('tbl_points')->get();
        return $roles;
    }


    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\AppendPoints  $appendPoints
     * @return \Illuminate\Http\Response
     */
    public function destroy(AppendPoints $appendPoints)
    {
        //
    }
}
