<#
    ساخت همهٔ آیکون‌های اپ از یک لوگوی منبع.

    چرا اسکریپت و نه فایل آماده: اگر روزی لوگو عوض شد، باید بتوان بدون باز کردن
    فتوشاپ همان مجموعه را دوباره ساخت — «آیکون» اپ یک فایل نیست، پنج فایل است
    (آیکون اصلی، لایهٔ پیش‌زمینه/پس‌زمینهٔ اندروید، آیکون تک‌رنگ، فاوآیکون وب).

    طرز کار:
      ۱. لوگو را به ۲۰۴۸ پیکسل کوچک می‌کند.
      ۲. روشنایی هر پیکسل را می‌گیرد و «تیره‌ها» را جدا می‌کند.
      ۳. بزرگ‌ترین قطعهٔ به‌هم‌پیوستهٔ تیره = شکلِ لوگو (متن‌های ریز حاشیه دور
         ریخته می‌شوند). سوراخ‌های داخلش (خط سفید) با پرشدن از لبه پر می‌شود تا
         یک «نقاب» کامل به دست بیاید.
      ۴. همان نقاب، شفافیت لایه‌های اندروید را می‌سازد تا خط سفیدِ داخل لوگو
         حفظ شود ولی پس‌زمینه شفاف بماند.

    اجرا (مثال):
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/make-icons.ps1 -Source "C:\path\logo.jpg"
#>
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'

