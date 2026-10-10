/**
 * انتخاب‌گر تاریخ جلالی — بدون هیچ وابستگی خارجی.
 *
 * ورودی بومی <input type="date"> تقویم میلادی باز می‌کند؛ این فایل جای آن را
 * می‌گیرد: یک دکمه که تاریخ شمسی را نشان می‌دهد و با کلیک یک تقویم جلالی
 * (ماه/سال شمسی، هفتهٔ شنبه تا جمعه) باز می‌کند. مقدار خامِ فرم همچنان
 * میلادیِ Y-m-d می‌ماند تا سرور (PanelDateController) بدون تغییر کار کند.
 *
 * الگوریتم تبدیل tāb'ی g2j عیناً از FunctionsController::gregorianToJalali
 * (کد سمت سرور) port شده تا خروجی دو طرف یکی باشد؛ j2g جفت همان الگوریتم
 * کلاسیک است. هر دو با تست رفت‌وبرگشت روی روزهای ۱۹۸۰–۲۰۵۰ در همین مخزن
 * (node public/js/jdate-picker.js) صحت‌سنجی می‌شوند.
 *
 * رابط: document.getElementById('panelDateInput')   → ورودی مخفی Y-m-d
 *        document.getElementById('panelDateTrigger') → دکمهٔ نمایش شمسی
 *        document.getElementById('panelJdp')         → جعبهٔ تقویم
 */
