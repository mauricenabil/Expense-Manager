#!/usr/bin/env python3
"""
توليد أيقونة التطبيق بكل المقاسات المطلوبة من مصدر واحد.

الهندسة هنا مطابقة تماماً لـ src-tauri/icons/icon.svg (نفس الإحداثيات
على شبكة 512). السكربت بيرسم بدقة 4 أضعاف ثم يصغّر، عشان الحواف تطلع
ناعمة من غير ما نحتاج أي أداة خارجية.

التشغيل:  python tools/generate_icons.py
المتطلبات: Pillow + numpy  (pip install pillow numpy)
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 512          # شبكة التصميم
SS = 4           # معامل التكبير أثناء الرسم (supersampling)
N = S * SS

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"

# ---- ألوان الهوية (نفس theme.css) -------------------------------------
BG_TOP = (30, 42, 56)       # #1E2A38
BG_BOTTOM = (16, 23, 32)    # #101720
TEAL_TOP = (79, 196, 167)   # #4FC4A7  accent-strong
TEAL_BOTTOM = (45, 133, 112)  # #2D8570
CORAL = (237, 115, 84)      # #ED7354
NIGHT = (22, 29, 39)        # #161D27  bg
PAPER = (242, 238, 227)     # #F2EEE3  لون النص/الورق في الثيم الداكن


def px(v):
    return int(round(v * SS))


def linear_gradient(size, c0, c1):
    """تدرّج رأسي بسيط بمقاس (w, h)."""
    w, h = size
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    arr = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(3):
        arr[:, :, i] = c0[i] + (c1[i] - c0[i]) * t
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def mask_round_rect(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def build():
    canvas = Image.new("RGBA", (N, N), (0, 0, 0, 0))

    # 1) الخلفية: مربع بحواف دائرية + تدرّج ليلي
    bg = linear_gradient((N, N), BG_TOP, BG_BOTTOM).convert("RGBA")
    bg_mask = mask_round_rect((N, N), (0, 0, N - 1, N - 1), px(115))
    canvas.paste(bg, (0, 0), bg_mask)

    # 2) لمعة خفيفة أعلى اليسار — تكسر تسطيح اللون الواحد
    shine = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(shine).ellipse(
        (px(-120), px(-160), px(330), px(300)), fill=(255, 255, 255, 30)
    )
    shine = shine.filter(ImageFilter.GaussianBlur(px(60)))
    canvas.alpha_composite(Image.composite(shine, Image.new("RGBA", (N, N), (0, 0, 0, 0)), bg_mask))

    # 3) البطاقة الخلفية (ورقة نقدية) — توحي بكارت داخل المحفظة
    card = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(card)
    cdraw.rounded_rectangle(
        (px(150), px(104), px(362), px(214)), radius=px(26),
        fill=PAPER + (236,)
    )
    # شريطان رفيعان على الورقة — تفصيلة تختفي بهدوء في المقاسات الصغيرة
    cdraw.rounded_rectangle((px(178), px(136), px(268), px(152)), radius=px(8),
                            fill=NIGHT + (60,))
    cdraw.rounded_rectangle((px(178), px(166), px(228), px(182)), radius=px(8),
                            fill=NIGHT + (40,))
    canvas.alpha_composite(card)

    # ظل ناعم تحت المحفظة — يفصلها عن الخلفية بدل حدّ حاد
    shadow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (px(104), px(186), px(408), px(408)), radius=px(52), fill=(0, 0, 0, 120)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(px(14)))
    canvas.alpha_composite(shadow)

    # 4) جسم المحفظة — تدرّج teal
    body_box = (px(96), px(168), px(416), px(400))
    body_mask = mask_round_rect((N, N), body_box, px(52))
    body = linear_gradient((N, N), TEAL_TOP, TEAL_BOTTOM).convert("RGBA")
    canvas.paste(body, (0, 0), body_mask)

    # 5) حافة علوية فاتحة على جسم المحفظة (حجم صغير = عمق بسيط)
    lip = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(lip).rounded_rectangle(
        (px(96), px(168), px(416), px(240)), radius=px(52),
        fill=(255, 255, 255, 34)
    )
    canvas.alpha_composite(Image.composite(lip, Image.new("RGBA", (N, N), (0, 0, 0, 0)), body_mask))

    # 6) جيب القفل على اليمين + نقطة مرجانية (لون التأكيد في التطبيق)
    clasp = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    cd = ImageDraw.Draw(clasp)
    cd.rounded_rectangle((px(288), px(248), px(400), px(328)), radius=px(40),
                         fill=NIGHT + (255,))
    cd.ellipse((px(330), px(262), px(382), px(314)), fill=CORAL + (255,))
    canvas.alpha_composite(clasp)

    # 7) حلقة داخلية بيضاء شفافة — نفس أسلوب حدود البطاقات في التطبيق
    ring = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        (px(3), px(3), N - px(3), N - px(3)), radius=px(113),
        outline=(255, 255, 255, 26), width=px(3)
    )
    canvas.alpha_composite(Image.composite(ring, Image.new("RGBA", (N, N), (0, 0, 0, 0)), bg_mask))

    return canvas


def resized(master, size):
    return master.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    master = build().resize((1024, 1024), Image.LANCZOS)

    master.save(OUT / "icon-source.png")
    resized(master, 512).save(OUT / "icon.png")
    resized(master, 256).save(OUT / "128x128@2x.png")
    resized(master, 128).save(OUT / "128x128.png")
    resized(master, 32).save(OUT / "32x32.png")

    # ICO متعدّد المقاسات — ويندوز بيختار المناسب لشريط المهام وسطح المكتب
    resized(master, 256).save(
        OUT / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # ICNS لماك — اختياري، الـ workflow الحالي بيبني ويندوز فقط
    try:
        resized(master, 1024).save(OUT / "icon.icns")
    except Exception as exc:  # pragma: no cover
        print("تخطّي icon.icns:", exc)

    print("تم توليد الأيقونات في", OUT)


if __name__ == "__main__":
    main()
