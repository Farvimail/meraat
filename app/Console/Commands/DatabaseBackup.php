<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

/**
 * Dumps the whole database into storage/app/backups as a gzipped SQL file.
 *
 * Used twice: scheduled daily (see App\Console\Kernel::schedule) and on
 * demand from the management panel (BackupController@create).
 */
class DatabaseBackup extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:backup {--keep= : How many days of backups to keep}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dump the database into storage/app/backups (gzipped SQL)';

    /**
     * Backups older than this many days are pruned after each run.
     */
    const DEFAULT_KEEP = 30;

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $conn = config('database.connections.' . config('database.default'));

        $host = $conn['host'];
        $port = isset($conn['port']) ? $conn['port'] : 3306;
        $user = $conn['username'];
        $pass = $conn['password'];
        $db   = $conn['database'];

        $dir = storage_path('app/backups');
        if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
            $this->error('Cannot create backup directory: ' . $dir);

            return 1;
        }

        // The daily run happens as root and the manual one as www-data
        // (php-fpm), so both the directory and the files have to be usable by
        // www-data. Failures are harmless: they only happen when the process
        // is not allowed to change the owner.
        @chgrp($dir, 'www-data');
        @chmod($dir, 0775);

        $name = 'meraat-' . date('Y-m-d_His');
        $sql  = $dir . '/' . $name . '.sql';
        $gz   = $sql . '.gz';

        // stdout goes straight into the dump file (no shell involved), so the
        // whole dump never has to fit in PHP memory. The password never
        // reaches the command line: it is passed in the child environment.
        $cmd = array(
            'mysqldump',
            '--host=' . $host,
            '--port=' . $port,
            '--user=' . $user,
            '--single-transaction',
            '--quick',
            '--skip-lock-tables',
            '--add-drop-table',
            $db,
        );

        $desc = array(
            0 => array('pipe', 'r'),
            1 => array('file', $sql, 'w'),
            2 => array('pipe', 'w'),
        );

        // proc_open replaces the child environment with this array, and
        // getenv() is not always a clean list of strings: under php-fpm it
        // also contains `argv` (an array), and handing an array to proc_open
        // raises "Array to string conversion". That made the manual backup
        // button return a 500 while the CLI run worked. Keep the strings and
        // drop the rest.
        $env = array();
        foreach ((array) getenv() as $key => $value) {
            if (is_string($value)) {
                $env[$key] = $value;
            }
        }
        $env['MYSQL_PWD'] = (string) $pass;

        $this->info('Dumping ' . $db . '@' . $host . ' ...');

        try {
            $proc = proc_open($cmd, $desc, $pipes, null, $env);
        } catch (\Throwable $e) {
            // proc_open creates the dump file before it fails, and for an
            // exception the cleanup below is never reached - that is how two
            // uncompressed .sql files were left behind by the php-fpm
            // "Array to string conversion" bug.
            @unlink($sql);
            throw $e;
        }

        if (!is_resource($proc)) {
            $this->error('Could not start mysqldump.');

            return 1;
        }

        fclose($pipes[0]);
        $err = trim(stream_get_contents($pipes[2]));
        fclose($pipes[2]);
        $code = proc_close($proc);

        if ($code !== 0 || !is_file($sql) || filesize($sql) === 0) {
            $this->error('mysqldump failed (exit ' . $code . '): ' . $err);
            @unlink($sql);

            return 1;
        }

        if ($err !== '') {
            $this->warn($err);
        }

        // compress, which also removes the uncompressed .sql
        try {
            $gzip = new Process(['gzip', '-9', $sql]);
            $gzip->setTimeout(300);
            $gzip->run();
        } catch (\Throwable $e) {
            @unlink($sql);
            throw $e;
        }

        if (!$gzip->isSuccessful() || !is_file($gz)) {
            $this->error('gzip failed (exit ' . $gzip->getExitCode() . '): ' . trim($gzip->getErrorOutput()));
            @unlink($sql);

            return 1;
        }

        // never report a backup we cannot read back
        if (!$this->verify($gz)) {
            $this->error('The generated file is not a valid gzip SQL dump.');
            @unlink($gz);

            return 1;
        }

        // root-created dumps stay readable for the panel that lists them
        @chmod($gz, 0644);

        $kept = $this->prune($dir);

        $this->info(sprintf(
            'Backup written: %s (%s) - %d files kept.',
            basename($gz),
            $this->humanSize(filesize($gz)),
            $kept
        ));

        return 0;
    }

    /**
     * The file must decompress and start with a mysqldump header.
     *
     * @param  string $gz
     * @return bool
     */
    protected function verify($gz)
    {
        $size = @filesize($gz);
        if ($size === false || $size < 100) {
            return false;
        }

        $h = @gzopen($gz, 'r');
        if ($h === false) {
            return false;
        }
        // MariaDB 10.5 prefixes the dump with a sandbox-mode comment, so the
        // marker is not necessarily on line 1 - look at the first few KB.
        $head = (string) fread($h, 4096);
        gzclose($h);

        $markers = array('dump', 'CREATE TABLE', 'DROP TABLE', 'INSERT INTO');
        foreach ($markers as $marker) {
            if (stripos($head, $marker) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Delete dumps older than the retention period.
     *
     * @param  string $dir
     * @return int number of files that remain
     */
    protected function prune($dir)
    {
        $keep = (int) ($this->option('keep') !== null ? $this->option('keep') : self::DEFAULT_KEEP);
        if ($keep < 1) {
            $keep = 1;
        }

        $threshold = time() - ($keep * 86400);
        $left = 0;

        foreach ((array) glob($dir . '/meraat-*.sql.gz') as $file) {
            if (@filemtime($file) < $threshold) {
                @unlink($file);
                continue;
            }
            $left++;
        }

        return $left;
    }

    /**
     * @param  int $bytes
     * @return string
     */
    protected function humanSize($bytes)
    {
        return number_format($bytes / 1024, 1) . ' KB';
    }
}
