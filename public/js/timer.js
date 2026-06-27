function sumParts(array)
{
    array = JSON.parse(array);
    if ( array.length == 0 ) return 0;
    
    // مرتب‌سازی بر اساس تاریخ
    array.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let totalMilliseconds = 0;
    let startTime = null;
    
    for (let i = 0; i < array.length; i++) {
        let currentDate = new Date(array[i].date).getTime();
        
        if (array[i].start == 1) {
            // شروع کار
            startTime = currentDate;
        } else if (array[i].start == 0 && startTime !== null) {
            // پایان کار - محاسبه اختلاف
            totalMilliseconds += (currentDate - startTime);
            startTime = null;
        }
    }
    
    // اگر تایمر هنوز در حال کار هست (start بدون end)
    if (startTime !== null) {
        let now = Date.now();
        totalMilliseconds += (now - startTime);
    }
    
    return totalMilliseconds;
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

function Interval(variable, totalMilliseconds, target, paused)
{
    // ذخیره زمان شروع برای محاسبه دقیق
    if (typeof window[variable+'_start'] === 'undefined') {
        window[variable+'_start'] = Date.now();
    }
    let startTime = window[variable+'_start'];
    let elapsed = 0;
    
    function CustomerTimer()
    {
        let now = Date.now();
        let remaining;
        
        if (paused) {
            // اگر متوقف شده، مقدار ثابت رو نمایش بده
            remaining = totalMilliseconds;
        } else {
            // محاسبه زمان باقی‌مانده
            let elapsedTime = now - startTime;
            remaining = totalMilliseconds - elapsedTime;
        }
        
        // اگر زمان تمام شد
        if (remaining <= 0) {
            clearInterval(window[variable]);
            document.querySelector(target).innerHTML = "00 : 00' : 00\"";
            return;
        }
        
        // محاسبه ساعت، دقیقه، ثانیه
        let hours = Math.floor(remaining / (1000 * 60 * 60));
        let minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        // فرمت‌دهی با صفر جلو
        hours = hours < 10 ? "0"+hours : hours;
        minutes = minutes < 10 ? "0"+minutes : minutes;
        seconds = seconds < 10 ? "0"+seconds : seconds;
        
        // نمایش با اعداد فارسی
        let res = hours + " : " + minutes + "' : " + seconds + '"';
        document.querySelector(target).innerHTML = e2p(res);
    }
    
    // اجرای اولیه
    CustomerTimer();
    
    // اگر متوقف نشده، شروع کن
    if (!paused) {
        if (window[variable]) {
            clearInterval(window[variable]);
        }
        window[variable] = setInterval(CustomerTimer, 1000);
    }
}

// اصلاح تابع timerStatus
function timerStatus(array)
{
    array = JSON.parse(array);
    if ( array.length > 0 )
    {
        // آخرین رکورد رو بگیر
        let lastRecord = array[array.length - 1];
        return lastRecord.pause == 1;
    }
    return false;
}

function finishTime(body)
{
    return {
        body: body,
        icon: "https://meraat.piqagram.ir/images/arm.jpg",
        image: "https://th.bing.com/th/id/OIP.fVzdKE2EPZzB5PiI1pvaFQHaHa?pid=ImgDet&rs=1",
        silent: false,
    }

}

//new Notification("خانم سمیه غلامرضایی",finishTime("تایم کاری امروز شما به"))

function runTimer(id)
{
    $.ajax({
        url: "https://meraat.piqagram.ir/read/timer",
        method: 'get',
        data: {
            _token: $('meta[name="csrf-token"]').attr('content'),
            id: id
        },
        beforeSend: function( xhr ) {
            console.log('timer loading..');
        },
        success: function(data, textStatus, xhr) {
            ToastQ('php-toast').forEach( b=> {
                b.show();
            });
            if ( JSON.parse(data).toString() != [] ){
                console.log("Success: "+xhr.status);
                
                // محاسبه مجموع میلی‌ثانیه
                let totalMs = sumParts(data);
                
                // شروع تایمر با مقدار محاسبه شده
                Interval("dt"+id, totalMs, ".digital-timer-"+id, timerStatus(data));
                
                // اگر pause هست، تایمر رو متوقف کن
                if (JSON.parse(data).reverse()[0].pause == 1) {
                    clearInterval(eval("dt"+id));
                }
                
                newToast('دریافت اطلاعات',
                    'اطلاعات تایمر کاربر دریافت شد.',
                    'ajax-success',
                    'Mgh-App',
                    '#08b100',
                    '2000',
                    'toasts-stack');
                ToastQ('ajax-success').forEach( b=> {
                    b.show();
                });
                delToast('ajax-success','3000');
            }
        },
        complete: function(xhr, textStatus) {
            console.log("Complete: "+xhr.status);
        }
    })
    .done(function( data ) {
        if ( console && console.log && data.toString() != [] ) {
            newToast('راه اندازی تایمر',
                'تایمر کاربر راه اندازی شد.',
                'ajax-done',
                'Mgh-App',
                '#007aff',
                '2000',
                'toasts-stack');
            ToastQ('ajax-done').forEach( b=> {
                b.show();
            });
            delToast('ajax-done','3000');
        }
    })
    .fail(function( jqXHR, textStatus ) {
        console.error( "Request failed: " + textStatus );
        newToast('Timer problem!!',
            'اشکال در انجام عمل به وجود آمده است '+textStatus,
            'ajax-fail',
            'Mgh-App',
            '#007aff',
            '2000',
            'toasts-stack');
        ToastQ('ajax-fail').forEach( b=> {
            b.show();
        });
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
                url: `https://meraat.piqagram.ir/upload/ajax`,
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
                url: 'https://meraat.piqagram.ir/delete/ajax',
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







