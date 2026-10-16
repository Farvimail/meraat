/* تایمرِ پنل باید همان عددی را نشان بدهد که اپ نشان می‌دهد؛ پس هر دو باید
   یک حساب داشته باشند و مبنای آن حساب هم ساعتِ سرور باشد.

   سه چیز تایمرِ پنل را از اپ جدا می‌کرد:

   ۱) **حسابِ اشتباه.** پنل ثانیه‌های رکوردها را با علامت جمع می‌کرد
      (Σورود‌ها − Σخروج‌ها) و وقتی کارمند سرِ کار بود «ساعتِ الان منهای آن
      جمع» را می‌نوشت؛ یعنی عددی که به کارکرد ربطی نداشت. اپ این‌طور حساب
      می‌کند: هر «ورود» تا «خروجِ بعدی‌اش» و شیفتِ باز تا «الان». حالا پنل هم
      دقیقاً همین را می‌کند (`timerWorked`).
   ۲) **منطقهٔ زمانی و ساعتِ مرورگر.** ثانیه‌های رکوردها («9/7/2026, 08:00:00»)
      تاریخِ میلادی‌اند ولی بی‌منطقه؛ `new Date()` آن‌ها را به منطقهٔ سیستمِ
      بیننده می‌خواند. اینجا فقط ساعتِ روز خوانده می‌شود (کارکرد درونِ یک روزِ
      کاری است) و «الان» از هدر Date پاسخِ سرور می‌آید (`timerMeasureSkew`)،
      نه از ساعتِ لپ‌تاپِ بیننده.
   ۳) **تازگی.** ورود/خروجی که با گوشی ثبت می‌شود باید در پنل هم دیده شود؛
      قدیم‌تر پنل تا رفرشِ دستی روی عددِ لحظهٔ باز شدنِ صفحه می‌ماند. */
var TIMER_IRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
var timerClockSkew = 0;

/* ثانیهٔ روز از یک رکورد تایمر.

   رکوردِ سرور هم `date` دارد («9/7/2026, 08:00:00») و هم `time` («08:00:00»)؛
   هر دو را می‌خوانیم و از تاریخ فقط ساعتش را برمی‌داریم، چون جمعِ کارکرد
   درونِ یک روزِ کاری است و این‌طور منطقهٔ زمانی اصلاً واردِ حساب نمی‌شود. */
