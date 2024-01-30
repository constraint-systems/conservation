import { ArrowDown, Info, MinusIcon, PlusIcon } from "lucide-react";
import { height, multiplier, padding, width } from "./consts";
import { useAtom, useSetAtom } from "jotai";
import {
  cameraAtom,
  canvasAtom,
  canvasPreviewAtom,
  colorAtom,
  orderRefAtom,
  showInfoAtom,
  sizeAtom,
  zoomCanvasAtom,
} from "./atoms";
import { Slider } from "./components";
import { hexToRgb, rgbToHex } from "./utils";
import { useEffect, useRef } from "react";
import { useGesture } from "@use-gesture/react";

function App() {
  const [canvas] = useAtom(canvasAtom);
  const [showInfo] = useAtom(showInfoAtom);
  useLoadCanvas();

  return (
    <div className="text-white overflow-hidden font-mono leading-4 flex uppercase justify-center items-center h-[100dvh]">
      {canvas ? (
        <Container>
          <div className="flex flex-col grow">
            <Title />
            {showInfo ? <AppInfo /> : null}
            <ZoomCanvas />
          </div>
          <div className="flex flex-col select-none">
            <Palette />
            <RgbSliders />
            <div className="flex w-full">
              <div className="w-1/2 flex items-center">
                <Size />
              </div>
              <div className="w-1/2 border-l border-neutral-600">
                <Zoom />
              </div>
            </div>
          </div>
        </Container>
      ) : null}
    </div>
  );
}

export default App;

function AppInfo() {
  return (
    <div className="px-3 py-2 border-b border-neutral-600 bg-neutral-900">
      An experimental drawing app where all the initial RGB values (522,240 red,
      522,240 green, 522,240 blue) are preserved. More at{" "}
      <a
        href="https://constraint.systems"
        className="underline"
        target="_blank"
      >
        constraint.systems
      </a>
    </div>
  );
}

function useLoadCanvas() {
  const setCanvas = useSetAtom(canvasAtom);
  const [orderRef] = useAtom(orderRefAtom);
  const runOnceRef = useRef(false);

  useEffect(() => {
    if (runOnceRef.current) return;
    runOnceRef.current = true;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    setCanvas(canvas);

    const localCheck = localStorage.getItem("canvas");
    const localOrder = localStorage.getItem("order");
    const c = canvas;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;

    if (localCheck) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = localCheck;
      if (localOrder) {
        orderRef.current = JSON.parse(localOrder);
      }
    } else {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, c.width / 2, c.height);
      ctx.fillStyle = "white";
      ctx.fillRect(c.width / 2, 0, c.width / 2, c.height);
      orderRef.current = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const index = r * width + c;
          orderRef.current.push(index);
        }
      }
    }
  }, [runOnceRef]);
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sm:border flex flex-col border-neutral-600 h-[100dvh] sm:h-auto overflow-hidden"
      style={{
        width: "100%",
        maxWidth: width * multiplier + padding * 2 + 2,
      }}
    >
      {children}
    </div>
  );
}

function Title() {
  const [canvas] = useAtom(canvasAtom);
  const [showInfo, setShowInfo] = useAtom(showInfoAtom);

  return (
    <div className="w-full flex justify-between border-b select-none border-neutral-600">
      <div className="px-3 py-2">Conservation</div>
      <div className="flex">
        <button
          className={`px-3 py-2 bg-neutral-900 border-l border-neutral-600 ${
            showInfo ? "bg-neutral-600" : ""
          }`}
          onClick={() => {
            setShowInfo(!showInfo);
          }}
        >
          ?
        </button>
        <button
          className="px-3 py-2 bg-neutral-900 border-l border-neutral-600"
          onClick={async () => {
            const downloadCanvas = document.createElement("canvas");
            downloadCanvas.width = width * multiplier;
            downloadCanvas.height = height * multiplier;
            const dtx = downloadCanvas.getContext("2d")!;
            dtx.imageSmoothingEnabled = false;
            dtx.drawImage(
              canvas!,
              0,
              0,
              width * multiplier,
              height * multiplier,
            );

            dtx.canvas.toBlob(async (blob) => {
              const imageURL = URL.createObjectURL(blob!);
              let link = document.createElement("a");
              link.setAttribute(
                "download",
                "conservation-" +
                  Math.round(new Date().getTime() / 1000) +
                  ".png",
              );
              link.setAttribute("href", imageURL);
              link.dispatchEvent(
                new MouseEvent(`click`, {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                }),
              );
            });
          }}
        >
          <div className=" relative -top-px">
            <ArrowDown size={16} />
          </div>
        </button>
      </div>
    </div>
  );
}

