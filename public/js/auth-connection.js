/* صفحهٔ ورود وقتی اینترنت نیست.

   فرمِ ورود یک فرمِ سروری است. بدون این کد، اگر کاربر اینترنت نداشته باشد بعد از
   زدنِ «ورود» مرورگر یک صفحهٔ خطای انگلیسی نشان می‌دهد و همان چیزی که تایپ کرده
   هم از دست می‌رود. اینجا پیش از فرستادنِ فرم یک تستِ کوتاه (HEAD) به خودِ سرور
   می‌زنیم:

     • پاسخ آمد   → فرم مثل قبل به سرور پست می‌شود (همهٔ اعتبارسنجی‌ها سروری است).
     • پاسخ نیامد → کارتِ «اتصال به سرور برقرار نیست» با دکمهٔ «تلاش دوباره»
       ظاهر می‌شود، هر چند ثانیه خودش دوباره تلاش می‌کند، ورودی‌ها سرِ جایشان
       می‌مانند و به‌محضِ برگشتنِ اتصال همان درخواستِ معلق ادامه پیدا می‌کند.

   بدون جاوااسکریپت هیچ‌چیز عوض نمی‌شود: کارت به‌صورت `hidden` در HTML است و
   فرم همان مسیرِ قبلی‌اش را می‌رود. همین تابعِ `createAuthConnection` را تستِ
   مرورگرِ شبیه‌سازی‌شده با fakeها صدا می‌زند (`mobile/src/lib/__tests__`). */

var AUTH_CONNECTION_RETRY_MS = 5000;
var AUTH_CONNECTION_PING_TIMEOUT_MS = 6000;