function timerSecondsOfDay(entry)
{
    if ( !entry )
        return null;

    let source = String(entry.time || entry.date || '');
    let match = /(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(source);

    if ( !match )
        return null;

    let hours = +match[1];
    let minutes = +match[2];
    let seconds = +(match[3] || 0);

    if ( hours > 23 || minutes > 59 || seconds > 59 )
        return null;

    return hours * 3600 + minutes * 60 + seconds;
}

/* ثانیه‌های کارکردِ امروز از رکوردهای خامِ سرور — همان قاعدهٔ اپ.

   هر «ورود» شیفتی را باز می‌کند و «خروج» می‌بندد؛ دو ورودِ پشت‌سرهم فقط
   دومی را باز نگه می‌دارد و خروجِ بی‌ورود نادیده می‌ماند — مثل `workedSeconds`
   در `mobile/src/lib/punch.ts`. خروجی:
     closed    → ثانیه‌های شیفت‌های بسته‌شده
     openSince → ثانیهٔ روزِ ورودی که هنوز بسته نشده (یا null)
     present   → همین حالا سرِ کار است؟ */
function timerWorked(data)
{
    let rows = [];

    try {
        rows = JSON.parse(data);
    } catch (error) {
        rows = [];
    }

    if ( !Array.isArray(rows) )
        rows = [];

    let punches = [];

    rows.forEach(function(row){
        if ( !row )
            return;

        let at = timerSecondsOfDay(row);

        if ( at === null )
            return;

        /* `start`/`pause` در بعضی مسیرها رشتهٔ «0»/«1» می‌آید و رشتهٔ «0» در
           JS راست است؛ پس مقایسه باید عددی باشد، وگرنه هر رکورد «ورود»
           شمرده می‌شود — همان اشتباهی که این تایمر را خراب کرده بود. */
        if ( Number(row.start) === 1 )
            punches.push({ at: at, start: true });
        else if ( Number(row.pause) === 1 )
            punches.push({ at: at, start: false });
    });

    /* ترتیبِ زمانی (نه ترتیبِ id): شیفت‌ها را زوج‌به‌زوج می‌بندیم. */
    punches.sort(function(a, b){ return a.at - b.at; });

    let closed = 0;
    let openSince = null;

    punches.forEach(function(punch){
        if ( punch.start )
        {
            openSince = punch.at;
            return;
        }

        if ( openSince === null )
            return;                 // خروجِ بی‌ورود

        let span = punch.at - openSince;

        if ( span > 0 )
            closed += span;

        openSince = null;
    });

    return { closed: closed, openSince: openSince, present: openSince !== null, rows: rows.length };
}

/* مجموع کارکرد تا لحظهٔ `nowSeconds` (ثانیهٔ روز، به وقت ایران). */
function timerElapsedSeconds(worked, nowSeconds)
{
    let total = worked.closed;

    if ( worked.openSince !== null )
    {
        let open = nowSeconds - worked.openSince;

        if ( open > 0 )
            total += open;
    }

    return total;
}

/* ثانیهٔ روزِ ایران از ساعتِ سرور (اختلافِ ساعتِ مرورگر با `skew` جبران می‌شود). */
function timerNowSeconds(skew)
{
    let now = Date.now() + (skew || 0) + TIMER_IRAN_OFFSET_MS;

    return Math.floor((now % 86400000) / 1000);
}

/* «HH : MM' : SS"» — همان قالبِ `digital-timer`. */
function timerFormat(seconds)
{
    if ( !(seconds > 0) )
        seconds = 0;

    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let rest = Math.floor(seconds % 60);

    hours < 10 ? hours = '0' + hours : null;
    minutes < 10 ? minutes = '0' + minutes : null;
    rest < 10 ? rest = '0' + rest : null;

    return hours + " : " + minutes + "' : " + rest + '"';
}

/* ساعتِ سرور چند میلی‌ثانیه از ساعتِ این مرورگر جلو/عقب است؟
   «الان»ِ تایمر از همین‌جا می‌آید: عددی که مدیر می‌بیند نباید به ساعتِ
   لپ‌تاپِ بیننده وابسته باشد. */
function timerMeasureSkew(xhr)
{
    let header = ( xhr && xhr.getResponseHeader ) ? xhr.getResponseHeader('Date') : null;

    if ( header )
    {
        let serverNow = Date.parse(header); // هدر Date همیشه GMT است

        if ( !isNaN(serverNow) )
            timerClockSkew = serverNow - Date.now();
    }

    return timerClockSkew;
}

function ToastQ(cname)
{
    var toastElList = [].slice.call(document.querySelectorAll('.'+cname))
    var toastList = toastElList.map(function (toastEl) {
        return new bootstrap.Toast(toastEl, 'show')
    });
    return toastList;
}

ToastQ('php-toast').forEach( b=> {
    b.show();
});

$('.toast-header span[aria-hidden="true"]').click(function(e){
    $elm = $(this).parent().parent().parent();
    [].slice.call($elm).map( e => new bootstrap.Toast(e,'hide') )[0].hide();
});

function delToast(model, timeOut)
{
    setTimeout( () =>{
        Array.from(document.querySelectorAll(`.${model}`)).forEach( d =>{
            d.remove();
        })
    }, timeOut)
}

function newToast(title, desc, model, brand, fill, delay, target)
{
    let div_toast = document.createElement('div');
    div_toast.className = "toast fade";
    div_toast.classList.add(model);
    div_toast.role = "alert";
    div_toast.setAttribute('role','alert');
    div_toast.setAttribute('aria-live','assertive');
    div_toast.setAttribute('aria-atomic','true');
    div_toast.setAttribute('data-animation','true');
    div_toast.setAttribute('data-delay',delay);

    let toast_header = document.createElement('div');
    toast_header.className = "toast-header";

    let svg = document.createElement('svg');
    svg.className = "bd-placeholder-img rounded me-2";
    svg.setAttribute('width','20');
    svg.setAttribute('height','20');
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('preserveAspectRatio','xMidYMid slice');
    svg.setAttribute('focusable','false');

    let svg_rect = document.createElement('rect');
    svg_rect.setAttribute('width','100%');
    svg_rect.setAttribute('height','100%');
    svg_rect.setAttribute('fill',fill);

    svg.appendChild(svg_rect);

    let strong = document.createElement('strong');
    strong.className = "mr-auto";
    strong.innerText = title;

    let small = document.createElement('small');
    small.innerText = brand;

    toast_header.appendChild(svg);
    toast_header.appendChild(strong);
    toast_header.appendChild(small);

    let button = document.createElement('button');
    button.type = 'button';
    button.className = 'ml-2 mb-1 close';
    button.setAttribute('data-dismiss','toast');
    button.setAttribute('aria-label','Close');

    let button_span = document.createElement('span');
    button_span.setAttribute('aria-hidden','true');
    button_span.innerText = "×";

    button.appendChild(button_span);
    toast_header.appendChild(button);

    div_toast.appendChild(toast_header);

    var toast_body = document.createElement('div');
    toast_body.className = "toast-body";
    toast_body.innerText = desc;

    div_toast.appendChild(toast_body);
    $(`.${target}`)
        .prepend(div_toast);
}


function e2p(n) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    return n
        .toString()
        .replace(/\d/g, x => farsiDigits[x]);
}

/* نمایشِ «زمان سپری شده» روی کارتِ یک کارمند.

   `worked` خروجیِ `timerWorked` است: شیفت‌های بسته‌شده + شیفتِ باز (اگر
   باشد). شیفتِ باز هر ثانیه یک قدم جلو می‌رود و به محضِ ثبتِ خروج (که رفرشِ
   دوره‌ای به پنل می‌رساند) روی عددِ ثابتِ نهایی می‌ایستد. */
