import { useEffect, useRef } from "react";
import { height, multiplier, orderMultiplier, padding, width } from "./consts";
import {
  cameraAtom,
  canvasAtom,
  colorAtom,
  orderDrawBumpAtom,
  orderRefAtom,
  sizeAtom,
  zoomCanvasAtom,
} from "./atoms";
import { useAtom, useSetAtom } from "jotai";
import { hexToRgb, rgbToHex } from "./utils";
import { Slider } from "./components";
import { ArrowDown } from "lucide-react";
import { useGesture } from "@use-gesture/react";

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

function zoomCamera(camera: Camera, point: Point, dz: number): Camera {
  const zoom = camera.z - dz * camera.z;

  const p1 = screenToCanvas(point, camera);

  const p2 = screenToCanvas(point, { ...camera, z: zoom });

  return {
    x: camera.x + (p2.x - p1.x),
    y: camera.y + (p2.y - p1.y),
    z: zoom,
  };
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function getViewport(camera: Camera, box: Box): Box {
  const topLeft = screenToCanvas({ x: box.minX, y: box.minY }, camera);
  const bottomRight = screenToCanvas({ x: box.maxX, y: box.maxY }, camera);

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
    height: bottomRight.x - topLeft.x,
    width: bottomRight.y - topLeft.y,
  };
}

function App() {
  const [color, setColor] = useAtom(colorAtom);
  const [canvas] = useAtom(canvasAtom);

  const { r, g, b } = hexToRgb(color);
  const inverted = rgbToHex(255 - r, 255 - g, 255 - b);
  return (
    <div className="flex flex-col gap-2 items-center justify-center min-h-[100dvh]">
      <div className="border border-neutral-600">
        <div className="flex items-center leading-4 border-neutral-600 border-b justify-between w-full">
          <div className="text-white font-mono pl-3">EQUILIBRIUM</div>
          <button
            className="text-white border-l border-neutral-600 hover:bg-neutral-900 px-3 py-3"
            title="Download image"
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
                  "equilibrium-" +
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
            <ArrowDown size={16} />
          </button>
        </div>
        <Canvas />
        <div className="flex">
          <div className="w-1/2">
            <Sizer />
          </div>
          <div className="w-1/2 text-white font-mono uppercase flex py-3 px-3 border-neutral-600 border-l border-t border-b">
            <Zoom />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 pb-3 pt-4 w-full">
          <div className="text-white font-mono uppercase">Color</div>
          <div className="flex gap-2">
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
                className="w-6 h-6 border-white border-2"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "white" : "transparent",
                }}
                onClick={() => {
                  setColor(c);
                }}
              ></button>
            ))}
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
          </div>
        </div>
        <RgbSliders />
        <div
          className="hidden gap-2 justify-between items-center"
          style={{
            width: width * multiplier,
          }}
        >
          <Controls />
          <OrderCanvas />
        </div>
      </div>
    </div>
  );
}

export default App;

function Zoom() {
  return (
    <div>
      <div className="px-3 flex items-center text-white py-3 font-mono uppercase justify-between">
        <div>Zoom</div>
        <canvas width={width} height={height} />
      </div>
    </div>
  );
}

