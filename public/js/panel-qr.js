/*
 * کدِ QR تأییدِ حضور روی کارتِ هر کارمند (صفحهٔ همکارانِ پنل) + دکمهٔ
 * «تأیید دستیِ حضور» در بخشِ «کارمندها»ی پنل مدیریت.
 *
 * چرا هر دو در یک فایل: هر دو یک کار را می‌کنند (تأییدِ حضورِ امروزِ کارمند)
 * و یک وضعیت را می‌خوانند و می‌نویسند؛ دو فایل جدا یعنی دو نسخه از همان
 * منطق که دیر یا زود از هم جدا می‌افتند.
 *
 * چرا لازم است: ثبتِ ورود از گوشی می‌تواند از هر جایی انجام شود. اینجا پنل —
 * که فقط داخلِ محل کار باز است — روی کارتِ هر کارمند یک کدِ **چرخان** می‌کشد؛
 * کارمند همان لحظه با دوربینِ اپ اسکنش می‌کند و حضور «تأییدشده» می‌شود. پس
 * برای تأیید، هم گوشیِ خودِ کارمند لازم است و هم بودن در برابرِ این صفحه.
 *
 * چرا کد در سرور ساخته می‌شود و اینجا فقط کشیده می‌شود: امضا کلید می‌خواهد و
 * کلید در مرورگر نمی‌نشیند. پنل هر «پنجره» یک درخواست می‌زند و کدِ لحظه‌ای
 * همهٔ کارت‌های همان صفحه را با هم می‌گیرد (`/read/qr-codes`) — نه یک درخواست
 * برای هر کارت، که با ۳۰ کارمند یعنی ۳۰ درخواست در هر ۳۰ ثانیه.
 *
 * چهار چیز که این فایل عمداً انجام می‌دهد:
 *   ۱) در تبِ پنهان درخواست نمی‌زند و برگشت به تب را بلافاصله جبران می‌کند.
 *   ۲) اگر سرور خطا داد کدِ قبلی روی صفحه می‌ماند (کدِ کهنه بهتر از مربعِ
 *      خالی است؛ تازه‌سازیِ بعدی جبرانش می‌کند) و پنج ثانیه بعد دوباره تلاش
 *      می‌شود.
 *   ۳) اگر کسی به پنل وارد نشده باشد (۴۰۱)، مربع‌ها پنهان می‌شوند تا صفحهٔ
 *      بدونِ نشست، کدِ بی‌صاحب نشان ندهد.
 *   ۴) «کارتِ من را بزرگ نشان بده»: کارمند که در اپ روی اسکنرِ QR می‌زند،
 *      سرور از راهِ هابِ سوکت خبر می‌دهد (`timer.js` یک رویدادِ DOM می‌فرستد)
 *      و کارتِ او روی همین صفحه بزرگ، روشن و بالاى فهرست می‌آید — تا بینِ
 *      سی کارت نگردد و کدِ ۳۰ ثانیه‌ای پیش از رسیدنش عوض نشود.
 *
 * وابستگی‌ها: `public/js/vendor/toqr.js` (کدگذارِ QR، ساختهٔ scripts/vendor-toqr.mjs).
 */

