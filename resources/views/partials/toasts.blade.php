{{-- Server-side flash toast (session('status')). Shown by ToastQ() in js/timer.js. --}}
    <div class="position-fixed toasts-stack bottom-0 right-0 p-3" style="z-index: 5; right: 0; bottom: 0;">
        @if (session('status'))
            <div id="liveToast" class="toast php-toast fade" role="alert" aria-live="assertive" aria-atomic="true" data-animation="true" data-delay="2000">
                <div class="toast-header">
                    <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="green"></rect></svg>
                    <strong class="mr-auto">انجام شد</strong>
                    <small>Mgh-App</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="toast-body">
                    {{ session('status') }}
                </div>
            </div>
        @endif
        @if (session('error'))
            <div class="toast php-toast fade" role="alert" aria-live="assertive" aria-atomic="true" data-animation="true" data-delay="4000">
                <div class="toast-header">
                    <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#c62828"></rect></svg>
                    <strong class="mr-auto">انجام نشد</strong>
                    <small>Mgh-App</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
                <div class="toast-body">
                    {{ session('error') }}
                </div>
            </div>
        @endif
    </div>
