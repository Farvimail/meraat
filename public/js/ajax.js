
$.ajaxSetup({
    headers: {
        'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
});

function appendLoading(sign, target)
{
    let spinner_elm = document.createElement('span');
    spinner_elm.className = "spinner-border spinner-border-sm";
    spinner_elm.setAttribute('role','status');
    spinner_elm.setAttribute('aria-hidden','true');

    let span_elm = document.createElement('span');
    span_elm.className = "sr-only";
    span_elm.innerText = "loading...";

    let array = [spinner_elm, span_elm];
    document.querySelector(`${sign+target}`)
        .innerHTML = '';

    array.forEach( b => {
        document.querySelector(`${sign+target}`)
            .appendChild(b);
    });
}

function delLoading(sign, target, content)
{
    document.querySelector(`${sign+target}`)
        .innerHTML = ((content=="pause")?"توقف":"شروع");
}

/* حسابِ تایمر (`timerWorked`/`Interval`) و اندازه‌گیری اختلافِ ساعتِ سرور با
   مرورگر در `js/timer.js` هستند. یک کپیِ دومِ همین‌ها اینجا بود که همیشه با
   نسخهٔ timer.js بازنویسی می‌شد و فقط باعث سردرگمی دربارهٔ منبعِ حساب تایمر
   بود؛ حذف شد تا حسابِ تایمر یک جا باشد. */

$(document).ready(function(){
    $(document).on('click', 'button[id^="timer-"]', function(){

        let target = $(this).attr('id');
        // نام همکار روی خودِ دکمه است تا تیتر توست مشخص کند پیام برای کیست.
        let btnName = $(this).attr('data-name') || '';
        let id = target;
        id = id.substring(id.lastIndexOf('-')+1);

        $.ajax({
            url: "/present/"+target.split('-')[1],
            method: 'get',
            data: {
                _token: $('meta[name="csrf-token"]').attr('content'),
                id: id
                },
            beforeSend: function( xhr ) {
                console.log('loading');
                appendLoading('#', target);
            },
            success: function(data, textStatus, xhr) {
                console.log("Success: "+xhr.status);
                /* manager Timer — با ساعتِ سرور، همان‌طور که اپ حساب می‌کند */
                timerMeasureSkew(xhr);
                Interval("dt"+id,
                    timerWorked(data),
                    ".digital-timer-"+id,
                    timerClockSkew);
                let title = ((target.split('-')[1]=="pause")?"توقف":"شروع");
                let titleWithName = btnName ? title+' — '+btnName : title;
                /* create Toast */
                newToast(titleWithName+' ذخیره شد ',
                    title+' امروز ' + (btnName || 'کاربر') + ' با موفقیت ثبت شد. ',
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
            },
            complete: function(xhr, textStatus) {
                console.log("Complete: "+xhr.status);
                delLoading('#', target, target.split('-')[1]);
            }
        })

            .fail(function( jqXHR, textStatus ) {
                console.error( "Request failed: " + textStatus );
                let title = ((target.split('-')[1]=="pause")?"توقف":"شروع");
                let titleWithName = btnName ? title+' — '+btnName : title;
                /* create Toast */
                newToast(titleWithName+" ذخیره نشد!! ",
                    'اشکال در انجام عمل به وجود آمده است ',
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
                delLoading('#', target, target.split('-')[1]);
            });
    });
});