(function () {
    'use strict';

    /** حاشیهٔ سفید دورِ کد، به ماژول — استانداردِ QR چهار ماژول است. */
    var QUIET = 4;

    /** اندازهٔ هر ماژول روی canvas (پیکسلِ داخلی) — ۹۶px ÷ ۳۳ ماژول ≈ ۳. */
    var MODULE_PX = 4;

    /** فاصلهٔ تلاشِ دوباره پس از خطا (میلی‌ثانیه). */
    var RETRY_MS = 5000;

    /**
     * تا کی کارتِ «نشانم بده» بزرگ بماند (میلی‌ثانیه).
     *
     * ۴۵ ثانیه = یک‌ونیم پنجرهٔ کد: کارمند وقت دارد گوشی را تنظیم کند و اگر
     * کدِ اول از دستش رفت، تازه‌شدنِ بعدی هم داخلِ همین فرصت می‌آید.
     */
    var SPOTLIGHT_MS = 45000;

    /**
     * اندازهٔ هر ماژول روی canvas در حالتِ بزرگ‌شده (پیکسلِ داخلی).
     *
     * چرا جدا از `MODULE_PX`: با ۸ پیکسل، canvas روی ۳۳ ماژول می‌شود ۳۲۸×۳۲۸
     * و CSS هم همان را روی عرضِ بزرگ می‌کشد، پس کدِ بزرگ‌شده تار نیست. اگر
     * همان ۴ می‌ماند، دوربینِ گوشی در نبودِ تمرکزِ دقیق سخت‌تر می‌خواند — و
     * حالتِ بزرگ‌شده دقیقاً وقتی می‌آید که باید بی‌دردسر خوانده شود.
     */
    var MODULE_PX_SPOTLIGHT = 8;

    /** متنِ دکمهٔ «تأیید دستی» در دو حالت — همان چیزی که مارک‌آپ هم می‌نویسد. */
    var CONFIRM_LABEL = 'تأیید دستیِ حضور';
    var CONFIRMED_LABEL = 'حضور تأیید شد';

    /**
     * کدِ یک رشته → ماتریسِ ماژول‌ها با حاشیهٔ سفید.
     *
     * جدا نگه داشته شده تا در تست (بدونِ مرورگر و canvas) هم بتوان همین
     * تبدیل را سنجید: مربعِ گوشه‌ها باید الگوی «یابنده» باشد و کل حاشیه خالی.
     */
    function qrCells(payload) {
        var encoder = (window.MeraatQr || {}).toQR;

        if (typeof encoder !== 'function') {
            return null;
        }

        var flat = encoder(String(payload));
        var size = Math.round(Math.sqrt(flat.length));

        if (!size || size * size !== flat.length) {
            return null;
        }

        var full = size + QUIET * 2;
        var cells = [];
        var y;
        var x;

        for (y = 0; y < full; y++) {
            var row = [];
            for (x = 0; x < full; x++) {
                var inside = y >= QUIET && y < QUIET + size && x >= QUIET && x < QUIET + size;
                row.push(inside && flat[(y - QUIET) * size + (x - QUIET)] ? 1 : 0);
            }
            cells.push(row);
        }

        return cells;
    }

    /** کشیدنِ ماتریس روی canvas (سیاه روی سفید، پیکسلِ تمام). */
    function paint(canvas, cells, modulePx) {
        var ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        var px = Math.max(2, Math.round(modulePx || MODULE_PX));
        var side = cells.length * px;

        canvas.width = side;
        canvas.height = side;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);
        ctx.fillStyle = '#10231a';

        for (var y = 0; y < cells.length; y++) {
            for (var x = 0; x < cells.length; x++) {
                if (cells[y][x]) {
                    ctx.fillRect(x * px, y * px, px, px);
                }
            }
        }
    }

    /** برچسبِ فارسیِ روشِ تأیید برای tooltip. */
    function methodLabel(method) {
        if (method === 'manual') {
            return 'تأیید دستیِ مدیر';
        }

        return 'تأیید با اسکنِ QR';
    }

    function start() {
        var badges = Array.prototype.slice.call(document.querySelectorAll('[data-presence-qr]'));
        var buttons = Array.prototype.slice.call(
            document.querySelectorAll('[data-presence-confirm-manual]'),
        );

        if (!badges.length && !buttons.length) {
            return;
        }

        // شنوندهٔ «تأیید دستی» اول ثبت می‌شود: صفحه‌ای که کارتِ QR ندارد
        // (بخشِ «کارمندها» در پنل مدیریت) هم باید دکمه‌اش کار کند. اگر این
        // ثبت پایین‌تر و بعد از بازگشتِ زودهنگام بود، آن دکمه بی‌اثر می‌ماند.
        document.addEventListener('click', onConfirmClick);

        var ids = [];
        var byId = {};
        var byButton = {};

        badges.forEach(function (badge) {
            var id = String(badge.getAttribute('data-customer-id') || '');

            if (!id) {
                return;
            }

            if (ids.indexOf(id) === -1) {
                ids.push(id);
            }

            (byId[id] = byId[id] || []).push(badge);
        });

        buttons.forEach(function (button) {
            var id = String(button.getAttribute('data-presence-confirm-manual') || '');

            if (!id) {
                return;
            }

            if (ids.indexOf(id) === -1) {
                ids.push(id);
            }

            (byButton[id] = byButton[id] || []).push(button);
        });

        if (!ids.length) {
            return;
        }

        // فقط صفحه‌ای که QR نشان می‌دهد چرخهٔ دوره‌ای لازم دارد: کدِ چرخان
        // باید عوض شود و وضعیتِ تأیید تازه بماند. صفحهٔ مدیریت (فقط دکمه)
        // یک بار وضعیت را می‌خواند و تمام — یک درخواست در هر ۳۰ ثانیه برای
        // دکمه‌هایی که شاید هیچ‌وقت زده نشوند، هزینهٔ بی‌دلیل است.
        var repeating = badges.length > 0;

        var timer = null;
        var lastFetchAt = 0;

        /** وضعیتِ تأیید را روی نشانه‌ها و دکمه‌های یک شناسه می‌نشاند. */
        function markConfirmed(id, info) {
            (byId[id] || []).forEach(function (badge) {
                badge.classList.add('is-confirmed');
                badge.setAttribute(
                    'title',
                    info
                        ? 'حضورِ امروز تأیید شد — ' + methodLabel(info.method) + ' — ' + info.at
                        : 'حضورِ امروز تأیید شد.',
                );
            });

            // روی دکمه، خودِ متن بازخورد است: صفحهٔ مدیریت کدِ QR ندارد، پس
            // بدونِ این، مدیر بعد از زدن دکمه هیچ نمی‌دید و باز می‌زد.
            (byButton[id] || []).forEach(function (button) {
                button.classList.add('is-confirmed');
                button.textContent = CONFIRMED_LABEL;
                button.setAttribute(
                    'title',
                    info
                        ? 'تأییدشده — ' + methodLabel(info.method) + ' — ' + info.at
                        : 'حضورِ امروز تأییدشده است.',
                );
            });
        }

        function clearConfirmed(id) {
            (byId[id] || []).forEach(function (badge) {
                badge.classList.remove('is-confirmed');
                badge.setAttribute('title', 'QR تأییدِ حضور — آن را با دوربینِ اپ اسکن کنید.');
            });

            (byButton[id] || []).forEach(function (button) {
                button.classList.remove('is-confirmed');
                button.textContent = CONFIRM_LABEL;
                button.removeAttribute('title');
            });
        }

        /* ---------------- «کارتِ من را بزرگ نشان بده» ----------------
           کارمند در اپ اسکنر را باز می‌کند؛ سرور به هاب می‌گوید و هاب به همهٔ
           پنل‌های باز خبر می‌دهد (`timer.js` هم همان خبر را به یک رویدادِ DOM
           تبدیل می‌کند). اینجا فقط صفحه‌ای که کارتِ همان کارمند را دارد واکنش
           می‌دهد؛ بقیه بی‌صدا رد می‌شوند. */

        /** آخرین ماتریسِ هر شناسه — برای اینکه بزرگ‌شدن، کدِ تازه بخواهد. */
        var lastCells = {};

        /** شناسهٔ کارتِ بزرگ‌شده و تایمرِ جمع‌کردنش. */
        var focusedId = null;
        var focusedTimer = null;

        /** ظرفِ عکسِ یک نشانه: همان جایی که کلاسِ بزرگ‌نمایی می‌نشیند. */
        function holder(badge) {
            if (badge.closest) {
                var found = badge.closest('.presence-photo');

                if (found) {
                    return found;
                }
            }

            return badge.parentNode || null;
        }

        /** کدِ یک نشانه، با اندازهٔ ماژولِ مناسبِ حالتِ فعلی‌اش. */
        function paintBadge(badge, cells) {
            var canvas = badge.querySelector ? badge.querySelector('canvas') : null;
            var box = holder(badge);
            var zoomed = !!box && !!box.classList && box.classList.contains('is-spotlight');

            if (canvas) {
                paint(canvas, cells, zoomed ? MODULE_PX_SPOTLIGHT : MODULE_PX);
            }
        }

        /** برداشتنِ بزرگ‌نمایی از کارتِ قبلی (کد هم به اندازهٔ معمولی برمی‌گردد). */
        function clearFocus() {
            if (focusedTimer) {
                clearTimeout(focusedTimer);
                focusedTimer = null;
            }

            var id = focusedId;

            if (id === null) {
                return;
            }

            focusedId = null;

            (byId[id] || []).forEach(function (badge) {
                var box = holder(badge);

                if (box && box.classList) {
                    box.classList.remove('is-spotlight');
                }

                if (lastCells[id]) {
                    paintBadge(badge, lastCells[id]);
                }
            });
        }

        /**
         * بزرگ و روشن کردنِ کارتِ یک کارمند.
         *
         * خروجی `false` یعنی «این صفحه کارتش را ندارد» — نه خطا. صفحه‌های
         * دیگری که همان کارت را دارند خودشان واکنش می‌دهند و همین صفحه نباید
         * چیزی بگوید (مثلاً صفحهٔ مدیریت که اصلاً QR ندارد).
         */
        function focusCard(id) {
            var badgesForId = byId[id] || [];

            if (!badgesForId.length) {
                return false;
            }

            clearFocus();
            focusedId = id;

            badgesForId.forEach(function (badge) {
                var box = holder(badge);

                if (box && box.classList) {
                    box.classList.add('is-spotlight');
                }

                if (lastCells[id]) {
                    paintBadge(badge, lastCells[id]);
                }

                // کارت ممکن است پایینِ فهرست باشد؛ کارمند نباید اسکرول کند.
                if (badge.scrollIntoView) {
                    try {
                        badge.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } catch (error) {
                        badge.scrollIntoView();
                    }
                }
            });

            if (focusedTimer) {
                clearTimeout(focusedTimer);
            }

            focusedTimer = setTimeout(clearFocus, SPOTLIGHT_MS);

            return true;
        }

        /** رویدادی که `timer.js` از پیامِ `qr-focus` سوکت می‌سازد. */
        function onQrFocus(event) {
            var id = event && event.detail ? String(event.detail.id) : '';

            if (id) {
                focusCard(id);
            }
        }

        /**
         * رویدادی که `timer.js` از پیامِ `qr-blur` سوکت می‌سازد — اسکنر بسته شد.
         *
         * فقط کارتِ همین شناسه جمع می‌شود؛ خبرِ بستنِ اسکنرِ همکار به ما ربطی
         * ندارد. اگر کارتی همین لحظه بزرگ نشده باشد، این خبر بی‌اثر است.
         */
        function onQrBlur(event) {
            var id = event && event.detail ? String(event.detail.id) : '';

            if (id && id === focusedId) {
                clearFocus();
            }
        }

        if (document.addEventListener) {
            document.addEventListener('meraat:qr-focus', onQrFocus);
            document.addEventListener('meraat:qr-blur', onQrBlur);
        }

        /** کشیدنِ کدها روی همهٔ نشانه‌های یک شناسه. */
        function draw(id, code) {
            var cells = qrCells(code);

            if (!cells) {
                return;
            }

            lastCells[id] = cells;

            (byId[id] || []).forEach(function (badge) {
                paintBadge(badge, cells);
            });
        }

        function schedule(seconds) {
            // صفحهٔ بدونِ QR (پنل مدیریت، فقط دکمهٔ تأییدِ دستی) چرخه‌ای ندارد:
            // یک بار وضعیت می‌خواند و بعد فقط به کلیکِ کاربر جواب می‌دهد.
            if (!repeating) {
                return;
            }

            if (timer) {
                clearTimeout(timer);
            }

            timer = setTimeout(function () {
                if (document.hidden) {
                    // در تبِ پنهان شبکه را بی‌دلیل گرم نمی‌کنیم؛ برگشت به تب
                    // (listener پایین) درخواست را فوراً می‌زند.
                    schedule(1);
                    return;
                }

                void load();
            }, Math.max(1, seconds) * 1000);
        }

        function load() {
            lastFetchAt = Date.now();

            var query = '/read/qr-codes?ids=' + encodeURIComponent(ids.join(','));

            return fetch(query, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                .then(function (response) {
                    if (response.status === 401) {
                        // پنل باز نیست: نشانه‌ها را برمی‌داریم.
                        badges.forEach(function (badge) {
                            badge.hidden = true;
                        });

                        return null;
                    }

                    if (!response.ok) {
                        throw new Error('bad status ' + response.status);
                    }

                    return response.json();
                })
                .then(function (data) {
                    if (!data) {
                        return;
                    }

                    var codes = data.codes || {};

                    Object.keys(codes).forEach(function (id) {
                        draw(id, codes[id]);
                    });

                    ids.forEach(function (id) {
                        var info = (data.confirmed || {})[id];

                        if (info) {
                            markConfirmed(id, { method: info.method, at: info.at });

                            // تأیید شد → دیگر لازم نیست کارتِ او بزرگ بماند؛
                            // جمع‌کردنِ فوری همان «کارم تمام شد» را می‌رساند.
                            if (id === focusedId) {
                                clearFocus();
                            }
                        } else {
                            clearConfirmed(id);
                        }
                    });

                    // پنجرهٔ بعدی: یک ثانیه بعد از انقضای این کد، تا کدِ تازه
                    // روی صفحه بنشیند و لحظه‌ای کدِ باطل دیده نشود.
                    schedule(Number(data.expires_in || 30) + 1);
                })
                .catch(function () {
                    // کدِ قبلی روی صفحه می‌ماند و پنج ثانیه بعد دوباره تلاش می‌کنیم.
                    schedule(RETRY_MS / 1000);
                });
        }

        // «تأیید دستیِ مدیر» برای روزهایی که دوربینِ گوشی کار نمی‌کند.
        function onConfirmClick(event) {
            var button = event.target.closest ? event.target.closest('[data-presence-confirm-manual]') : null;

            if (!button) {
                return;
            }

            event.preventDefault();

            var id = String(button.getAttribute('data-presence-confirm-manual') || '');
            var tokenMeta = document.querySelector('meta[name="csrf-token"]');
            var body = new FormData();

            body.append('id', id);
            body.append('_token', tokenMeta ? tokenMeta.getAttribute('content') : '');
            button.disabled = true;

            fetch('/read/qr-confirm-manual', {
                method: 'POST',
                body: body,
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                })
                .then(function (result) {
                    button.disabled = false;

                    if (result.ok && result.data && result.data.confirmed) {
                        markConfirmed(id, result.data.confirmed);
                        return;
                    }

                    button.removeAttribute('disabled');
                    button.classList.add('is-failed');

                    // دلیلِ سرور (اگر گفته باشد) به‌عنوان tooltip می‌ماند؛
                    // بدونِ آن مدیر فقط «قرمز شد» می‌بیند.
                    if (result.data && result.data.message) {
                        button.setAttribute('title', String(result.data.message));
                    }

                    setTimeout(function () {
                        button.classList.remove('is-failed');
                    }, 3000);
                })
                .catch(function () {
                    button.disabled = false;
                    button.classList.add('is-failed');
                    setTimeout(function () {
                        button.classList.remove('is-failed');
                    }, 3000);
                });
        }

        // برگشت به تب: اگر پنجره‌ای گذشته، همان لحظه تازه کن.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && Date.now() - lastFetchAt > 1000) {
                void load();
            }
        });

        void load();
    }

    // برای تستِ بدونِ مرورگر (scripts/tests/presence-qr.test.mjs).
    window.MeraatPresenceQr = {
        qrCells: qrCells,
        QUIET: QUIET,
        SPOTLIGHT_MS: SPOTLIGHT_MS,
        MODULE_PX_SPOTLIGHT: MODULE_PX_SPOTLIGHT,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
