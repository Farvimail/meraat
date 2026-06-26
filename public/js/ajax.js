
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

function timerStatus(array)
{
    array = JSON.parse(array);
    if ( array.toString() != [] )
    {
        if ( array.length > 1 )
            array = array.reverse();
        return array[0].pause;
    }
}

function sumParts(array)
{
    array = JSON.parse(array);
    if ( array.toString() != [] )
    {
        sum = 0;
        point = +1;
        array.reverse().forEach(b =>{
            b.start?point=+1:point=-1;
            sum+= new Date(b.date)*point;
        })
        return sum>0?sum:sum*-1;
    }
}

$(document).ready(function(){
    $(document).on('click', 'button[id^="timer-"]', function(){

        let target = $(this).attr('id');
        let id = target;
        id = id.substring(id.lastIndexOf('-')+1);

        $.ajax({
            url: "https://meraat.piqagram.ir/public/present/"+target.split('-')[1],
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
                /* manager Timer */
                Interval("dt"+id,
                    sumParts(data),
                    ".digital-timer-"+id,
                    timerStatus(data));
                timerStatus(data)?clearInterval(eval("dt"+id)):null;
                let title = ((target.split('-')[1]=="pause")?"توقف":"شروع");
                /* create Toast */
                newToast(title+' ذخیره شد ',
                    title+' امروز شما با موفقیت ثبت شد. ',
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
                /* create Toast */
                newToast(title+" ذخیره نشد!! ",
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