function Interval(variable, worked, target, skew)
{
    // تایمرِ قبلیِ همین کارمند را خاموش کن؛ وگرنه با هر رفرشِ دوره‌ای یک
    // setInterval دیگر روی همان عدد می‌نویسد و عدد بی‌دلیل می‌پرد.
    if ( window[variable] )
    {
        clearInterval(window[variable]);
        window[variable] = null;
    }

    function CustomerTimer()
    {
        let element = document.querySelector(target);

        if ( !element )
        {
            clearInterval(window[variable]);
            window[variable] = null;
            return;
        }

        element.innerHTML = e2p(timerFormat(timerElapsedSeconds(worked, timerNowSeconds(skew))));
    }

    CustomerTimer();

    // قدم‌شمار فقط وقتی لازم است که شیفت هنوز باز باشد.
    if ( worked.openSince !== null )
        window[variable] = setInterval(CustomerTimer, 1000);

}

function finishTime(body)
{
    return {
        body: body,
        icon: "/images/arm.jpg",
        image: "https://th.bing.com/th/id/OIP.fVzdKE2EPZzB5PiI1pvaFQHaHa?pid=ImgDet&rs=1",
        silent: false,
    }

}

//new Notification("خانم سمیه غلامرضایی",finishTime("تایم کاری امروز شما به"))

/* تیتر توست‌های تایمر همیشه نام کاربر را هم دارد تا در صفحهٔ چند‌نفره مشخص
   باشد پیام مربوط به کدام همکار است. */
function timerTitle(base, name)
{
    return (name && name.length) ? base + ' — ' + name : base;
}

/* هر چند وقت یک‌بار رکوردهای امروز دوباره خوانده شود؟ ورود/خروجی که با گوشی
   ثبت می‌شود باید در پنل هم دیده شود؛ وگرنه تایمرِ پنل تا رفرشِ دستی روی همان
   مقداری می‌ماند که لحظهٔ باز شدنِ صفحه بوده — و همین باعث می‌شود مدیر عددی
   ببیند که با اپ یکی نیست.

   این بازه ثابت نیست و به وضعیتِ همان روز بسته است (`timerNextDelay`):
   شیفتِ **باز** → ۱۵ ثانیه (ثبتِ بعدی احتمالاً همین حالا با گوشی می‌آید)،
   شیفتِ **بسته** → ۶۰ ثانیه (چیزی برای عوض شدن نیست)، و **تبِ پنهان** →
   ۲ دقیقه (کسی که نگاه نمی‌کند، هزینهٔ درخواست را هم نمی‌دهد). قدم‌شمارِ هر
   ثانیه در همین مرورگر اجرا می‌شود؛ این درخواست‌ها فقط برای ثبت‌هایی است که
   از گوشی می‌آید — ثبت از خودِ پنل همان کارت را بلافاصله به‌روز می‌کند. */
var TIMER_REFRESH_MS = 60000;

/* شیفتِ باز: کوتاه‌تر. ثبتِ بعدی احتمالاً همین حالا با گوشی انجام می‌شود و
   مدیر به عددی که ۲۰ ثانیه عقب باشد نگاه می‌کند؛ ولی شیفتِ بسته یا روزِ
   تعطیل دلیلی برای پرسیدنِ هر ربع دقیقه وجود ندارد. */
var TIMER_REFRESH_OPEN_MS = 15000;

/* تبِ پنهان: صفحه دیده نمی‌شود، پس فقط برای اینکه در برگشت عدد کهنه نباشد
   یک تازه‌سازیِ تنبل نگه می‌داریم — خودِ `visibilitychange` هم زودتر تازه
   می‌کند. */
var TIMER_REFRESH_HIDDEN_MS = 120000;

/*
 * زنجیرهٔ تازه‌سازیِ هر کارمند.
 *
 * قبلاً هر فراخوانیِ `runTimer` یک `setTimeout` تازه می‌کاشت و هیچ‌جا نگه
 * نمی‌داشت که کدام زنده است؛ با هر بار صدا زدنِ دستی یا برگشتنِ تب، چند
 * زنجیرهٔ موازی روی همان کارمند راه می‌افتاد و درخواست‌ها ضرب می‌شد. حالا
 * کلید → {name, timeout, open} نگه داشته می‌شود و همیشه قبل از کاشتنِ
 * زنجیرهٔ تازه، زنجیرهٔ قبلی همان کارمند قطع می‌شود.
 */
var timerWatching = {};

/*
 * «دیدن» یک کارمندِ بی‌ثبت — بدون هیچ درخواستی.
 *
 * کارمندی که امروز هنوز ورودی نزده، عددش صفر است و چیزی برای خواندن ندارد؛
 * ولی باید در فهرستِ نگهبان باشد تا **اولین** ثبتِ گوشی‌اش کارتش را بخواند.
 * قبلاً برای این کارمندان اصلاً `runTimer` صدا زده نمی‌شد (بلید فقط وقتی
 * رکوردی بود صدا می‌زد) و نتیجه‌اش این بود که اولین ورودِ روز در پنل تا
 * رفرشِ دستی دیده نمی‌شد.
 *
 * مبنای «صفر» همان چیزی است که سرور هنگام رسمِ صفحه گفته: روزِ خالی یعنی
 * `"0:0"`. با همین مبنا اولین پاسخِ نگهبان تغییری نمی‌بیند و درخواستِ
 * بیهوده نمی‌رود؛ به‌محضِ رسیدنِ اولین رکورد، عدد عوض می‌شود و کارت خوانده
 * می‌شود.
 */
