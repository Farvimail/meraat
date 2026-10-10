<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * Manual database backup for the management panel.
 * The scheduled (daily) run lives in App\Console\Commands\DatabaseBackup.
 */
class BackupController extends Controller
{
    /**
     * Files that are not named exactly like a dump we produced are ignored,
     * both when listing and when downloading.
     */
    const NAME_PATTERN = '/^meraat-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}\.sql\.gz$/';

    /**
     * Where the dumps live - deliberately outside public/.
     *
     * @return string
     */
    public static function directory()
    {
        return storage_path('app/backups');
    }

    /**
     * Newest first: [['name' => .., 'size' => .., 'mtime' => ..], ...]
     *
     * @return array
     */
    public static function files()
    {
        $dir = self::directory();

        if (!is_dir($dir)) {
            return array();
        }

        $out = array();

        foreach ((array) glob($dir . '/meraat-*.sql.gz') as $path) {
            if (!preg_match(self::NAME_PATTERN, basename($path))) {
                continue;
            }
            $out[] = array(
                'name'  => basename($path),
                'size'  => (int) @filesize($path),
                'mtime' => (int) @filemtime($path),
            );
        }

        usort($out, function ($a, $b) {
            return $b['mtime'] - $a['mtime'];
        });

        return $out;
    }

    /**
     * @return array|null
     */
    public static function last()
    {
        $files = self::files();

        return count($files) ? $files[0] : null;
    }

    /**
     * POST /backup/create - run the dump right now.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\RedirectResponse
     */
    public function create(Request $request)
    {
        $code = Artisan::call('db:backup');
        $out  = trim(Artisan::output());

        if ($code !== 0) {
            return redirect()->back()
                ->with('status', 'بکاپ گرفته نشد: ' . $out);
        }

        return redirect()->back()
            ->with('status', 'بکاپ با موفقیت گرفته شد. ' . $out);
    }

    /**
     * GET /backup/download/{file} - download one dump.
     *
     * @param  string $file
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function download($file)
    {
        // basename() + strict pattern => no path traversal is possible
        $file = basename($file);

        if (!preg_match(self::NAME_PATTERN, $file)) {
            abort(404);
        }

        $path = self::directory() . '/' . $file;

        if (!is_file($path)) {
            abort(404);
        }

        return response()->download($path, $file, [
            'Content-Type' => 'application/gzip',
        ]);
    }
}
