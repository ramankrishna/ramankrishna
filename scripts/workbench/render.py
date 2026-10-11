"""Render the journey film from journey.js.

The scene is a pure function of time, so this steps through it frame by
frame in headless Chromium and saves each frame. ffmpeg then makes the MP4
and cuts the chapter GIFs the README plays.

    cd scripts/workbench && npm install three@0.169.0
    pip install playwright pillow && playwright install chromium
    python3 render.py frames light out/light 24 1.25     # all 2040 frames
    FIRST=617 LAST=972 python3 render.py frames light out/light 24 1.25  # or just a range

    ffmpeg -framerate 24 -i out/light/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 journey-light.mp4

Chapter GIFs (start frame, seconds, width): Lowe's 0/24.2/800, models 617/14.8/800, tools 1003/42.4/760.

    ffmpeg -framerate 24 -start_number 617 -t 14.8 -i out/light/f%04d.png -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" -loop 0 ../../assets/journey-models-light.gif

usage: render.py stills <theme> <out.png> t1 t2 ...
       render.py frames <theme> <dir> <fps> [scale]
"""
import sys, asyncio, io, subprocess, time, os, socket
from playwright.async_api import async_playwright
from PIL import Image
W, H = 1280, 720
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p
async def main():
    mode, theme, out = sys.argv[1:4]
    port = free_port()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)
            scale = float(sys.argv[5]) if mode == "frames" and len(sys.argv) > 5 else 1
            pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=scale)
            errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://127.0.0.1:{port}/workbench/index.html?theme={theme}")
            try:
                await pg.wait_for_function("window.ready === true", timeout=60000)
            except Exception as e:
                print("NOT READY", errs[:5]); raise
            if mode == "stills":
                ts = [float(x) for x in sys.argv[4:]]
                cols = 3; rows = -(-len(ts) // cols); tw, th = 640, 360
                sheet = Image.new("RGB", (cols * tw, rows * th), "white")
                for i, t in enumerate(ts):
                    await pg.evaluate("t => window.renderAt(t)", t)
                    im = Image.open(io.BytesIO(await pg.screenshot())).convert("RGB").resize((tw, th), Image.LANCZOS)
                    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
                os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
                sheet.save(out)
            else:
                fps = int(sys.argv[4]); os.makedirs(out, exist_ok=True)
                dur = await pg.evaluate("window.DURATION"); n = int(round(dur * fps)); t0 = time.time()
                first = int(os.environ.get('FIRST', 0)); last = int(os.environ.get('LAST', n))
                for i in range(first, min(n, last)):
                    await pg.evaluate("t => window.renderAt(t)", i / fps)
                    await pg.screenshot(path=f"{out}/f{i:04d}.png")
                    if i % 40 == 0: print(f"{i}/{n} {time.time()-t0:.0f}s", flush=True)
            if errs: print("console errors:", errs[:5])
            await b.close()
    finally:
        srv.terminate()
asyncio.run(main())
