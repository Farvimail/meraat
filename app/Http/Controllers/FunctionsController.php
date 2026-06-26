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

    public static function soonPackage()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->orderBy('id', 'desc')
            ->first()
            ->package;
    }

    public static function package()
    {
        date_default_timezone_set("Asia/Tehran");

        return DB::table('tbl_calendar')
            ->where('dmy', date('dmY'))
            ->where('status','<>',3)
            ->orderBy('id', 'desc')
            ->first()
            ->package;
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

        $request->validate([
            'file' => 'required|mimes:jpeg,png,jpg,gif,svg|max:20480',
        ]);

        if ($request->file('file'))
        {
            $imagePath = $request->file('file');
            $imageName = $imagePath->getClientOriginalName();

            $test = explode('.', $imageName);
            $ext = end($test);
            $name;
            $name2;

            /*** check exist then create new file name*/
            do {
                $name = sha1(time()) . '.' . $ext;
            } while (file_exists($_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name));

            do {
                $name2 = sha1(time()).sha1(time()) . '.' . $ext;
            } while (file_exists($_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name2));
            /*** end check and create new file name*/

            /*** destination file ***/
            $location = $_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name;

            move_uploaded_file($request->file('file')->getPathName(), $location);

            if (strtolower(end($test)) == 'jpg' ||
                strtolower(end($test)) == 'jpeg') {

                self::GenerateThumbnail($_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name, $_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name2, 900, 900, $quality = 1);
            } else {

                self::GenerateThumbnailNormal($_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name, $_SERVER['DOCUMENT_ROOT'] . '/public/images/users/' . $name2, 900, 900, $quality = 1);
            }

            PhotoController::store($name2, $location, $request->cid);
            return 'images/users/' . $name2;

        }else{
            return false;
        }
    }

}
