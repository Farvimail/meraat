#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساختِ تصویر پیش‌فرضِ پروفایل (public/images/users/PRP.jpg).

این همان فایلی است که پنل وب و اپ موبایل برای کارمندِ بی‌عکس نشان می‌دهند.
نسخهٔ قبلی با دستِ روی JPG ویرایش شده بود و دو عیب داشت: بدنش شبیه پنگوئن
بیرون می‌زد و بینِ تنهٔ اصلی و ادامهِٔ کشیده‌شده یک خطِ درزِ واضح دیده می‌شد.
این اسکریپت تصویر را از نو می‌کشد تا هیچ درزی وجود نداشته باشد:

  * پس‌زمینه: همان خاکستریِ خیلی روشنِ نسخهٔ اصلی (۲۳۰،۲۳۱،۲۳۳).
  * سر: دایرهٔ همان مرکز و شعاعِ نسخهٔ اصلی.
  * بدن: یک **نیم‌بیضیِ واحد** از خطِ شانه تا لبهٔ پایینِ تصویر — شانه‌ها
    گِرد است (نه مخروطی) و «از سینه به پایین» هم خاکستری است.
  * رنگ هر دو شکل یکی است (۱۷۵،۱۸۰،۱۸۴)؛ چون یک‌جا کشیده می‌شوند، مرزی
    بینشان وجود ندارد.

اجرا:  python scripts/make-default-avatar.py
خروج: public/images/users/PRP.jpg  (پیش‌نویسِ محلی، بدونِ دست زدن به سرور)
"""

import os

from PIL import Image, ImageDraw

# اندازهٔ نهایی (همان اندازهٔ نسخهٔ اصلی).
SIZE = 474
# ضریب رسمِ فرا‌نمونه: ابتدا ۴ بزرگ‌تر کشیده می‌شود و بعد با LANCZOS کوچک،
# تا لبه‌ها بدونِ پله و بدونِ نیاز به کتابخانهٔ AA صاف باشند.
SS = 4

BG = (230, 231, 233)
FG = (175, 180, 184)

# هندسه (در مقیاس نهایی ۴۷۴×۴۷۴)، از نسخهٔ اصلی اندازه‌گیری شده:
HEAD_CX, HEAD_CY, HEAD_R = 237, 197, 93
# بدنه: نیم‌بیضی با محورِ افقی ۱۸۸ و عمودی ۱۷۲، مرکزش روی لبهٔ پایین تا
# همان خطِ شانهٔ قبلی (y≈۳۰۲) شروع شود و تا تهِ تصویر ادامه یابد.
BODY_X0, BODY_Y0, BODY_X1, BODY_Y1 = 49, 302, 425, SIZE + 40  # +۴۰ برایِ بریده‌شدنِ تمیز لبه


def main() -> None:
    scale = SS
    img = Image.new("RGB", (SIZE * scale, SIZE * scale), BG)
    d = ImageDraw.Draw(img)

    d.ellipse(
        [
            (HEAD_CX - HEAD_R) * scale,
            (HEAD_CY - HEAD_R) * scale,
            (HEAD_CX + HEAD_R) * scale,
            (HEAD_CY + HEAD_R) * scale,
        ],
        fill=FG,
    )
    d.ellipse(
        [BODY_X0 * scale, BODY_Y0 * scale, BODY_X1 * scale, BODY_Y1 * scale],
        fill=FG,
    )

    img = img.resize((SIZE, SIZE), Image.LANCZOS)

    out = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "public",
        "images",
        "users",
        "PRP.jpg",
    )
    img.save(out, "JPEG", quality=92, subsampling=0)
    print("saved:", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