function watchTimer(id, name)
{
    let watch = timerWatching[id] || (timerWatching[id] = { name: name, timeout: null, open: false });

    if ( name )
        watch.name = name;

    if ( watch.revision === undefined )
        watch.revision = '0:0';

    // کارتِ تازه به فهرستِ زیرِ نظرِ هاب هم می‌رود؛ چون کانالِ زنده همین
    // فهرست را می‌خواند و اگر نداند چه کسی را نگه می‌دارد، ثبتِ گوشی را به
    // هیچ‌کس نمی‌رساند.
    timerHubSendWatch();
}

function timerNextDelay(open)
{
    if ( typeof document !== 'undefined' && document.hidden )
        return TIMER_REFRESH_HIDDEN_MS;

    return open ? TIMER_REFRESH_OPEN_MS : TIMER_REFRESH_MS;
}

/* `open` اختیاری است: ندادنش یعنی «وضعیتِ قبلی را نگه دار» — همان کاری که
   مسیرِ خطا لازم دارد تا با یک درخواستِ رد‌شده چرخه را تندتر نکند. */
function scheduleTimerRefresh(id, name, open)
{
    let watch = timerWatching[id] || (timerWatching[id] = { name: name, timeout: null, open: false });

    if ( name )
        watch.name = name;

    if ( typeof open === 'boolean' )
        watch.open = open;

    if ( watch.timeout )
    {
        clearTimeout(watch.timeout);
        watch.timeout = null;
    }

    watch.timeout = setTimeout(function(){
        watch.timeout = null;
        runTimer(id, watch.name, true);
    }, timerNextDelay(watch.open));
}

/* تب دوباره دیده شد: انتظارِ بلندِ «تب پنهان» را قطع کن و همین حالا تازه کن.
   بدون این، مدیری که تب را چند دقیقه کنار گذاشته اول عددِ قدیمی را می‌دید. */
function refreshTimersNow()
{
    Object.keys(timerWatching).forEach(function(id){
        let watch = timerWatching[id];

        if ( watch.timeout )
        {
            clearTimeout(watch.timeout);
            watch.timeout = null;
        }

        runTimer(id, watch.name, true);
    });
}

/*
 * تازه‌سازیِ «زنده» با یک درخواستِ سبک برای همهٔ کارت‌ها.
 *
 * مشکل: تازه‌سازیِ خودِ هر کارت وقتی شیفتَ بسته است یک دقیقه‌ای یک‌بار است؛
 * پس اگر کارمندی همین حالا با گوشی ورود بزند، پنل تا یک دقیقه عددِ قدیمی را
 * نشان می‌دهد و کاربر فکر می‌کند «هیچ چیز لایو نیست». کوتاه‌کردنِ آن بازه به
 * ۱۰ ثانیه هم راه‌حل نبود: صفحه‌ای با ۳۰ کارمند ۳ درخواست در ثانیه می‌فرستاد.
 *
 * راه‌حل: یک درخواستِ جمعیِ جمع‌زده (`/read/timer-revision`) که فقط می‌گوید
 * کدام کارمند عوض شده؛ بعد فقط همان کارت، رکوردهایش را میخواند. با هر تعداد
 * کارمند، هزینه ثابت و کم می‌ماند.
 *
 * فاصله‌اش عمداً یک ثانیه است: ثبتِ گوشی باید «همان لحظه» در پنل دیده شود، نه
 * چند ثانیه بعد. هزینه‌اش هم یک درخواستِ کوچک در ثانیه است (یک کوئریِ
 * جمع‌زده)، نه یک درخواست برای هر کارت — همان چیزی که نسخهٔ ۱۰ ثانیه‌ای
 * نگرانش بود.
 *
 * چرا «نگه‌داشتنِ اتصال» (long-poll/SSE) انتخاب نشد: روی php-fpm هر تبِ بازِ
 * پنل تا پایانِ همان اتصال یک کارگر را اشغال می‌کند و درخواستِ طولانی در
 * پایان، نسخهٔ کهنهٔ نشست را می‌نویسد (رقابت با تغییرِ «تاریخ فعال سامانه»).
 * هزینهٔ این یک درخواستِ کوچک از هر دوی این‌ها کمتر است.
 */
var TIMER_REVISION_MS = 1000;
var TIMER_REVISION_HIDDEN_MS = 120000;

var timerRevisionTimer = null;
/* اگر مسیرِ سبک روی این سرور نباشد (نسخهٔ قدیمیِ کد)، بی‌دلیل در هر ثانیه
   درخواستِ ناموفق نمی‌فرستیم؛ همان تازه‌سازیِ هر کارت کافی است. */
var timerRevisionSupported = true;