/* خروجی: { check: function, stop: function, state: function } */
function createAuthConnection(options)
{
    var form = options.form || null;
    var submitButton = options.submitButton || null;
    var card = options.card || null;
    var note = options.note || null;
    var retryButton = options.retryButton || null;
    var win = options.window || null;
    var doFetch = options.fetch;
    var url = options.url;
    var isOnline = options.isOnline || function(){ return true; };
    var setTimer = options.setTimer || setTimeout;
    var clearTimer = options.clearTimer || clearTimeout;
    var retryMs = options.retryMs || AUTH_CONNECTION_RETRY_MS;
    var pingTimeoutMs = options.pingTimeoutMs || AUTH_CONNECTION_PING_TIMEOUT_MS;

    var state = 'checking';         // checking | online | offline
    var pendingSubmit = false;      // کاربر «ورود» را زده و منتظرِ برگشتنِ اتصال است
    var timer = null;
    var checking = false;

    function setNote(text)
    {
        if ( note )
            note.textContent = text;
    }

    /**
     * ظاهر را از روی وضعیت می‌سازد.
     *
     * `quiet` برای وقتی است که کاربر خودش «ورود» را زده و ما داریم اتصال را
     * تست می‌کنیم: در آن حالت کارتِ قرمز روی صفحه نمی‌پرد (شاید اصلاً لازم
     * نشود)، فقط دکمهٔ ورود تا آمدنِ جواب قفل می‌شود.
     *
     * تنها چیزی که تستِ در جریان روی ظاهر می‌گذارد قفلِ دکمهٔ ورود است؛
     * تلاش‌های خودکارِ پس‌زمینه (`announce=false`) رنگ و متنِ کارت را دست
     * نمی‌زنند تا هر چند ثانیه یک بار روی صفحه نلرزد.
     */
    function render(quiet)
    {
        if ( submitButton )
            submitButton.disabled = ( state === 'offline' ) || checking;

        /* دکمهٔ «تلاش دوباره» عمداً هرگز قفل نمی‌شود: تلاشِ خودکارِ پس‌زمینه
           هر چند ثانیه اجرا می‌شود و اگر در آن فاصله دکمه خاکستری شود، کاربر
           فکر می‌کند ضربه‌اش گرفته نشده. ضربهٔ دوباره هم بی‌خطر است چون
           `check` اگر یک بررسی در جریان باشد دوباره شروع نمی‌کند. */

        if ( quiet )
            return;

        if ( card )
        {
            card.hidden = ( state === 'online' );
            card.classList.toggle('is-checking', state === 'checking');
        }
    }

    function stopRetry()
    {
        if ( timer !== null )
        {
            clearTimer(timer);
            timer = null;
        }
    }

    function scheduleRetry()
    {
        stopRetry();
        timer = setTimer(function(){
            timer = null;
            /* بی‌صدا: موفقیت یا شکستِ این تلاش بعداً روی کارت دیده می‌شود. */
            check(false, false);
        }, retryMs);
    }

    /* تستِ اتصال: هر پاسخی از سرور یعنی «راه باز است»، حتی ۴۰۱ و ۵۰۰.
       فقط نرسیدنِ پاسخ (خطای شبکه یا تمام شدنِ مهلت) یعنی قطع. */
    function ping()
    {
        var controller = ( typeof AbortController === 'function' ) ? new AbortController() : null;
        var abortTimer = null;

        if ( controller )
            abortTimer = setTimer(function(){ controller.abort(); }, pingTimeoutMs);

        return doFetch(url, {
            method: 'HEAD',
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller ? controller.signal : undefined,
        })
            .then(function(){ return true; })
            .catch(function(){ return false; })
            .then(function(reachable){
                if ( abortTimer !== null )
                    clearTimer(abortTimer);

                return reachable;
            });
    }

    /* همان درخواستی که کاربر فرستاده بود، حالا که اتصال برگشته. */
    function resume()
    {
        if ( !pendingSubmit || !form )
            return;

        pendingSubmit = false;
        setNote('اتصال برقرار شد؛ در حال ورود…');
        form.submit();
    }

    function check(quiet, announce)
    {
        if ( checking )
            return;

        checking = true;
        stopRetry();

        if ( !quiet && announce )
        {
            state = 'checking';
            setNote('در حال بررسی اتصال…');
        }

        render(quiet);

        return ping().then(function(reachable){
            checking = false;
            state = reachable ? 'online' : 'offline';

            if ( reachable )
            {
                stopRetry();
                setNote('');
                render(false);
                resume();
                return true;
            }

            setNote(isOnline()
                ? 'سرور جواب نداد؛ هر چند ثانیه خودکار تلاش می‌کنیم.'
                : 'اینترنتِ این دستگاه وصل نیست؛ هر چند ثانیه خودکار تلاش می‌کنیم.');
            render(false);
            scheduleRetry();

            return false;
        });
    }

    if ( form )
    {
        form.addEventListener('submit', function(event){
            if ( event && event.preventDefault )
                event.preventDefault();

            pendingSubmit = true;
            check(state === 'online', true);
        });
    }

    if ( retryButton )
    {
        retryButton.addEventListener('click', function(){
            /* اگر کاربر قبلاً «ورود» را زده بود، بعد از وصل شدن خودش می‌رود. */
            check(false, true);
        });
    }

    if ( win && win.addEventListener )
    {
        win.addEventListener('online', function(){ check(false, true); });

        win.addEventListener('offline', function(){
            state = 'offline';
            setNote('اینترنتِ این دستگاه قطع شد؛ هر چند ثانیه خودکار تلاش می‌کنیم.');
            render(false);
            scheduleRetry();
        });
    }

    /* اگر همان لحظهٔ باز شدنِ صفحه اینترنت نبود، بدون هیچ درخواستی کارت را
       نشان می‌دهیم تا کاربر بداند چرا فرستادنِ فرم بی‌فایده است. */
    if ( !isOnline() )
    {
        state = 'offline';
        setNote('اینترنتِ این دستگاه وصل نیست؛ هر چند ثانیه خودکار تلاش می‌کنیم.');
        render(false);
        scheduleRetry();
    }
    else
    {
        state = 'online';
        render(false);
    }

    return {
        check: function(){ return check(false, true); },
        stop: stopRetry,
        state: function(){ return state; },
    };
}

function wireLoginConnection()
{
    if ( typeof document === 'undefined' || typeof window === 'undefined' || !window.fetch )
        return;

    var form = document.getElementById('login-form');
    var retryButton = document.getElementById('login-connection-retry');

    if ( !form || !retryButton )
        return;

    createAuthConnection({
        form: form,
        submitButton: document.getElementById('login-submit'),
        card: document.getElementById('login-connection'),
        note: document.getElementById('login-connection-note'),
        retryButton: retryButton,
        window: window,
        url: window.location.href,
        fetch: function(address, init){ return window.fetch(address, init); },
        isOnline: function(){ return window.navigator.onLine !== false; },
    });
}

/* این فایل در <head> و پیش از ساخته‌شدنِ فرم اجرا می‌شود، پس تا کامل شدنِ
   DOM صبر می‌کنیم؛ وگرنه `getElementById` چیزی پیدا نمی‌کند و کل قابلیت
   بی‌صدا خاموش می‌ماند. */
if ( typeof document !== 'undefined' )
{
    if ( document.readyState === 'loading' )
        document.addEventListener('DOMContentLoaded', wireLoginConnection);
    else
        wireLoginConnection();
}