function Canvas() {
  const [orderRef] = useAtom(orderRefAtom);
  const [color] = useAtom(colorAtom);
  const [size] = useAtom(sizeAtom);
  const setCanvas = useSetAtom(canvasAtom);
  const setZoomCanvas = useSetAtom(zoomCanvasAtom);
  const intervalRef = useRef<number | null>(null);
  const [camera, setCamera] = useAtom(cameraAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const localCheck = localStorage.getItem("canvas");
    const localOrder = localStorage.getItem("order");
    const c = canvasRef.current!;
    setCanvas(c);
    const z = zoomCanvasRef.current!;
    setZoomCanvas(z);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    if (false && localCheck) {
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
  }, []);

  function drawBrush(x: number, y: number, rad: number) {
    const c = canvasRef.current!;
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

    console.log("ey");

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
    // ctx.scale(camera.z, camera.z);
    // ctx.translate(camera.x, camera.y);

    // const ztx = zoomCanvasRef.current!.getContext("2d")!;
    // ztx.imageSmoothingEnabled = false;
    // ztx.clearRect(0, 0, width, height);
    // ztx.drawImage(c, 0, 0, width, height);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      // Save to local storage
      localStorage.setItem("canvas", c.toDataURL());
      localStorage.setItem("order", JSON.stringify(orderRef.current));
    }, 500);
  }

  const rad = size;
  const lastPointRawRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lockedDirRef = useRef<"x" | "y" | null>(null);

  const bindGesture = useGesture({
    onDrag: ({ event, xy: [rawX, rawY], last, movement: [dx, dy] }) => {
      const e = event as PointerEvent;
      const bounds = canvasRef.current!.getBoundingClientRect();
      let x = Math.floor((rawX - bounds.left) / multiplier);
      let y = Math.floor((rawY - bounds.top) / multiplier);

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
      drawBrush(x, y, rad);
    },
    onWheel: ({ event, xy: [rawX, rawY] }) => {
      console.log("wheel");
      const e = event as WheelEvent;
      const bounds = canvasRef.current!.getBoundingClientRect();
      const x = Math.floor((rawX - bounds.left) / multiplier);
      const y = Math.floor((rawY - bounds.top) / multiplier);
      const dz = e.deltaY / 100;
      const ctx = canvasRef.current!.getContext("2d")!;
      const newCamera = zoomCamera(camera, { x, y }, dz);
      setCamera(newCamera);
      ctx.scale(newCamera.z, newCamera.z);
    },
  });

  return (
    <div>
      <div
        className="cursor-crosshair touch-none"
        style={{
          width: width * multiplier + padding * 2,
          height: height * multiplier + padding * 2,
          padding,
        }}
        {...bindGesture()}
      >
        <canvas
          width={width}
          height={height}
          ref={zoomCanvasRef}
          style={{
            width: width * multiplier,
            height: height * multiplier,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}

function Sizer() {
  const [size, setSize] = useAtom(sizeAtom);
  return (
    <div className="w-full px-3 py-3 border-b border-t border-neutral-600">
      <div className="text-white font-mono uppercase mb-1">Size</div>
      <div className="h-6">
        <div className="flex h-full gap-4 leading-4 items-center">
          <div className="grow h-full">
            <Slider
              min={0}
              max={7}
              step={1}
              value={[size]}
              onValueChange={(v) => {
                setSize(v[0]);
              }}
            />
          </div>
          <div className="text-white font-mono">{size + 1}</div>
        </div>
      </div>
    </div>
  );
}

function OrderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [orderDrawBump] = useAtom(orderDrawBumpAtom);
  const [orderRef] = useAtom(orderRefAtom);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);

    for (let i = 0; i < orderRef.current.length; i++) {
      const index = orderRef.current[i];
      const x = index % width;
      const y = Math.floor(index / width);
      const level = i / orderRef.current.length;
      // convert level to grayscale
      const gray = Math.floor(level * 255);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(
        x * orderMultiplier,
        y * orderMultiplier,
        orderMultiplier,
        orderMultiplier,
      );
    }
  }, [orderDrawBump]);

  return (
    <canvas
      ref={canvasRef}
      width={width * orderMultiplier}
      height={height * orderMultiplier}
    />
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
    <div className="font-mono text-white flex gap-2 px-3 pb-3 pt-1">
      <div className="flex grow flex-col gap-3">
        {(["r", "g", "b"] as const).map((color) => (
          <div className="flex items-center gap-3">
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
        width={Math.floor(104 / multiplier)}
        height={104 / multiplier}
        ref={canvasRef}
        className="ml-1 bg-neutral-700"
        style={{
          width: 104,
          height: 104,
          imageRendering: "pixelated",
        }}
      ></canvas>
    </div>
  );
}

function Controls() {
  const [color, setColor] = useAtom(colorAtom);

  return (
    <div className="flex">
      <div>
        <input
          type="color"
          className="block"
          value={color}
          onChange={(e) => {
            setColor(e.currentTarget.value);
          }}
        />
      </div>
    </div>
  );
}