function stopTimerRevisions()
{
    if ( timerRevisionTimer )
    {
        clearTimeout(timerRevisionTimer);
        timerRevisionTimer = null;
    }
}

function startTimerRevisions()
{
    stopTimerRevisions();

    if ( !timerRevisionSupported )
        return;

    let delay = timerRevisionDelay();

    timerRevisionTimer = setTimeout(function(){
        timerRevisionTimer = null;
        checkTimerRevisions();
    }, delay);
}

function checkTimerRevisions()
{
    let ids = Object.keys(timerWatching);

    if ( !ids.length )
    {
        startTimerRevisions();
        return;
    }

    $.ajax({
        url: '/read/timer-revision',
        method: 'get',
        data: { ids: ids },
        success: function(data){
            let map = {};

            try {
                map = JSON.parse(data) || {};
            } catch (error) {
                map = {};
            }

            ids.forEach(function(id){
                let watch = timerWatching[id];
                let revision = map[id];

                if ( revision === undefined )
                    return;

                // اولین بار: خطِ مبنا را می‌گیریم و یک بار همان کارت را
                // می‌خوانیم تا عدد با رکوردهای واقعی هم‌خوان شود.
                let changed = watch.revision === undefined || watch.revision !== revision;

                watch.revision = revision;

                if ( changed )
                    runTimer(id, watch.name, true);
            });
        },
        error: function(){
            // مسیرِ سبک در دسترس نیست: خاموشش کن تا درخواستِ تکراری نرود؛
            // تازه‌سازیِ هر کارت (`scheduleTimerRefresh`) کار را ادامه می‌دهد.
            timerRevisionSupported = false;
        },
        complete: function(){
            startTimerRevisions();
        }
    });
}

if ( typeof document !== 'undefined' && document.addEventListener )
{
    document.addEventListener('visibilitychange', function(){
        if ( !document.hidden )
        {
            refreshTimersNow();
            startTimerRevisions();
        }
        else
        {
            // تب پنهان: چرخهٔ کوتاه کنار برود و فقط نگهبانِ تنبل بماند.
            startTimerRevisions();
        }
    });
}

/*
 * نگهبانِ سبک چطور روشن می‌شود؟
 *
 * خودش هر ثانیه `checkTimerRevisions` را صدا می‌زند. شروعش را به پایانِ
 * بارگذاریِ صفحه گره می‌زنیم: اولین تیکِ نگهبان برای هر کارتی که امروز رکورد
 * دارد یک بار رکوردها را دوباره می‌خواند (تثبیتِ خطِ مبنا) و اگر همان لحظهٔ
 * بارگذاریِ تصویرها و اسکریپت‌ها باشد، درخواست‌ها پشتِ هم می‌مانند و رنگِ
 * صفحه دیرتر می‌آید. بعد از `load` صفحه آرام است و این یک بار هزینه هم
 * دیده نمی‌شود.
 */
function startTimerRevisionsWhenReady()
{
    if ( typeof document !== 'undefined' &&
         document.readyState &&
         document.readyState !== 'complete' &&
         typeof window !== 'undefined' &&
         window.addEventListener )
    {
        window.addEventListener('load', startTimerRevisions, { once: true });
        return;
    }

    startTimerRevisions();
}

if ( typeof document !== 'undefined' )
{
    setTimeout(startTimerRevisionsWhenReady, TIMER_REVISION_MS);

    // کانالِ زنده همان لحظهٔ باز شدنِ صفحه وصل می‌شود تا اگر همین یک ثانیه
    // هم کسی با گوشی ثبت کرده باشد، همان اول دیده شود. وصل نشدن بی‌اهمیت
    // است: نگهبانِ دوره‌ای مثل قبل سر جایش می‌ماند.
    setTimeout(timerHubConnect, 0);
}

/*
 * کانالِ زنده (WebSocket) — چرا درخواستِ ثانیه‌ای حذف نشده است؟
 *
 * نگهبانِ دوره‌ای می‌فهمد «چه کسی عوض شده» ولی نمی‌تواند «همین حالا» بگوید:
 * ثبتِ گوشی تا نوبتِ بعدیِ درخواست دیده نمی‌شد. هابِ `ws/timer-hub.mjs` این
 * کار را با هل دادنِ پیام می‌کند: سرور بعد از نوشتنِ رکورد به هاب می‌گوید و
 * هاب همان لحظه به همین سوکت می‌گوید «کارمندِ ۱۲ عوض شد»؛ پنل فقط همان کارت
 * را می‌خواند. هزینه: یک درخواستِ محدود، فقط وقتی واقعاً ثبتی انجام شده باشد.
 *
 * چرا نگهبانِ دوره‌ای هم باقی است: سوکت ممکن است قطع شود، پیامِ نرسیده را
 * هیچ‌کس جبران نمی‌کند، و اگر پشتِ هاست وبسایتِ دیگری وصل می‌شوید، باید
 * خرابیِ هاب بی‌صدا و بی‌خسارت باشد. پس وقتی کانالِ زنده باز است، نگهبانِ
 * دوره‌ای آرام می‌شود (هر ۳۰ ثانیه یک‌بار، فقط برای اطمینان) و وقتی قطع است
 * به همان روالِ همیشگیِ پیشین برمی‌گردد. یعنی چیزی «ترک نمی‌شود»، فقط کمتر
 * تکرار می‌شود.
 *
 * اگر `WebSocket` در دسترس نباشد (مرورگر خیلی قدیمی) یا `/ws` پاسخ ندهد،
 * همین چند خط بی‌اثرند و پنل دقیقاً مثل قبل کار می‌کند.
 */
