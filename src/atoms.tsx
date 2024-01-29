import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Camera } from "./ArchiveApp";

export const canvasAtom = atom<HTMLCanvasElement | null>(null);

export const canvasPreviewAtom = atom<HTMLCanvasElement | null>(null);
export const zoomCanvasAtom = atom<HTMLCanvasElement | null>(null);

export const cameraAtom = atom<Camera>({ x: 0, y: 0, z: 1 });
export const sizeAtom = atomWithStorage("size", 3);

export const colorAtom = atomWithStorage("color-atom", "#000000");

export const orderRefAtom = atom<{ current: number[] }>({ current: [] });

export const showInfoAtom = atom<boolean>(false);
