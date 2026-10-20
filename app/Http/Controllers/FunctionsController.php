<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FunctionsController extends Controller
{
    public static function e2p($number)
    {
        $en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        $fn = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

        return str_replace($en, $fn, $number);
    }

    /**
     * ارقام فارسی/عربی را به انگلیسی برمی‌گرداند.
     *
     * ورودی‌های قیمت با جداکنندهٔ هزارگان (ویرگول) نمایش داده می‌شوند و ممکن
     * است با ارقام فارسی وارد شوند؛ پیش از ذخیره باید به عدد خالص تبدیل شوند.
     *
     * @param  string $value
     * @return string
     */
    public static function p2e($value)
    {
        $fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        return str_replace($fa, $en, $value);
    }

    /**
     * Gregorian date to Jalali (Solar Hijri) date. Standard algorithm, no
     * extra dependency - the panel dates are Persian, the file names stay
     * Gregorian so they remain sortable and downloadable.
     *
     * @param  int $gy
     * @param  int $gm
     * @param  int $gd
     * @return array [year, month, day]
     */
    public static function gregorianToJalali($gy, $gm, $gd)
    {
        $g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        $gy2 = ($gm > 2) ? ($gy + 1) : $gy;

        $days = 355666 + (365 * $gy) + ((int) (($gy2 + 3) / 4)) - ((int) (($gy2 + 99) / 100))
            + ((int) (($gy2 + 399) / 400)) + $gd + $g_d_m[$gm - 1];

        $jy = -1595 + (33 * ((int) ($days / 12053)));
        $days %= 12053;

        $jy += 4 * ((int) ($days / 1461));
        $days %= 1461;

        if ($days > 365) {
            $jy += (int) (($days - 1) / 365);
            $days = ($days - 1) % 365;
        }

        if ($days < 186) {
            $jm = 1 + (int) ($days / 31);
            $jd = 1 + ($days % 31);
        } else {
            $jm = 7 + (int) (($days - 186) / 30);
            $jd = 1 + (($days - 186) % 30);
        }

        return [$jy, $jm, $jd];
    }

    /**
     * Jalali timestamp with Tehran time, e.g. "1405/07/17 14:09".
     * Pass it through e2p() to get Persian digits.
     *
     * @param  int $timestamp
     * @return string
     */
    public static function jdate($timestamp)
    {
        date_default_timezone_set("Asia/Tehran");

        list($jy, $jm, $jd) = self::gregorianToJalali(
            (int) date('Y', $timestamp),
            (int) date('n', $timestamp),
            (int) date('j', $timestamp)
        );

        return sprintf('%04d/%02d/%02d %s', $jy, $jm, $jd, date('H:i', $timestamp));
    }

    public static function soonPackage()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', self::systemDmy())
            ->orderBy('id', 'desc')
            ->first()
            ->package;
    }

    public static function package()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', self::systemDmy())
            ->where('status','<>',3)
            ->orderBy('id', 'desc')
            ->first()
            ->package;
    }

    /**
     * کلید نشستِ «تاریخ فعال سامانه».
     *
     * مدیر می‌تواند از نوار بالای پنل یک روز دیگر (مثلاً داخل ماه قبل) را فعال
     * کند تا سامانه همان روز را «امروز» ببیند. قبلاً برای این کار تاریخ خودِ
     * سیستم عوض می‌شد که روی سرور ممکن نیست.
     */
    const SYSTEM_DATE_KEY = 'system_date';

    /**
     * تاریخ فعال سامانه به شکل Y-m-d؛ اگر مدیری تاریخی فعال کرده باشد همان
     * روز، وگرنه امروز واقعی (به وقت تهران).
     *
     * @return string
     */
    public static function systemDate()
    {
        date_default_timezone_set("Asia/Tehran");

        $override = self::systemDateOverride();

        return $override !== null ? $override : date('Y-m-d');
    }

    /**
     * امروزِ واقعی به شکل Y-m-d، مستقل از تاریخ فعال سامانه.
     *
     * برای سقف فهرست ماه‌ها لازم است: فهرست باید همیشه تا ماه جاری برسد،
     * حتی وقتی مدیر روی ماهی در گذشته کار می‌کند و تاریخ فعال عقب‌تر است.
     *
     * @return string
     */
    public static function realDate()
    {
        date_default_timezone_set("Asia/Tehran");

        return date('Y-m-d');
    }

    /**
     * همان تاریخ، به شکل dmy که جدول تقویم استفاده می‌کند (مثل 09102026).
     *
     * @return string
     */
    public static function systemDmy()
    {
        date_default_timezone_set("Asia/Tehran");

        return date('dmY', strtotime(self::systemDate()));
    }

    /**
     * مهرزمان تاریخ فعال سامانه.
     *
     * @return int
     */
    public static function systemTimestamp()
    {
        date_default_timezone_set("Asia/Tehran");

        return strtotime(self::systemDate());
    }

    /**
     * تاریخ فعال‌شده توسط مدیر (اگر معتبر باشد) وگرنه null.
     *
     * @return string|null
     */
    public static function systemDateOverride()
    {
        $value = session(self::SYSTEM_DATE_KEY);

        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }

        return null;
    }

    /**
     * آیا سامانه روی تاریخی غیر از امروز واقعی کار می‌کند؟
     *
     * (اگر مدیری عمداً همین امروز را فعال کرده باشد، سامانه در عمل روی امروز
     * واقعی است و کارهای حساس نباید قفل شوند.)
     *
     * @return bool
     */
    public static function isOffRealToday()
    {
        return self::hasSystemDate() && self::systemDate() !== self::realDate();
    }

    /**
     * آیا سامانه روی تاریخی غیر از امروز واقعی کار می‌کند؟
     *
     * @return bool
     */
    public static function hasSystemDate()
    {
        return self::systemDateOverride() !== null;
    }

    /**
     * تاریخ فعال سامانه به شمسی برای نمایش، مثل «۱۴۰۵/۰۶/۱۵».
     *
     * @return string
     */
    public static function systemDateJalali()
    {
        return self::e2p(substr(self::jdate(self::systemTimestamp()), 0, 10));
    }

    public static function GenerateThumbnail($im_filename,$th_filename,$max_width,$max_height,$quality = 1)
    {
        // The original image must exist
        if( is_file($im_filename) )
        {
            // Let's create the directory if needed
            $th_path = dirname($th_filename);

            if( !is_dir( $th_path ) )
                mkdir($th_path, 0777, true);

            // If the thumb does not aleady exists
            if( !is_file($th_filename) )
            {
                // Get Image size info
                $exif = exif_read_data($im_filename);
                $orientation = isset($exif['Orientation']) ? $exif['Orientation'] : null;

                list($width_orig, $height_orig, $image_type) = @getimagesize($im_filename);

                if ( !empty($exif['Orientation']) )
                {
                    if ( $exif['Orientation'] == 8 ||
                        $exif['Orientation'] == 6 ||
                        $exif['Orientation'] == 3 ){
                        list($height_orig, $width_orig, $image_type) = @getimagesize($im_filename);
                    }else{
                        list($width_orig, $height_orig, $image_type) = @getimagesize($im_filename);
                    }
                }

                if ( !$width_orig )
                    return 2;

                switch($image_type)
                {
                    case 1: $src_im = @imagecreatefromgif($im_filename);    break;
                    case 2: $src_im = @imagecreatefromjpeg($im_filename);   break;
                    case 3: $src_im = @imagecreatefrompng($im_filename);    break;
                }

                if ( !$src_im )
                    return 3;

                $src_imtwo = $src_im;

                if ( !empty($exif['Orientation']) )
                {
                    if ( $exif['Orientation'] == 8 ) {
                        $src_imtwo = imagerotate($src_im, 90, 0);
                    }else if ( $exif['Orientation'] == 6 ){
                        $src_imtwo = imagerotate($src_im, -90, 0);
                    }else if ( $exif['Orientation'] == 3 ){
                        $src_imtwo = imagerotate($src_im, 180, 0);
                    }
                }

                /*make resize width and height*/
                $aspect_ratio = (float) $height_orig / $width_orig;

                $thumb_height = $max_height;
                $thumb_width = round($thumb_height / $aspect_ratio);

                if( $thumb_width > $max_width )
                {
                    $thumb_width  = $max_width;
                    $thumb_height = round($thumb_width * $aspect_ratio);
                }

                $width = $thumb_width;
                $height = $thumb_height;
                /*end resize*/

                $dst_img = @imagecreatetruecolor($width, $height);

                if ( !$dst_img )
                    return 4;

                $success = @imagecopyresampled($dst_img,$src_imtwo,0,0,0,0,$width,$height,$width_orig,$height_orig);

                /* crop image */
                $temp = $width;
                $flag = false;

                if ( $width > $height)
                {
                    $width = $height;
                    $height = $temp;
                    $flag = true;
                }

                $factor = $width/2;

                $nwidth = 2*$factor;
                $nheight = 2*$factor;

                $widthDistance = $width-$nwidth;
                $heightDistance = $height-$nheight;

                if ( $flag == true )
                {
                    $widthDistance = $height-$nwidth;
                    $heightDistance = $width-$nheight;
                }

                $flag = false;

                $im2 = imagecrop($dst_img, ['x' => $widthDistance/2, 'y' => $heightDistance/2, 'width' => $nwidth, 'height' => $nheight]);
                /* end crop image */

                if ( !$success)
                    return 4;

                switch ($image_type)
                {
                    case 1: $success = @imagegif($im2,$th_filename); break;
                    case 2: $success = @imagejpeg($im2,$th_filename);  break;
                    case 3: $success = @imagepng($im2,$th_filename); break;
                }

                if ( !$success )
                    return 4;
            }

            return 0;
        }

        return 1;
    }

    function GenerateThumbnailNormal($im_filename,$th_filename,$max_width,$max_height,$format,$quality = 1)
    {
        // The original image must exist
        if( is_file($im_filename) )
        {
            // Let's create the directory if needed
            $th_path = dirname($th_filename);

            if( !is_dir( $th_path ) )
                mkdir($th_path, 0777, true);

            // If the thumb does not aleady exists
            if( !is_file($th_filename) )
            {
                // Get Image size info
                list($width_orig, $height_orig, $image_type) = @getimagesize($im_filename);

                if ( !$width_orig )
                    return 2;

                switch($image_type)
                {
                    case 1: $src_im = @imagecreatefromgif($im_filename);    break;
                    case 2: $src_im = @imagecreatefromjpeg($im_filename);   break;
                    case 3: $src_im = @imagecreatefrompng($im_filename);    break;
                }

                if ( !$src_im )
                    return 3;

                $src_imtwo = $src_im;

                /*make resize width and height*/
                $aspect_ratio = (float) $height_orig / $width_orig;

                $thumb_height = $max_height;
                $thumb_width = round($thumb_height / $aspect_ratio);

                if ( $thumb_width > $max_width )
                {
                    $thumb_width  = $max_width;
                    $thumb_height = round($thumb_width * $aspect_ratio);
                }

                $width = $thumb_width;
                $height = $thumb_height;
                /*end resize*/

                $dst_img = @imagecreatetruecolor($width, $height);

                if ( !$dst_img )
                    return 4;

                $success = @imagecopyresampled($dst_img,$src_imtwo,0,0,0,0,$width,$height,$width_orig,$height_orig);

                /* crop image */
                $temp = $width;
                $flag = false;

                if ( $width > $height)
                {
                    $width = $height;
                    $height = $temp;
                    $flag = true;
                }

                $factor = $width/2;

                $nwidth = 2*$factor;
                $nheight = 2*$factor;

                $widthDistance = $width-$nwidth;
                $heightDistance = $height-$nheight;

                if ( $flag == true )
                {
                    $widthDistance = $height-$nwidth;
                    $heightDistance = $width-$nheight;
                }

                $flag = false;

                $im2 = imagecrop($dst_img, ['x' => $widthDistance/2, 'y' => $heightDistance/2, 'width' => $nwidth, 'height' => $nheight]);
                /* end crop image */

                if ( !$success )
                    return 4;

                switch ($image_type)
                {
                    case 1: $success = @imagegif($im2,$th_filename); break;
                    case 2: $success = @imagejpeg($im2,$th_filename);  break;
                    case 3: $success = @imagepng($im2,$th_filename); break;
                }

                if ( !$success )
                    return 4;
            }

            return 0;
        }

        return 1;
    }

    public function uploadAjax(Request $request)
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');

        // در لاراول ۵٫۶ `validate` روی Request نیست؛ `$request->validate`
        // استثنای `BadMethodCall` می‌داد و هر آپلود از پنل وب با ۵۰۰ می‌افتاد.
        $this->validate($request, [
            'file' => 'required|mimes:jpeg,png,jpg,gif,svg|max:20480',
        ]);

        if ($request->file('file'))
        {
            $imagePath = $request->file('file');
            $imageName = $imagePath->getClientOriginalName();

            $test = explode('.', $imageName);
            $ext = end($test);

            /*
             * پوشهٔ مقصد از `public_path()` می‌آید، نه از
             * `$_SERVER['DOCUMENT_ROOT']`.
             *
             * چرا: داخل کانتینر، ریشهٔ داکیومنت `/var/www/html` است، پس مسیر
             * قبلی به `/var/www/html/public/public/images/users/` می‌رسید —
             * پوشه‌ای که وجود ندارد. نتیجه این بود که هر آپلود از پنل وب
             * بی‌صدا شکست می‌خورد و عکسِ کارمند هیچ‌وقت عوض نمی‌شد.
             */
            $dir = public_path('images/users');

            if (! is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }

            /*** check exist then create new file name*/
            do {
                $name = sha1(time()) . '.' . $ext;
            } while (file_exists($dir . '/' . $name));

            do {
                $name2 = sha1(time()).sha1(time()) . '.' . $ext;
            } while (file_exists($dir . '/' . $name2));
            /*** end check and create new file name*/

            /*** destination file ***/
            $location = $dir . '/' . $name;

            move_uploaded_file($request->file('file')->getPathName(), $location);

            if (strtolower(end($test)) == 'jpg' ||
                strtolower(end($test)) == 'jpeg') {

                self::GenerateThumbnail($location, $dir . '/' . $name2, 900, 900, $quality = 1);
            } else {

                self::GenerateThumbnailNormal($location, $dir . '/' . $name2, 900, 900, $quality = 1);
            }

            PhotoController::store($name2, $location, $request->cid);
            return 'images/users/' . $name2;

        }else{
            return false;
        }
    }

}