var timerHubSocket = null;
var timerHubRetry = 0;
var timerHubRetryTimer = null;

/* گوشِ دوره‌ای وقتی کانال زنده است شبکهٔ ایمنی است، نه روش اصلی. */
var TIMER_REVISION_CONNECTED_MS = 30000;

function timerHubOpen()
{
    return !!timerHubSocket && timerHubSocket.readyState === 1;
}

/*
 * چیپِ وضعیتِ کانال در نوار بالای پنل — «زنده» یا «دورهای» و تعداد پنل‌های باز.
 *
 * چرا روی صفحه لازم است: تا وقتی کسی نمی‌بیند که سوکت باز است یا نه،
 * «همان‌لحظه‌ای بودنِ» عددها یک ادعاست. با این چیپ، مدیری که به دیدهٔ خودش
 * اطمینان می‌خواهد، یک نگاه می‌کند: سبزِ «زنده» یعنی کانال باز است،
 * خاکستریِ «دورهای» یعنی مرورگر سوکت نگرفته و پنل با همان درخواست‌های
 * دوره‌ای کار می‌کند (چیزی خراب نیست، فقط کندتر).
 *
 * عددِ «چند پنل» را هاب با پیامِ `peers` می‌فرستد، پس برای نمایشش **هیچ
 * درخواستِ اضافه‌ای** نمی‌رود — همان چیزی که این کانال برای حذفش ساخته شد.
 * در حالتِ دوره‌ای عدد پاک می‌شود: هاب در دسترس نیست، پس عددی هم برای گفتن
 * نیست و نگه‌داشتنِ عددِ کهنه گمراه‌کننده است.
 *
 * مارک‌آپ را بلید می‌گذارد؛ اینجا فقط متن و رنگ عوض می‌شود. چند چیپ هم که
 * باشد همه به‌روز می‌شوند و نبودنشان بی‌اثر است.
 */
var timerHubPeers = null;

function timerHubChips()
{
    if ( typeof document === 'undefined' || !document.querySelectorAll )
        return [];

    return Array.prototype.slice.call(document.querySelectorAll('[data-timer-hub-status]'));
}

function timerHubPaintStatus()
{
    let live = timerHubOpen();

    timerHubChips().forEach(function(chip){
        chip.setAttribute('data-state', live ? 'live' : 'polling');

        let label = chip.querySelector ? chip.querySelector('[data-timer-hub-label]') : null;
        let peers = chip.querySelector ? chip.querySelector('[data-timer-hub-peers]') : null;

        if ( label )
            label.textContent = live ? 'زنده' : 'دوره‌ای';

        if ( peers )
            peers.textContent = live && timerHubPeers !== null
                ? ' · ' + e2p(timerHubPeers) + ' پنل'
                : '';
    });
}

/*
 * اولین رنگ‌آمیزی.
 *
 * `timerHubConnect` همین اولِ بارگذاری صدا زده می‌شود، ولی نوار بالا هنوز
 * پارس نشده است؛ و اگر سوکت پیش از پارس شدنِ نوار باز شود، `onopen` هیچ
 * چیپی برای رنگ‌کردن پیدا نمی‌کند و چیپ تا رویدادِ بعدی «دوره‌ای» می‌ماند.
 * پس یک رنگ‌آمیزیِ دیگر هم به پایانِ بارگذاری گره می‌خورد — همان کاری که
 * نگهبانِ دوره‌ای می‌کند.
 */
function timerHubPaintWhenReady()
{
    if ( typeof document !== 'undefined' &&
         document.readyState &&
         document.readyState !== 'complete' &&
         typeof window !== 'undefined' &&
         window.addEventListener )
    {
        window.addEventListener('load', timerHubPaintStatus, { once: true });
        return;
    }

    timerHubPaintStatus();
}

function timerRevisionDelay()
{
    if ( typeof document !== 'undefined' && document.hidden )
        return TIMER_REVISION_HIDDEN_MS;

    return timerHubOpen() ? TIMER_REVISION_CONNECTED_MS : TIMER_REVISION_MS;
}

/* فهرستِ کارت‌های همین صفحه را به هاب می‌گوییم. */
function timerHubSendWatch()
{
    if ( !timerHubOpen() )
        return;

    try {
        timerHubSocket.send(JSON.stringify({
            type: 'watch',
            ids: Object.keys(timerWatching)
        }));
    } catch (error) {
        // سوکتِ در حالِ بسته شدن؛ `onclose` خودش اتصالِ دوباره را می‌چیند.
    }
}