(function (root) {
    'use strict';

    var api = {
        g2j: g2j,
        j2g: j2g,
        daysInMonth: daysInMonth,
        toJalali: toJalali,
        toGregorian: toGregorian,
        format: format
    };

    /* ------------------------------------------------- ارقام و نام‌ها */

    var FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

    // هفتهٔ ایرانی: شنبه تا جمعه
    var WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

    function fa(value) {
        return String(value).replace(/[0-9]/g, function (d) {
            return FA_DIGITS[Number(d)];
        });
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) {
            node.className = cls;
        }
        if (text !== undefined && text !== null) {
            node.textContent = text;
        }
        return node;
    }

    /* ---------------------------------------------------- تبدیل تاریخ */

    /**
     * میلادی → شمسی (پورت عینی FunctionsController::gregorianToJalali).
     *
     * @param  number gy سال میلادی
     * @param  number gm ماه میلادی ۱..۱۲
     * @param  number gd روز میلادی
     * @return Array [jy, jm, jd]
     */
    function g2j(gy, gm, gd) {
        var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var gy2 = (gm > 2) ? (gy + 1) : gy;

        var days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
            + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];

        var jy = -1595 + 33 * Math.floor(days / 12053);
        days %= 12053;

        jy += 4 * Math.floor(days / 1461);
        days %= 1461;

        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }

        var jm;
        var jd;

        if (days < 186) {
            jm = 1 + Math.floor(days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + Math.floor((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }

        return [jy, jm, jd];
    }

    /**
     * شمسی → میلادی (جفت همان الگوریتم).
     *
     * @param  number jy
     * @param  number jm ۱..۱۲
     * @param  number jd
     * @return Array [gy, gm, gd]
     */
    function j2g(jy, jm, jd) {
        jy += 1595;

        var days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8
            + Math.floor((jy % 33 + 3) / 4) + jd
            + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);

        var gy = 400 * Math.floor(days / 146097);
        days %= 146097;

        if (days > 36524) {
            days--;
            gy += 100 * Math.floor(days / 36524);
            days %= 36524;
            if (days >= 365) {
                days++;
            }
        }

        gy += 4 * Math.floor(days / 1461);
        days %= 1461;

        if (days > 365) {
            gy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }

        var gd = days + 1;
        var months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        if ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) {
            months[2] = 29;
        }

        var gm = 0;
        while (gm < 13 && gd > months[gm]) {
            gd -= months[gm];
            gm++;
        }

        return [gy, gm, gd];
    }

    /**
     * «YYYY-MM-DD» میلادی → [jy, jm, jd]؛ اگر مقدار نامعتبر بود امروز را
     * برمی‌گرداند تا تقویم همیشه جایی برای باز شدن داشته باشد.
     */
    function toJalali(iso, fallbackIso) {
        var parts = String(iso || '').split('-');

        if (parts.length !== 3 || parts[0].length !== 4) {
            parts = String(fallbackIso || '').split('-');
        }

        if (parts.length !== 3 || parts[0].length !== 4) {
            var now = new Date();
            return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
        }

        return g2j(Number(parts[0]), Number(parts[1]), Number(parts[2]));
    }

    /**
     * [jy, jm, jd] → «YYYY-MM-DD» میلادی برای فِرم.
     */
    function toGregorian(jalali) {
        var g = j2g(jalali[0], jalali[1], jalali[2]);
        return g[0] + '-' + pad(g[1]) + '-' + pad(g[2]);
    }

    /**
     * [jy, jm, jd] → «۱۴۰۵/۰۷/۱۹» با ارقام فارسی برای نمایش.
     */
    function format(jalali) {
        return fa(jalali[0] + '/' + pad(jalali[1]) + '/' + pad(jalali[2]));
    }

    /**
     * تعداد روزهای یک ماه شمسی. ماه‌های ۱ تا ۱۱ ثابت‌اند (۳۱ و ۳۰)؛ روزهای
     * اسفند از فاصلهٔ دو فروردین به‌دست می‌آید تا لازم نباشد سال کبیسه را
     * جداگانه بشناسیم.
     */
    function daysInMonth(jy, jm) {
        if (jm <= 6) {
            return 31;
        }
        if (jm <= 11) {
            return 30;
        }

        var start = j2g(jy, 1, 1);
        var nextStart = j2g(jy + 1, 1, 1);
        var yearDays = Math.round(
            (Date.UTC(nextStart[0], nextStart[1] - 1, nextStart[2])
                - Date.UTC(start[0], start[1] - 1, start[2])) / 86400000
        );

        // ۶ ماه ۳۱ روزه + ۵ ماه ۳۰ روزه = ۳۳۶ روز تا پایان بهمن
        return yearDays - 336;
    }

    /**
     * روز هفتهٔ یک تاریخ شمسی؛ ۰ = شنبه ... ۶ = جمعه.
     */
    function weekdayOf(jy, jm, jd) {
        var g = j2g(jy, jm, jd);
        // Date.UTC: ۰ = یکشنبه ... ۶ = شنبه → شنبه باید صفر شود
        var dow = new Date(Date.UTC(g[0], g[1] - 1, g[2])).getUTCDay();
        return (dow + 1) % 7;
    }

    /* --------------------------------------------------------- رابط */

    var CHEVRON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<polyline points="9 6 15 12 9 18"></polyline></svg>';

    var CHEVRON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<polyline points="15 6 9 12 15 18"></polyline></svg>';

    function init() {
        var hidden = document.getElementById('panelDateInput');
        var trigger = document.getElementById('panelDateTrigger');
        var box = document.getElementById('panelJdp');

        if (!hidden || !trigger || !box || trigger.getAttribute('data-jdp-ready')) {
            return;
        }
        trigger.setAttribute('data-jdp-ready', '1');

        var todayIso = trigger.getAttribute('data-today') || '';
        var selected = toJalali(hidden.value, todayIso);
        var view = { jy: selected[0], jm: selected[1] };

        function render() {
            box.textContent = '';

            /* سربرگ: ماه قبل (راست) ← عنوان ← ماه بعد (چپ) */
            var head = el('div', 'jdp-head');

            var prev = el('button', 'jdp-nav');
            prev.type = 'button';
            prev.setAttribute('data-jdp-action', 'prev');
            prev.setAttribute('aria-label', 'ماه قبل');
            prev.innerHTML = CHEVRON_PREV;

            var title = el('span', 'jdp-title', fa(view.jy) + ' ' + MONTHS[view.jm - 1]);

            var next = el('button', 'jdp-nav');
            next.type = 'button';
            next.setAttribute('data-jdp-action', 'next');
            next.setAttribute('aria-label', 'ماه بعد');
            next.innerHTML = CHEVRON_NEXT;

            head.appendChild(prev);
            head.appendChild(title);
            head.appendChild(next);
            box.appendChild(head);

            /* شبکهٔ روزها */
            var grid = el('div', 'jdp-grid');

            for (var w = 0; w < WEEKDAYS.length; w++) {
                grid.appendChild(el('span', 'jdp-wd', WEEKDAYS[w]));
            }

            var lead = weekdayOf(view.jy, view.jm, 1);
            for (var blank = 0; blank < lead; blank++) {
                grid.appendChild(el('span', 'jdp-day is-empty'));
            }

            var todayJ = todayIso ? toJalali(todayIso) : null;
            var total = daysInMonth(view.jy, view.jm);

            for (var d = 1; d <= total; d++) {
                var cell = el('button', 'jdp-day', fa(d));
                cell.type = 'button';
                cell.setAttribute('data-jdp-action', 'day');
                cell.setAttribute('data-j-day', d);

                if (view.jy === selected[0] && view.jm === selected[1] && d === selected[2]) {
                    cell.classList.add('is-sel');
                }
                if (todayJ && view.jy === todayJ[0] && view.jm === todayJ[1] && d === todayJ[2]) {
                    cell.classList.add('is-today');
                }

                grid.appendChild(cell);
            }

            box.appendChild(grid);

            /* پاورقی: پرش به امروزِ واقعی */
            var foot = el('div', 'jdp-foot');

            var todayBtn = el('button', 'jdp-today', 'امروز');
            todayBtn.type = 'button';
            todayBtn.setAttribute('data-jdp-action', 'today');
            if (!todayIso) {
                todayBtn.disabled = true;
            }
            foot.appendChild(todayBtn);

            box.appendChild(foot);
        }

        function open() {
            var jalali = toJalali(hidden.value, todayIso);
            view = { jy: jalali[0], jm: jalali[1] };
            render();
            box.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
        }

        function close() {
            box.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }

        function select(jalali) {
            selected = jalali.slice();
            hidden.value = toGregorian(selected);
            trigger.textContent = format(selected);
            // تقویم می‌بندد اما منوی «تاریخ فعال» باز می‌ماند تا دکمهٔ
            // «فعال کردن این روز» در دسترس بماند.
            close();
        }

        /*
         * همهٔ کلیک‌ها با یک شنوندهٔ capture روی document انجام می‌شوند.
         *
         * دلیل: data-apiِ bootstrap (app.js) روی document یک شنوندهٔ capture
         * برای SELECTOR_FORM_CHILD = '.dropdown form' ثبت کرده که کلیکِ هر فرمِ
         * داخلِ منوی dropdown را هنگام عبور از document متوقف می‌کند. چون دکمه و
         * جعبهٔ تقویم داخلِ فرمِ «یک روز دقیق» هستند، کلیکِ آنها هرگز به خودِ
         * عناصر نمی‌رسد و شنوندهٔ معمولیِ روی trigger اجرا نمی‌شود (تقویم باز
         * نمی‌شد). شنوندهٔ captureِ خودِ document اما بعد از شنوندهٔ bootstrap
         * ثبت شده و stopPropagation معمولی مانع اجرای شنونده‌های همان گره نمی‌شود،
         * پس همچنان اجرا می‌شود. متوقفکردن propagation از همین‌جا هم باعث می‌شود
         * clearMenusِ bootstrap به منوی باز دست نزند.
         */
        document.addEventListener('click', function (event) {
            var target = event.target;

            if (!target) {
                return;
            }

            // کلیک روی خودِ دکمه (یا برچسبش که فعال‌سازی را به دکمه می‌فرستد)
            if (trigger.contains(target)
                || (target.tagName === 'LABEL' && target.getAttribute('for') === trigger.id)) {
                event.stopPropagation();
                if (target.tagName === 'LABEL') {
                    // تا مرورگر کلیکِ ارسالیِ دوم را هم اجرا نکند (toggle دوباره)
                    event.preventDefault();
                }
                if (box.hidden) {
                    open();
                } else {
                    close();
                }
                return;
            }

            // تعامل داخل تقویم (ماه قبل/بعد، روز، امروز)
            if (box.contains(target)) {
                // نباید منوی bootstrap بسته شود
                event.stopPropagation();

                var actionEl = target.closest ? target.closest('[data-jdp-action]') : null;
                if (!actionEl) {
                    return;
                }

                var action = actionEl.getAttribute('data-jdp-action');

                if (action === 'prev') {
                    view.jm--;
                    if (view.jm < 1) {
                        view.jm = 12;
                        view.jy--;
                    }
                    render();
                } else if (action === 'next') {
                    view.jm++;
                    if (view.jm > 12) {
                        view.jm = 1;
                        view.jy++;
                    }
                    render();
                } else if (action === 'day') {
                    select([view.jy, view.jm, Number(actionEl.getAttribute('data-j-day'))]);
                } else if (action === 'today' && todayIso) {
                    var today = toJalali(todayIso);
                    view = { jy: today[0], jm: today[1] };
                    select(today);
                }
                return;
            }

            // کلیک بیرون از تقویم (داخل یا بیرون منو) آن را می‌بندد
            if (!box.hidden) {
                close();
            }
        }, true);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !box.hidden) {
                close();
            }
        });

        // نمایش اولیهٔ دکمه همیشه با مقدار ورودی هماهنگ باشد
        trigger.textContent = format(selected);
    }

    root.JalaliDatePicker = api;

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (!root.document) {
        return;
    }

    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : this);
