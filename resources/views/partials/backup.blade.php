{{-- Database backup card. Included by the manager and admin panels. --}}
@php
    $backupPerPage = 10;
    $backupAll     = \App\Http\Controllers\BackupController::files();   // newest first
    $backupTotal   = count($backupAll);
    $backupPages   = max(1, (int) ceil($backupTotal / $backupPerPage));
    $backupPage    = min(max(1, (int) app('request')->get('bkpage', 1)), $backupPages);
    $backupItems   = array_slice($backupAll, ($backupPage - 1) * $backupPerPage, $backupPerPage);
    $backupLast    = \App\Http\Controllers\BackupController::last();

    // A plain array, not an Eloquent query: LengthAwarePaginator handles arrays
    // fine and keeps the page in a `bkpage` parameter so other pages of the
    // panel are not affected.
    $backupPaginator = new \Illuminate\Pagination\LengthAwarePaginator(
        $backupItems,
        $backupTotal,
        $backupPerPage,
        $backupPage,
        [
            'path'     => \Illuminate\Pagination\Paginator::resolveCurrentPath(),
            'pageName' => 'bkpage',
        ]
    );
    $backupPaginator->appends(app('request')->except('bkpage'));
@endphp
{{-- dir=rtl only flips the flow (column order). text-align must be set
     explicitly too: the page body is LTR, so `text-align: start` was already
     resolved to `left` up the tree and every descendant inherits that. --}}
<div class="container" id="backup" dir="rtl" style="text-align: right">
    <div class="row justify-content-center">
        <div class="col-md-12">
            <div class="card">
                <div class="card-header">پشتیبان‌گیری پایگاه داده</div>
                <div class="card-body">
                    <p class="mb-3">
                        بکاپ خودکار هر روز ساعت ۰۳:۰۰ (وقت تهران) گرفته می‌شود.
                        با دکمهٔ زیر می‌توانید در هر لحظه یک بکاپ دستی تهیه کنید.
                        فایل‌ها به‌صورت فشرده (gzip) در <code>storage/app/backups</code>
                        ذخیره می‌شوند و نسخه‌های قدیمی‌تر از ۳۰ روز به‌صورت خودکار حذف می‌گردند.
                    </p>

                    <p>
                        @if ($backupLast)
                            آخرین بکاپ:
                            <strong>{{ \App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\FunctionsController::jdate($backupLast['mtime'])) }}</strong>
                            —
                            {{ \App\Http\Controllers\FunctionsController::e2p(number_format($backupLast['size'] / 1024, 1)) }} کیلوبایت
                        @else
                            هنوز هیچ بکاپی گرفته نشده است.
                        @endif
                    </p>

                    @if (\App\Http\Controllers\FunctionsController::isOffRealToday())
                        {{-- همان قفل سمت سرور (`real.month`) که اینجا هم روشن دیده شود --}}
                        <div class="alert alert-warning mb-3" style="direction: rtl; text-align: right">
                            تاریخ فعال سامانه
                            <strong>{{ \App\Http\Controllers\FunctionsController::systemDateJalali() }}</strong>
                            است، نه امروز واقعی
                            ({{ \App\Http\Controllers\FunctionsController::e2p(substr(\App\Http\Controllers\FunctionsController::jdate(time()), 0, 10)) }}).
                            بکاپ‌گیری دستی دامپِ کل پایگاه داده است و به ماه فعال ربطی ندارد؛
                            تا وقتی روی ماه دیگری کار می‌کنید غیرفعال است.
                            اول از نوار بالا <strong>«بازگشت به امروز»</strong> را بزنید.
                        </div>

                        <button type="button" class="btn btn-secondary mb-4" disabled
                                title="تا وقتی تاریخ فعال سامانه با امروز واقعی فرق دارد، بکاپ دستی غیرفعال است">
                            گرفتن بکاپ دستی (غیرفعال)
                        </button>
                    @else
                        <form action="{{ route('backup.create') }}" method="POST" class="mb-4">
                            @csrf
                            <button type="submit" class="btn btn-primary">گرفتن بکاپ دستی</button>
                        </form>
                    @endif

                    <h6>
                        فایل‌های موجود
                        @if ($backupTotal)
                            <small class="text-muted">
                                ({{ \App\Http\Controllers\FunctionsController::e2p($backupTotal) }} فایل)
                            </small>
                        @endif
                    </h6>

                    @if ($backupTotal)
                        <table class="table table-sm table-striped">
                            <thead>
                                <tr>
                                    <th>ردیف</th>
                                    <th>نام فایل</th>
                                    <th>تاریخ</th>
                                    <th>حجم</th>
                                    <th>دانلود</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($backupItems as $index => $backup)
                                    <tr>
                                        <td>{{ \App\Http\Controllers\FunctionsController::e2p(($backupPage - 1) * $backupPerPage + $index + 1) }}</td>
                                        <td>{{ $backup['name'] }}</td>
                                        <td>{{ \App\Http\Controllers\FunctionsController::e2p(\App\Http\Controllers\FunctionsController::jdate($backup['mtime'])) }}</td>
                                        <td>{{ \App\Http\Controllers\FunctionsController::e2p(number_format($backup['size'] / 1024, 1)) }} کیلوبایت</td>
                                        <td>
                                            <a class="btn btn-sm btn-outline-primary"
                                               href="{{ route('backup.download', ['file' => $backup['name']]) }}">
                                                دانلود
                                            </a>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>

                        <div class="d-flex justify-content-between align-items-center flex-wrap">
                            <small class="text-muted">
                                نمایش
                                {{ \App\Http\Controllers\FunctionsController::e2p(($backupPage - 1) * $backupPerPage + 1) }}
                                تا
                                {{ \App\Http\Controllers\FunctionsController::e2p(min($backupPage * $backupPerPage, $backupTotal)) }}
                                از
                                {{ \App\Http\Controllers\FunctionsController::e2p($backupTotal) }}
                                فایل
                            </small>

                            @if ($backupPages > 1)
                                {{ $backupPaginator->links() }}
                            @endif
                        </div>
                    @else
                        <p class="text-muted">فایلی برای نمایش نیست.</p>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