function timerHubRetryLater()
{
    if ( timerHubRetryTimer )
        return;

    // ۱، ۲، ۴، ۸، ۱۵ ثانیه — هرگز بی‌پایان نمی‌تازد و اگر هاب پایین باشد
    // درخواستِ بی‌دلیل روی هاست رها نمی‌کند.
    let delay = Math.min(15000, 1000 * Math.pow(2, timerHubRetry));
    timerHubRetry++;

    timerHubRetryTimer = setTimeout(function(){
        timerHubRetryTimer = null;
        timerHubConnect();
    }, delay);
}

function timerHubConnect()
{
    if ( typeof WebSocket === 'undefined' || typeof location === 'undefined' || !location.host )
        return;

    if ( timerHubSocket && (timerHubSocket.readyState === 0 || timerHubSocket.readyState === 1) )
        return;

    let url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let socket;

    try {
        socket = new WebSocket(url);
    } catch (error) {
        timerHubRetryLater();
        return;
    }

    timerHubSocket = socket;

    socket.onopen = function(){
        timerHubRetry = 0;
        timerHubSendWatch();
        timerHubPaintStatus();
    };

    socket.onmessage = function(event){
        let message = null;

        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return; // پیامِ خراب: نادیده؛ نباید گوشِ دوره‌ای را هم از کار بیندازد.
        }

        if ( !message || typeof message !== 'object' )
            return;

        if ( message.type === 'ping' ) {
            try {
                socket.send(JSON.stringify({ type: 'pong' }));
            } catch (error) {}
            return;
        }

        // تعدادِ پنل‌های باز: هاب خودش خبر می‌دهد، پس عدد همیشه تازه است.
        if ( message.type === 'peers' ) {
            timerHubPeers = Number(message.count) || 0;
            timerHubPaintStatus();
            return;
        }

        if ( message.type === 'ready' ) {
            if ( message.clients !== undefined )
                timerHubPeers = Number(message.clients) || 0;

            timerHubPaintStatus();
            return;
        }

        if ( message.type !== 'change' || message.id === undefined )
            return;

        let watch = timerWatching[message.id];

        if ( !watch )
            return;

        // همان کاری که نگهبانِ دوره‌ای می‌کرد، فقط بی‌درنگ و فقط برای همین کارت.
        runTimer(message.id, watch.name, true);
    };

    socket.onerror = function(){
        // `onclose` همیشه می‌آید؛ اتصالِ دوباره همان‌جا انجام می‌شود.
    };

    socket.onclose = function(){
        if ( timerHubSocket === socket )
            timerHubSocket = null;

        // چیپ باید همان لحظه به «دورهای» برگردد؛ نه اینکه تا وصل شدنِ
        // دوباره سبز بماند و به کاربر دروغ بگوید.
        timerHubPaintStatus();

        timerHubRetryLater();
    };
}

if ( typeof window !== 'undefined' && window.addEventListener )
{
    // تبِ پنهان سوکت را نگه می‌دارد؛ برگشتن فقط بررسیِ فوری می‌خواهد، نه وصل
    // شدنِ دوباره (بسیاری از مرورگرها تبِ خفته را به‌کُندی قطع می‌کنند).
    window.addEventListener('online', function(){
        timerHubRetry = 0;
        timerHubConnect();
    });
}

timerHubPaintWhenReady();