# در PowerShell 5.1 وقتی اسکریپت با -File اجرا می‌شود، $PSScriptRoot در مقدار
# پیش‌فرض پارامتر خالی است؛ پس مسیرها را اینجا می‌سازیم.
$scriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrEmpty($OutDir)) { $OutDir = Join-Path (Split-Path -Parent $scriptDir) 'assets' }
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class BrandIcon
{
    private const int Work = 2048;
    private static readonly Color White = Color.FromArgb(255, 255, 255, 255);
    private static readonly Color Clear = Color.FromArgb(0, 255, 255, 255);

    public static string[] Build(string sourcePath, string outDir)
    {
        System.Collections.Generic.List<string> log = new System.Collections.Generic.List<string>();

        Bitmap src;
        using (Image loaded = Image.FromFile(sourcePath))
        {
            src = new Bitmap(loaded.Width, loaded.Height, PixelFormat.Format24bppRgb);
            using (Graphics g = Graphics.FromImage(src))
            {
                g.Clear(Color.White);
                g.DrawImage(loaded, new Rectangle(0, 0, loaded.Width, loaded.Height));
            }
        }

        // قاب نازک دور لوگو پاک می‌شود، وگرنه شکل با همان قاب به هم می‌چسبد و
        // کادر تشخیص بزرگ‌ترین قطعه، کل تصویر می‌شود.
        int frame = (int)Math.Round(Math.Min(src.Width, src.Height) * 0.025);
        StripFrame(src, frame);
        log.Add("stripped outer frame: " + frame + " px");

        // --- ۱. نقاب ------------------------------------------------
        Bitmap work = Downscale(src, Work);
        bool[] dark = DarkMask(work);
        bool[] silhouette = Silhouette(dark, Work, Work);

        int minX = Work, minY = Work, maxX = -1, maxY = -1;
        for (int y = 0; y < Work; y++)
        {
            for (int x = 0; x < Work; x++)
            {
                if (!silhouette[y * Work + x]) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < 0)
        {
            throw new InvalidOperationException("the source image has no dark logo shape");
        }

        double fx0 = (double)minX / Work;
        double fy0 = (double)minY / Work;
        double fx1 = (double)(maxX + 1) / Work;
        double fy1 = (double)(maxY + 1) / Work;

        // کادر لوگو در مقیاس تصویر اصلی
        double markW = (fx1 - fx0) * src.Width;
        double markH = (fy1 - fy0) * src.Height;
        double markCx = (fx0 + fx1) * 0.5 * src.Width;
        double markCy = (fy0 + fy1) * 0.5 * src.Height;

        log.Add(string.Format("mark: {0}x{1} px of {2}x{3} ({4:0.0}% x {4:0.0}%)",
            (int)markW, (int)markH, src.Width, src.Height, (fx1 - fx0) * 100));

        Bitmap mask = MaskBitmap(silhouette, Work, Work);

        if (!Directory.Exists(outDir)) Directory.CreateDirectory(outDir);

        // --- ۲. آیکون‌ها ---------------------------------------------
        RenderOpaque(src, Path.Combine(outDir, "icon.png"), 1024, 0.72, markW, markH, markCx, markCy, White);
        RenderOpaque(src, Path.Combine(outDir, "favicon.png"), 128, 0.80, markW, markH, markCx, markCy, White);
        RenderOpaque(src, Path.Combine(outDir, "logo.png"), 512, 0.92, markW, markH, markCx, markCy, White);
        RenderSolid(Path.Combine(outDir, "android-icon-background.png"), 1024, White);

        RectangleF dest = DestRect(1024, 0.60, src, markW, markH, markCx, markCy);
        RenderCutout(src, mask, Path.Combine(outDir, "android-icon-foreground.png"), 1024, dest);
        RenderMonochrome(mask, Path.Combine(outDir, "android-icon-monochrome.png"), 1024, dest);

        // --- ۳. منبع کوچک‌شده برای ساخت دوباره ------------------------
        string brand = Path.Combine(outDir, "brand");
        if (!Directory.Exists(brand)) Directory.CreateDirectory(brand);
        SaveJpeg(Downscale(src, 1200), Path.Combine(brand, "logo-source.jpg"), 92L);

        log.Add("foreground mark size: " + ((int)(dest.Width * (markW / src.Width))) + " px of 1024");
        log.Add("wrote icon.png, favicon.png, logo.png, android-icon-{foreground,background,monochrome}.png, brand/logo-source.jpg");
        return log.ToArray();
    }

    // ---------------------------------------------------------------
    private static RectangleF DestRect(int size, double fill, Bitmap src,
        double markW, double markH, double markCx, double markCy)
    {
        double span = Math.Max(markW, markH);
        double scale = (fill * size) / span;
        float w = (float)(src.Width * scale);
        float h = (float)(src.Height * scale);
        float x = (float)(size / 2.0 - markCx * scale);
        float y = (float)(size / 2.0 - markCy * scale);
        return new RectangleF(x, y, w, h);
    }

    private static void RenderOpaque(Bitmap src, string path, int size, double fill,
        double markW, double markH, double markCx, double markCy, Color bg)
    {
        using (Bitmap canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(canvas))
            {
                Quality(g);
                g.Clear(bg);
                g.DrawImage(src, DestRect(size, fill, src, markW, markH, markCx, markCy));
            }
            canvas.Save(path, ImageFormat.Png);
        }
    }

    private static void RenderSolid(string path, int size, Color color)
    {
        using (Bitmap canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(canvas)) { g.Clear(color); }
            canvas.Save(path, ImageFormat.Png);
        }
    }

    /** رنگ لوگو با شفافیتِ نقاب: خط سفید داخل لوگو می‌ماند، بیرونش شفاف است. */
    private static void RenderCutout(Bitmap src, Bitmap mask, string path, int size, RectangleF dest)
    {
        using (Bitmap canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(canvas))
            {
                Quality(g);
                g.Clear(Clear);
                g.DrawImage(src, dest);
            }

            using (Bitmap alpha = MaskCanvas(mask, size, dest))
            {
                ApplyAlpha(canvas, alpha, false);
            }

            canvas.Save(path, ImageFormat.Png);
        }
    }

    /** نقابِ سفید روی شفاف؛ اندروید خودش رنگ تم را رویش می‌گذارد. */
    private static void RenderMonochrome(Bitmap mask, string path, int size, RectangleF dest)
    {
        using (Bitmap canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(canvas)) { g.Clear(Clear); }

            using (Bitmap alpha = MaskCanvas(mask, size, dest))
            {
                ApplyAlpha(canvas, alpha, true);
            }

            canvas.Save(path, ImageFormat.Png);
        }
    }

    /**
     * نقاب، همان کادری را می‌گیرد که خود تصویر می‌گیرد؛ چون نقاب هم کل تصویر
     * اصلی را پوشش می‌دهد. پس فقط اندازهٔ خروجی را عوض می‌کنیم، نه مختصات را.
     */
    private static Bitmap MaskCanvas(Bitmap mask, int size, RectangleF dest)
    {
        Bitmap canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(canvas))
        {
            Quality(g);
            g.Clear(Color.Black);
            g.DrawImage(mask, dest);
        }
        return canvas;
    }

    private static void ApplyAlpha(Bitmap canvas, Bitmap alpha, bool white)
    {
        int w = canvas.Width, h = canvas.Height;
        BitmapData cd = canvas.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        BitmapData ad = alpha.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            int cs = cd.Stride, as_ = ad.Stride;
            byte[] cRow = new byte[cs];
            byte[] aRow = new byte[as_];
            for (int y = 0; y < h; y++)
            {
                Marshal.Copy(IntPtr.Add(cd.Scan0, y * cs), cRow, 0, cs);
                Marshal.Copy(IntPtr.Add(ad.Scan0, y * as_), aRow, 0, as_);
                for (int x = 0; x < w; x++)
                {
                    int i = x * 4;
                    int value = (aRow[i] * 299 + aRow[i + 1] * 587 + aRow[i + 2] * 114) / 1000;
                    cRow[i + 3] = (byte)value;
                    if (white)
                    {
                        cRow[i] = 255; cRow[i + 1] = 255; cRow[i + 2] = 255;
                    }
                }
                Marshal.Copy(cRow, 0, IntPtr.Add(cd.Scan0, y * cs), cs);
            }
        }
        finally
        {
            canvas.UnlockBits(cd);
            alpha.UnlockBits(ad);
        }
    }

    private static void Quality(Graphics g)
    {
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    }

    private static void StripFrame(Bitmap src, int band)
    {
        int w = src.Width, h = src.Height;
        using (Graphics g = Graphics.FromImage(src))
        {
            g.FillRectangle(Brushes.White, 0, 0, w, band);
            g.FillRectangle(Brushes.White, 0, h - band, w, band);
            g.FillRectangle(Brushes.White, 0, 0, band, h);
            g.FillRectangle(Brushes.White, w - band, 0, band, h);
        }
    }

    private static Bitmap Downscale(Bitmap src, int size)
    {
        Bitmap small = new Bitmap(size, size, PixelFormat.Format24bppRgb);
        using (Graphics g = Graphics.FromImage(small))
        {
            Quality(g);
            g.Clear(Color.White);
            g.DrawImage(src, new Rectangle(0, 0, size, size));
        }
        return small;
    }

    private static void SaveJpeg(Bitmap bmp, string path, long quality)
    {
        ImageCodecInfo jpeg = null;
        foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders())
        {
            if (codec.FormatID == ImageFormat.Jpeg.Guid) jpeg = codec;
        }

        EncoderParameters parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
        bmp.Save(path, jpeg, parameters);
    }

    private static bool[] DarkMask(Bitmap bmp)
    {
        int w = bmp.Width, h = bmp.Height;
        bool[] mask = new bool[w * h];
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
        try
        {
            byte[] row = new byte[data.Stride];
            for (int y = 0; y < h; y++)
            {
                Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), row, 0, data.Stride);
                for (int x = 0; x < w; x++)
                {
                    int i = x * 3;
                    int lum = (row[i] * 299 + row[i + 1] * 587 + row[i + 2] * 114) / 1000;
                    mask[y * w + x] = lum < 128;
                }
            }
        }
        finally { bmp.UnlockBits(data); }
        return mask;
    }

    /**
     * بزرگ‌ترین قطعهٔ به‌هم‌پیوستهٔ تیره، به‌علاوهٔ سوراخ‌های بسته‌اش.
     * سوراخ‌ها = نواحی روشنی که از لبهٔ تصویر به آن‌ها راه نیست.
     */
    private static bool[] Silhouette(bool[] dark, int w, int h)
    {
        int total = w * h;
        int[] label = new int[total];
        int[] stack = new int[total];
        int best = 0, bestCount = -1, current = 0;

        for (int seed = 0; seed < total; seed++)
        {
            if (!dark[seed] || label[seed] != 0) continue;

            current++;
            int sp = 0, count = 0;
            stack[sp++] = seed;
            label[seed] = current;

            while (sp > 0)
            {
                int p = stack[--sp];
                count++;
                int x = p % w, y = p / w;

                if (x > 0) { int q = p - 1; if (dark[q] && label[q] == 0) { label[q] = current; stack[sp++] = q; } }
                if (x < w - 1) { int q = p + 1; if (dark[q] && label[q] == 0) { label[q] = current; stack[sp++] = q; } }
                if (y > 0) { int q = p - w; if (dark[q] && label[q] == 0) { label[q] = current; stack[sp++] = q; } }
                if (y < h - 1) { int q = p + w; if (dark[q] && label[q] == 0) { label[q] = current; stack[sp++] = q; } }
            }

            if (count > bestCount) { bestCount = count; best = current; }
        }

        bool[] outside = new bool[total];
        int sp2 = 0;
        for (int x = 0; x < w; x++)
        {
            int top = x, bottom = (h - 1) * w + x;
            if (label[top] != best && !outside[top]) { outside[top] = true; stack[sp2++] = top; }
            if (label[bottom] != best && !outside[bottom]) { outside[bottom] = true; stack[sp2++] = bottom; }
        }
        for (int y = 0; y < h; y++)
        {
            int left = y * w, right = y * w + w - 1;
            if (label[left] != best && !outside[left]) { outside[left] = true; stack[sp2++] = left; }
            if (label[right] != best && !outside[right]) { outside[right] = true; stack[sp2++] = right; }
        }

        while (sp2 > 0)
        {
            int p = stack[--sp2];
            int x = p % w, y = p / w;

            if (x > 0) { int q = p - 1; if (!outside[q] && label[q] != best) { outside[q] = true; stack[sp2++] = q; } }
            if (x < w - 1) { int q = p + 1; if (!outside[q] && label[q] != best) { outside[q] = true; stack[sp2++] = q; } }
            if (y > 0) { int q = p - w; if (!outside[q] && label[q] != best) { outside[q] = true; stack[sp2++] = q; } }
            if (y < h - 1) { int q = p + w; if (!outside[q] && label[q] != best) { outside[q] = true; stack[sp2++] = q; } }
        }

        bool[] silhouette = new bool[total];
        for (int i = 0; i < total; i++)
        {
            silhouette[i] = label[i] == best || !outside[i];
        }
        return silhouette;
    }

    private static Bitmap MaskBitmap(bool[] mask, int w, int h)
    {
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb);
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
        try
        {
            byte[] row = new byte[data.Stride];
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    byte v = mask[y * w + x] ? (byte)255 : (byte)0;
                    int i = x * 3;
                    row[i] = v; row[i + 1] = v; row[i + 2] = v;
                }
                Marshal.Copy(row, 0, IntPtr.Add(data.Scan0, y * data.Stride), data.Stride);
            }
        }
        finally { bmp.UnlockBits(data); }
        return bmp;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$resolved = (Resolve-Path -LiteralPath $Source).Path
$out = if (Test-Path -LiteralPath $OutDir) { (Resolve-Path -LiteralPath $OutDir).Path } else { $OutDir }

[BrandIcon]::Build($resolved, $out) | ForEach-Object { Write-Host $_ }
exit 0