function ZoomCanvas() {
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRawRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lockedDirRef = useRef<"x" | "y" | null>(null);
  const [size] = useAtom(sizeAtom);
  const [canvas] = useAtom(canvasAtom);
  const [color] = useAtom(colorAtom);
  const [orderRef] = useAtom(orderRefAtom);
  const intervalRef = useRef<number | null>(null);
  const [canvasPreview] = useAtom(canvasPreviewAtom);
  const [camera, setCamera] = useAtom(cameraAtom);
  const setZoomCanvas = useSetAtom(zoomCanvasAtom);

  useEffect(() => {
    const zc = zoomCanvasRef.current!;
    setZoomCanvas(zc);
    const ztx = zc.getContext("2d")!;
    ztx.drawImage(canvas!, 0, 0, width, height);
  }, []);

  function drawBrush(x: number, y: number, rad: number) {
    const c = canvas!;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, c.width, c.height);

    const data = imageData.data;

    const sorted = orderRef.current.slice().sort((a, b) => {
      const aX = a % width;
      const aY = Math.floor(a / width);
      const bX = b % width;
      const bY = Math.floor(b / width);
      const aDist = Math.sqrt((aX - x) ** 2 + (aY - y) ** 2);
      const bDist = Math.sqrt((bX - x) ** 2 + (bY - y) ** 2);
      return aDist - bDist;
    });

    const { r, g, b } = hexToRgb(color)!;

    const filtered = sorted.filter((rawIndex) => {
      let srcIndex = rawIndex * 4;
      const srcR = data[srcIndex + 0];
      const srcG = data[srcIndex + 1];
      const srcB = data[srcIndex + 2];
      return !(srcR === r && srcG === g && srcB === b);
    });
    const excluded = orderRef.current.filter((rawIndex) => {
      let srcIndex = rawIndex * 4;
      const srcR = data[srcIndex + 0];
      const srcG = data[srcIndex + 1];
      const srcB = data[srcIndex + 2];
      return srcR === r && srcG === g && srcB === b;
    });
    filtered.push(...excluded.reverse());

    let diffR = 0;
    let diffG = 0;
    let diffB = 0;

    for (let i = 0; i <= rad * 2; i++) {
      const x2 = x - rad + i;
      for (let j = 0; j <= rad * 2; j++) {
        const y2 = y - rad + j;
        const rawIndex = y2 * width + x2;
        const index = rawIndex * 4;
        const dist = Math.sqrt((x2 - x) ** 2 + (y2 - y) ** 2);
        if (Math.round(dist) > rad) continue;
        if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) continue;
        const orderIndex = orderRef.current.indexOf(rawIndex);
        orderRef.current.splice(orderIndex, 1);
        orderRef.current.unshift(rawIndex);

        if (
          r === data[index + 0] &&
          g === data[index + 1] &&
          b === data[index + 2]
        )
          continue;
        diffR += r - data[index + 0];
        diffG += g - data[index + 1];
        diffB += b - data[index + 2];
        data[index + 0] = r;
        data[index + 1] = g;
        data[index + 2] = b;
      }
    }

    let rfill = 0;
    let gfill = 0;
    let bfill = 0;

    // ctx.putImageData(imageData, 0, 0);
    // return
    for (let i = 0; i < filtered.length; i++) {
      let rawIndex = filtered[i];

      let srcIndex = rawIndex * 4;

      const srcR = data[srcIndex + 0];
      const srcG = data[srcIndex + 1];
      const srcB = data[srcIndex + 2];

      const dist = Math.round(
        Math.sqrt(
          (x - (rawIndex % width)) ** 2 +
            (y - Math.floor(rawIndex / width)) ** 2,
        ),
      );
      if (dist <= rad) continue;

      if (rfill !== diffR) {
        if (diffR < 0) {
          const needToPlaceR = Math.abs(diffR) + rfill;
          const srcAvailableR = 255 - srcR;
          if (needToPlaceR > srcAvailableR) {
            data[srcIndex + 0] = 255;
            rfill -= srcAvailableR;
          } else {
            data[srcIndex + 0] = srcR + needToPlaceR;
            rfill -= needToPlaceR;
          }
        } else if (diffR > 0) {
          if (rfill < diffR) {
            const needR = diffR - rfill;
            if (srcR <= needR) {
              data[srcIndex + 0] = 0;
              rfill += srcR;
            } else {
              data[srcIndex + 0] = srcR - needR;
              rfill += needR;
            }
          }
        }
      }

      if (gfill !== diffG) {
        if (diffG < 0) {
          const needToPlaceG = Math.abs(diffG) + gfill;
          const srcAvailableG = 255 - srcG;
          if (needToPlaceG > srcAvailableG) {
            data[srcIndex + 1] = 255;
            gfill -= srcAvailableG;
          } else {
            data[srcIndex + 1] = srcG + needToPlaceG;
            gfill -= needToPlaceG;
          }
        } else if (diffG > 0) {
          if (gfill < diffG) {
            const needG = diffG - gfill;
            if (srcG <= needG) {
              data[srcIndex + 1] = 0;
              gfill += srcG;
            } else {
              data[srcIndex + 1] = srcG - needG;
              gfill += needG;
            }
          }
        }
      }

      if (bfill !== diffB) {
        if (diffB < 0) {
          const needToPlaceB = Math.abs(diffB) + bfill;
          const srcAvailableB = 255 - srcB;
          if (needToPlaceB > srcAvailableB) {
            data[srcIndex + 2] = 255;
            bfill -= srcAvailableB;
          } else {
            data[srcIndex + 2] = srcB + needToPlaceB;
            bfill -= needToPlaceB;
          }
        } else if (diffB > 0) {
          if (bfill < diffB) {
            const needB = diffB - bfill;
            if (srcB <= needB) {
              data[srcIndex + 2] = 0;
              bfill += srcB;
            } else {
              data[srcIndex + 2] = srcB - needB;
              bfill += needB;
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const ptx = canvasPreview!.getContext("2d")!;
    ptx.imageSmoothingEnabled = false;
    ptx.fillStyle = color;
    ptx.fillRect(0, 0, width, height);
    ptx.drawImage(c, 0, 0, width, height);

    drawZoomBox(ptx, {
      x: -cameraRef.current.x,
      y: -cameraRef.current.y,
      width: width / cameraRef.current.z,
      height: height / cameraRef.current.z,
    });
    // ctx.scale(camera.z, camera.z);
    // ctx.translate(camera.x, camera.y);

    const ztx = zoomCanvasRef.current!.getContext("2d")!;
    ztx.imageSmoothingEnabled = false;
    ztx.clearRect(0, 0, width, height);
    ztx.drawImage(c, 0, 0, width, height);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      // Save to local storage
      localStorage.setItem("canvas", c.toDataURL());
      localStorage.setItem("order", JSON.stringify(orderRef.current));
    }, 500);
  }

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const bindGesture = useGesture({
    onPointerUp: () => {
      if (lastPointRawRef.current === null) return;
      lastPointRawRef.current = null;
      lastPointRef.current = null;
    },
    onDrag: ({ event, xy: [rawX, rawY], last, movement: [dx, dy] }) => {
      const styleWidth = parseInt(zoomCanvasRef.current!.style.width);
      const e = event as PointerEvent;
      const bounds = zoomCanvasRef.current!.getBoundingClientRect();
      let x =
        Math.floor((rawX - bounds.left) / camera.z / (styleWidth / width)) -
        camera.x;
      let y =
        Math.floor((rawY - bounds.top) / camera.z / (styleWidth / width)) -
        camera.y;

      if (e.shiftKey) {
        if (lockedDirRef.current === null) {
          if (dx > dy) {
            lockedDirRef.current = "x";
            y = lastPointRef.current!.y;
          } else if (dy > dx) {
            lockedDirRef.current = "y";
            x = lastPointRef.current!.x;
          }
        } else if (lockedDirRef.current === "x") {
          y = lastPointRef.current!.y;
        } else if (lockedDirRef.current === "y") {
          x = lastPointRef.current!.x;
        }
      }

      if (last) {
        lockedDirRef.current = null;
      }

      lastPointRawRef.current = {
        x: rawX,
        y: rawY,
      };
      lastPointRef.current = { x, y };
      drawBrush(x, y, size);
    },
  });

  useEffect(() => {
    function handleResize() {
      const zc = zoomCanvasRef.current!;
      zc.style.width =
        Math.min(width * multiplier, window.innerWidth - padding * 2) + "px";
      zc.style.height = zc.style.width;
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      className="grow flex items-center justify-center sm:py-3 cursor-crosshair touch-none"
      {...bindGesture()}
    >
      <canvas
        ref={zoomCanvasRef}
        className="bg-neutral-900"
        width={width}
        height={height}
        style={{
          width: width * multiplier,
          height: height * multiplier,
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

function Size() {
  const [size, setSize] = useAtom(sizeAtom);

  return (
    <div className="px-3 py-2 flex w-full flex-col gap-2">
      <div>Size</div>
      <div className="h-6 flex items-center gap-2">
        <Slider
          min={0}
          max={7}
          step={1}
          value={[size]}
          onValueChange={(v) => {
            setSize(v[0]);
          }}
        />
        <div>{size + 1}</div>
      </div>
    </div>
  );
}

function Zoom() {
  const setCanvasPreview = useSetAtom(canvasPreviewAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas] = useAtom(canvasAtom);
  const [zoomCanvas] = useAtom(zoomCanvasAtom);
  const [camera, setCamera] = useAtom(cameraAtom);
  const [previewCanvas] = useAtom(canvasPreviewAtom);

  useEffect(() => {
    setCanvasPreview(canvasRef.current!);

    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(canvas!, 0, 0, width, height);
  }, []);

  useEffect(() => {
    if (zoomCanvas === null) return;
    if (previewCanvas === null) return;

    const ztx = zoomCanvas!.getContext("2d")!;
    ztx.resetTransform();
    ztx.clearRect(0, 0, width, height);
    ztx.scale(camera.z, camera.z);
    ztx.translate(camera.x, camera.y);
    ztx.drawImage(canvas!, 0, 0, width, height);

    const ptx = previewCanvas!.getContext("2d")!;
    ptx.imageSmoothingEnabled = false;
    ptx.clearRect(0, 0, width, height);
    ptx.drawImage(canvas!, 0, 0, width, height);

    drawZoomBox(ptx, {
      x: -camera.x,
      y: -camera.y,
      width: width / camera.z,
      height: height / camera.z,
    });
  }, [zoomCanvas, previewCanvas, camera]);

  function boundX(newCamera: Camera) {
    return Math.max(-width + width / newCamera.z, Math.min(0, newCamera.x));
  }
  function boundY(newCamera: Camera) {
    return Math.max(-height + height / newCamera.z, Math.min(0, newCamera.y));
  }

  const bindGesture = useGesture({
    onDrag: ({ xy: [rawX, rawY] }) => {
      const bounds = canvasRef.current!.getBoundingClientRect();
      const x = Math.floor(rawX - bounds.left) - width / camera.z / 2;
      const y = Math.floor(rawY - bounds.top) - height / camera.z / 2;
      if (camera.z === 1) return;
      setCamera({
        x: boundX({
          x: -x,
          y: camera.y,
          z: camera.z,
        }),
        y: boundY({
          x: camera.x,
          y: -y,
          z: camera.z,
        }),
        z: camera.z,
      });
    },
  });

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <div className="px-3 pt-2">zoom</div>
        <div className="flex items-center gap-2 px-3">
          <div className="flex gap-2">
            <button
              className="w-6 h-6 bg-neutral-900 flex items-center justify-center"
              onClick={() => {
                if (camera.z != 1) {
                  const newCamera = zoomCamera(
                    camera,
                    { x: width / 2, y: height / 2 },
                    camera.z / 2,
                  );
                  newCamera.x = boundX(newCamera);
                  newCamera.y = boundY(newCamera);
                  setCamera(newCamera);
                }
              }}
            >
              <MinusIcon size={16} />
            </button>

            <button
              className="w-6 h-6 bg-neutral-900 flex items-center justify-center"
              onClick={() => {
                if (camera.z != 4) {
                  setCamera(
                    zoomCamera(
                      camera,
                      { x: width / 2, y: height / 2 },
                      camera.z * 2,
                    ),
                  );
                }
              }}
            >
              <PlusIcon size={16} />
            </button>
          </div>
          <div className="">
            <div>{Math.floor(camera.z * 100)}%</div>
          </div>
        </div>
      </div>
      <div className="py-2 pr-3">
        <canvas
          ref={canvasRef}
          {...bindGesture()}
          className="bg-neutral-900 cursor-move"
          width={width}
          height={height}
        />
      </div>
    </div>
  );
}

function RgbSliders() {
  const [color, setColor] = useAtom(colorAtom);
  const rgb = hexToRgb(color)!;
  const lookup = { r: "#ff0000", g: "#00ff00", b: "#0000ff" } as const;
  const [size] = useAtom(sizeAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    const centerX = Math.floor(c.width / 2);
    const centerY = Math.floor(c.height / 2);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const dist = Math.round(
          Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2),
        );
        if (dist > size) continue;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [color, size]);

  return (
    <div className="flex items-center border-b pb-2 border-neutral-600">
      <div className="flex grow px-3 py-2 flex-col gap-3">
        {(["r", "g", "b"] as const).map((color) => (
          <div key={color} className="flex items-center gap-2">
            <div className="uppercase text-left">{color}</div>
            <div className="h-6 flex grow">
              <Slider
                min={0}
                max={255}
                step={1}
                key={color}
                value={[rgb[color]]}
                onValueChange={(v) => {
                  setColor(
                    rgbToHex(
                      color === "r" ? v[0] : rgb.r,
                      color === "g" ? v[0] : rgb.g,
                      color === "b" ? v[0] : rgb.b,
                    ),
                  );
                }}
                // @ts-ignore
                bgCustom={lookup[color] as any}
              />
            </div>
            <div className="w-[3ch] text-right">{rgb[color]}</div>
          </div>
        ))}
      </div>
      <canvas
        width={Math.floor(136 / multiplier)}
        height={136 / multiplier}
        ref={canvasRef}
        className="ml-1 mr-3 bg-neutral-900"
        style={{
          width: 112,
          height: 112,
          imageRendering: "pixelated",
        }}
      ></canvas>
    </div>
  );
}

function Palette() {
  const [color, setColor] = useAtom(colorAtom);

  const { r, g, b } = hexToRgb(color)!;
  const inverted = rgbToHex(255 - r, 255 - g, 255 - b);

  return (
    <div className="flex gap-2 py-2 w-full border-t border-neutral-600 px-3">
      <div className="flex flex-wrap gap-2 grow">
        {[
          "#000000",
          "#ffffff",
          "#ff0000",
          "#00ff00",
          "#0000ff",
          "#ffff00",
          "#ff00ff",
          "#00ffff",
        ].map((c) => (
          <button
            key={c}
            className="w-6 h-6 border-white border"
            style={{
              backgroundColor: c,
              borderColor: color === c ? "white" : "#282828",
            }}
            onClick={() => {
              setColor(c);
            }}
          ></button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          className="flex px-1 font-mono text-sm items-center"
          style={{
            background: inverted,
            color: color,
          }}
          onClick={() => {
            setColor(inverted);
          }}
        >
          <div className="relative top-[2px]">INVERT</div>
        </button>
        <button
          className="flex bg-neutral-600 px-1 font-mono text-sm items-center"
          onClick={() => {
            setColor(
              rgbToHex(
                Math.floor(Math.random() * 255),
                Math.floor(Math.random() * 255),
                Math.floor(Math.random() * 255),
              ),
            );
          }}
        >
          <div className="relative top-[2px] uppercase">random</div>
        </button>
      </div>
    </div>
  );
}

interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

function screenToCanvas(point: Point, camera: Camera): Point {
  return {
    x: point.x / camera.z - camera.x,
    y: point.y / camera.z - camera.y,
  };
}

function canvasToScreen(point: Point, camera: Camera): Point {
  return {
    x: (point.x + camera.x) * camera.z,
    y: (point.y + camera.y) * camera.z,
  };
}

function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return {
    x: camera.x - dx / camera.z,
    y: camera.y - dy / camera.z,
    z: camera.z,
  };
}

function zoomCamera(camera: Camera, point: Point, zoom: number): Camera {
  const p1 = screenToCanvas(point, camera);

  const p2 = screenToCanvas(point, { ...camera, z: zoom });

  return {
    x: camera.x + (p2.x - p1.x),
    y: camera.y + (p2.y - p1.y),
    z: zoom,
  };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function drawZoomBox(ptx: CanvasRenderingContext2D, box: Box) {
  ptx.strokeStyle = "black";
  ptx.lineWidth = 2;
  ptx.strokeRect(box.x, box.y, box.width, box.height);
  ptx.strokeStyle = "white";
  ptx.lineWidth = 1;
  ptx.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
}