function runTimer(id, name, quiet)
{
    quiet = quiet === true;
    name = name || '';

    $.ajax({
        url: "/read/timer",
        method: 'get',
        data: {
            _token: $('meta[name="csrf-token"]').attr('content'),
            id: id
        },
        beforeSend: function( xhr ) {
            console.log('timer loading..');
        },
        success: function(data, textStatus, xhr) {
            timerMeasureSkew(xhr);

            let worked = timerWorked(data);

            // شیفتِ باز یعنی احتمالِ ثبتِ تازه از گوشی؛ همان حالت چرخهٔ تندتر
            // می‌گیرد. (وقتی کارمندی این صفحه را باز ندارد، هیچ درخواستی هم
            // نیست — نه فقط درخواستِ کم.)
            //
            // روزی که هنوز هیچ رکوردی ندارد: نه عددی هست که کهنه شود، نه
            // چیزی برای عوض شدن؛ نگهبانِ یک‌ثانیه‌ای خودش اولین ثبت را
            // می‌بیند. پس برای هر کارمندِ بی‌ثبت زنجیرهٔ بی‌هوده کاشته نمی‌شود
            // — مگر اینکه خودِ آن نگهبان در دسترس نباشد (نسخهٔ قدیمیِ کد) که
            // آن‌وقت همین زنجیره تنها راهِ دیدنِ ثبتِ تازه است.
            if ( worked.rows > 0 || !timerRevisionSupported )
                scheduleTimerRefresh(id, name, worked.present);

            if ( !quiet ){
            ToastQ('php-toast').forEach( b=> {
                b.show();
            });
            }
            if ( JSON.parse(data).toString() != [] ){
            console.log("Success: "+xhr.status);
            Interval("dt"+id,
                worked,
                ".digital-timer-"+id,
                timerClockSkew);
            if ( !quiet ){
            /* create Toast */
            newToast(timerTitle('دریافت اطلاعات', name),
                'اطلاعات تایمر ' + (name || 'کاربر') + ' دریافت شد.',
                'ajax-success',
                'Mgh-App',
                '#08b100',
                '2000',
                'toasts-stack');
            /* show Toast */
            ToastQ('ajax-success').forEach( b=> {
                b.show();
            });
            /* delete Toast */
            delToast('ajax-success','3000');
            }
            }
        },
        complete: function(xhr, textStatus) {
            console.log("Complete: "+xhr.status);
        }
    })
    .done(function( data ) {
        if ( !quiet && console && console.log && data.toString() != [] ) {
            /* create Toast */
            newToast(timerTitle('راه اندازی تایمر', name),
                'تایمر ' + (name || 'کاربر') + ' راه اندازی شد.',
                'ajax-done',
                'Mgh-App',
                '#007aff',
                '2000',
                'toasts-stack');
            /* show Toast */
            ToastQ('ajax-done').forEach( b=> {
                b.show();
            });
            /* delete Toast */
            delToast('ajax-done','3000');
        }
    })

        .fail(function( jqXHR, textStatus ) {
            console.error( "Request failed: " + textStatus );
            scheduleTimerRefresh(id, name);
            if ( quiet ) return;
            /* create Toast */
            newToast(timerTitle('اشکال در تایمر', name),
                'اشکال در انجام عمل به وجود آمده است '+textStatus,
                'ajax-fail',
                'Mgh-App',
                '#007aff',
                '2000',
                'toasts-stack');
            /* show Toast */
            ToastQ('ajax-fail').forEach( b=> {
                b.show();
            });
            /* delete Toast */
            delToast('ajax-fail','3000');
        });
}

    $.ajaxSetup({
            headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    $(document).ready(function(e){
        $(document).on('change','input[id^="inputGroupFile"]',function(e) {
            e.preventDefault();
            var target = $(this);
            let id = target.attr('id');
            id = id.substring(id.lastIndexOf('e')+1);
            var property = this.files[0];
            let form_data = new FormData();
            form_data.append('cid', id);
            form_data.append("file", property);
            console.log(property);
            $.ajax({
                type:'POST',
                url: `/upload/ajax`,
                data: form_data,
                contentType: false,
                processData: false,
                success: (response) => {
                    if (response) {
                    //this.reset();
                    newToast('بارگذاری انجام شد',
                        'تصویر مورد نظر شما با موفقیت در اپلیکیشن بارگذاری شد',
                        'ajax-done',
                        'Mgh-App',
                        '#007aff',
                        '2000',
                        'toasts-stack');
                    /* show Toast */
                    ToastQ('ajax-done').forEach( b=> {
                        b.show();
                    });
                    /* delete Toast */
                    delToast('ajax-done','3000');
                    target.parent().parent()[0]
                        .getElementsByTagName("img")[0]
                        .src = response;
                }
            },
                error: function(response){
                    console.log(response);
                    newToast('خطا در بارگذاری!',
                        'در بارگذاری تصویر مورد نظر شما در اپلیکیشن مشکلی پیش آمده است',
                        'ajax-fail',
                        'Mgh-App',
                        '#007aff',
                        '2000',
                        'toasts-stack');
                    /* show Toast */
                    ToastQ('ajax-fail').forEach( b=> {
                        b.show();
                    });
                    /* delete Toast */
                    delToast('ajax-fail','3000');
                }
            });
        });

        $(document).on('click','button[id^="inputGroupFileAddon"]',function(e){
            e.preventDefault();
            var target = $(this);
            let id = target.attr('id');
            id = id.substring(id.lastIndexOf('n')+1);

            $.ajax({
                url: '/delete/ajax',
                method: 'GET',
                data: {
                    _token: $('meta[name="csrf-token"]').attr('content'),
                    cid: id
                },
                success: (response) => {
                    if (response) {
                    //this.reset();
                    newToast('حذف تصویر با موفقیت انجام شد',
                        'تصویر مورد نظر شما با موفقیت حذف شد',
                        'ajax-done',
                        'Mgh-App',
                        '#007aff',
                        '2000',
                        'toasts-stack');
                    /* show Toast */
                    ToastQ('ajax-done').forEach( b=> {
                        b.show();
                    });
                    /* delete Toast */
                    delToast('ajax-done','3000');
                    target.parent().parent()[0]
                        .getElementsByTagName("img")[0]
                        .src = 'images/users/PRP.jpg';
                }
            },
                error: function(response){
                    console.log(response);
                    newToast('خطا در بارگذاری!',
                        'در بارگذاری تصویر مورد نظر شما در اپلیکیشن مشکلی پیش آمده است',
                        'ajax-fail',
                        'Mgh-App',
                        '#007aff',
                        '2000',
                        'toasts-stack');
                    /* show Toast */
                    ToastQ('ajax-fail').forEach( b=> {
                        b.show();
                    });
                    /* delete Toast */
                    delToast('ajax-fail','3000');
                }
            });
        });
    });







