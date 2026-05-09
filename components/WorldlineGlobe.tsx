"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  RECENT_ENTRIES,
  OBSERVER_NODES,
  type Entry,
  type ArchiveNode,
} from "@/lib/entries";

/**
 * WorldlineGlobe — A.T.L.A.S. (Archive · Topology · Localizer · Atlas Surface).
 *
 * Three-column instrument frame around a 3D paper-cream globe with engraved
 * line graticules, contour rings, polar axis spine, NeX field shells, and
 * surveyed nodes at real-world coordinates.
 *
 * Strata travel:
 *   ALL   — orbital overview, all layers visible
 *   NeX   — pull camera back, reveal field shells (possibility field)
 *   Ne0N  — fly to north pole, axis-aligned view (the bearer)
 *   Ne0   — dive to surface near α coordinate (Bangkok, the archive)
 *
 * Click any entry pin → camera focuses + article side panel slides in with
 * the entry's title and summary. ESC / outside click reverses.
 */

const GLOBE_RADIUS = 1;

type StratumKey = "all" | "nex" | "neon" | "neo";

type Stratum = {
  key: StratumKey;
  name: string;
  role: string;
  camPos: THREE.Vector3;
  look: THREE.Vector3;
  showField: boolean;
  showAxis: boolean;
  showContours: boolean;
  netra: string;
  netraCoord: string;
  netraRange: string;
  /**
   * NETRA's first-person scene framing for this stratum. Italic, terse,
   * instrumented — feels like an attached probe narrating what it sees.
   */
  voice: string;
  hudCam: string;
  hudRadius: string;
  hudDepth: string;
  hudStratum: string;
  pinShow: boolean;
  flow: "nex" | "neon" | "neo" | null;
};

function latLonToVec3(latDeg: number, lonDeg: number, r = GLOBE_RADIUS) {
  const phi = ((90 - latDeg) * Math.PI) / 180;
  const theta = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    -r * Math.sin(phi) * Math.sin(theta)
  );
}

function vecToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI;
  let lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

function fmtCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const ALPHA_LAT = 13.7563;
const ALPHA_LON = 100.5018;

const STRATA: Record<StratumKey, Stratum> = {
  all: {
    key: "all",
    name: "FULL SYSTEM",
    role: "all strata observed · ne0ex aggregate",
    camPos: new THREE.Vector3(0, 0, 4.2),
    look: new THREE.Vector3(0, 0, 0),
    showField: true,
    showAxis: true,
    showContours: true,
    netra: "STANDBY",
    netraCoord: "0°,0°",
    netraRange: "2.50",
    voice:
      "standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum.",
    hudCam: "ORBIT · 0°",
    hudRadius: "1.00",
    hudDepth: "0.00",
    hudStratum: "FULL · Ne0EX",
    pinShow: false,
    flow: null,
  },
  nex: {
    key: "nex",
    name: "NeX · POSSIBILITY",
    role: "projection field · outer shells emitting outward",
    camPos: new THREE.Vector3(2.2, 1.2, 5.0),
    look: new THREE.Vector3(0, 0, 0),
    showField: true,
    showAxis: true,
    showContours: false,
    netra: "NeX",
    netraCoord: "—",
    netraRange: "3.10",
    voice:
      "possibility shells, 247 rays emitting outward. hypotheses accrete here before they patch into the archive.",
    hudCam: "WIDE · POSSIBILITY",
    hudRadius: "1.48",
    hudDepth: "+0.48",
    hudStratum: "3 · NeX",
    pinShow: false,
    flow: "nex",
  },
  neon: {
    key: "neon",
    name: "Ne0N · NORTH POLE",
    role: "polar axis · the bearer · viewed from above",
    camPos: new THREE.Vector3(0, 3.1, 0.2),
    look: new THREE.Vector3(0, 0.4, 0),
    showField: false,
    showAxis: true,
    showContours: false,
    netra: "Ne0N",
    netraCoord: "90°N",
    netraRange: "1.85",
    voice:
      "polar bearer · viewed from the axis. no surface, only the line that holds the worldline together.",
    hudCam: "POLAR · 90°N",
    hudRadius: "0.85",
    hudDepth: "+1.00",
    hudStratum: "2 · Ne0N",
    pinShow: false,
    flow: "neon",
  },
  neo: {
    key: "neo",
    name: "Ne0 · ARCHIVE",
    role: "surface archive · α coordinate centered",
    camPos: latLonToVec3(ALPHA_LAT, ALPHA_LON, 2.05),
    look: latLonToVec3(ALPHA_LAT, ALPHA_LON, 1.0),
    showField: false,
    showAxis: false,
    showContours: true,
    netra: "Ne0",
    netraCoord: `${ALPHA_LAT.toFixed(2)}°N, ${ALPHA_LON.toFixed(2)}°E`,
    netraRange: "1.42",
    voice:
      "surface archive · 047 patches anchored. α holds the observer locus; the rest are repaired memories at real coordinates.",
    hudCam: "SURFACE · α",
    hudRadius: "1.00",
    hudDepth: "−0.05",
    hudStratum: "1 · Ne0",
    pinShow: true,
    flow: "neo",
  },
};

const STRATA_BUTTONS: { key: StratumKey; id: string; role: string; numKey: string; glyph: React.ReactNode }[] = [
  {
    key: "nex",
    id: "3 · NeX",
    role: "Possibility · Field",
    numKey: "3",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="0" cy="0" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="0" y1="-11" x2="0" y2="-9" stroke="currentColor" strokeWidth="0.7" />
        <line x1="0" y1="9" x2="0" y2="11" stroke="currentColor" strokeWidth="0.7" />
        <line x1="-11" y1="0" x2="-9" y2="0" stroke="currentColor" strokeWidth="0.7" />
        <line x1="9" y1="0" x2="11" y2="0" stroke="currentColor" strokeWidth="0.7" />
      </svg>
    ),
  },
  {
    key: "neon",
    id: "2 · Ne0N",
    role: "Pole · Bearer",
    numKey: "2",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <ellipse cx="0" cy="0" rx="3" ry="9" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <line x1="0" y1="-10" x2="0" y2="10" stroke="currentColor" strokeWidth="0.7" />
      </svg>
    ),
  },
  {
    key: "neo",
    id: "1 · Ne0",
    role: "Surface · Archive",
    numKey: "1",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <circle cx="0" cy="0" r="7" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <path d="M -6 -2 Q -2 -4 2 -2 Q 5 0 6 2" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d="M -6 1 Q -2 -1 2 1 Q 5 3 6 4" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <polygon points="0,-1 1.3,1 -1.3,1" fill="currentColor" />
      </svg>
    ),
  },
];

type SceneRefs = {
  globe: THREE.Group;
  contoursGroup: THREE.Group;
  axisGroup: THREE.Group;
  nexField: THREE.Group;
  raysGroup: THREE.Group;
  northPole: THREE.Group;
  southPole: THREE.Group;
  alphaRing: THREE.Mesh | null;
  arcLine: THREE.Line;
  pinObjects: { entry: Entry; head: THREE.Mesh; hit: THREE.Mesh }[];
  observerObjects: { node: ArchiveNode; head: THREE.Mesh }[];
};

/**
 * Procedural surface textures — paper-cream base with aging, baked lat/long
 * grid, and async-loaded real Earth coastline silhouette multiplied on top.
 * Returns map + roughness + bump textures, plus a `mapUpdater` we call once
 * the coastline image arrives.
 */
function buildSurfaceTextures(): {
  map: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const W = 2048, H = 1024;
  let seed = 9173;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // ─── Albedo ───
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context failed");

  // Pale cream paper base — slightly cooler at poles, paler at equator
  // (was olive #9E9377 / #B5AA8B; lifted to lose the brown weight)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#BDBBAF");
  grad.addColorStop(0.45, "#D2CFC4");
  grad.addColorStop(0.55, "#D2CFC4");
  grad.addColorStop(1, "#BDBBAF");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle aging blotches — cool grey instead of brown
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 18; i++) {
    const x = rand() * W, y = rand() * H;
    const r = 200 + rand() * 300;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, "rgba(70,95,108,0.08)");
    g2.addColorStop(1, "rgba(70,95,108,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Baked lat/long grid — faint dashed
  ctx.strokeStyle = "rgba(31,80,99,0.18)";
  ctx.lineWidth = 0.6;
  ctx.setLineDash([3, 4]);
  for (let lon = 0; lon < 360; lon += 30) {
    const x = (lon / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = 15; lat < 180; lat += 15) {
    const y = (lat / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(31,80,99,0.28)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Light paper grain
  const grainImg = ctx.getImageData(0, 0, W, H);
  const gd = grainImg.data;
  for (let i = 0; i < gd.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    gd[i] = Math.max(0, Math.min(255, gd[i] + n));
    gd[i + 1] = Math.max(0, Math.min(255, gd[i + 1] + n));
    gd[i + 2] = Math.max(0, Math.min(255, gd[i + 2] + n));
  }
  ctx.putImageData(grainImg, 0, 0);

  // ─── Roughness map ───
  const rc = document.createElement("canvas");
  rc.width = W; rc.height = H;
  const rctx = rc.getContext("2d")!;
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, W, H);
  rctx.globalCompositeOperation = "multiply";
  rctx.drawImage(c, 0, 0);
  rctx.globalCompositeOperation = "source-over";
  rctx.fillStyle = "rgba(180,180,180,0.5)";
  rctx.fillRect(0, 0, W, H);

  // ─── Bump map ───
  const bc = document.createElement("canvas");
  bc.width = W; bc.height = H;
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, W, H);
  bctx.globalCompositeOperation = "multiply";
  bctx.drawImage(c, 0, 0);
  bctx.globalCompositeOperation = "lighten";
  bctx.fillStyle = "#666";
  bctx.fillRect(0, 0, W, H);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc);
  const bump = new THREE.CanvasTexture(bc);

  // Async-load real Earth coastline silhouette and multiply over base.
  const earthImg = new Image();
  earthImg.crossOrigin = "anonymous";
  earthImg.onload = () => {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.28;
    ctx.filter = "blur(1.2px)";
    ctx.drawImage(earthImg, 0, 0, W, H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    map.needsUpdate = true;

    // Re-derive bump and roughness from updated albedo.
    rctx.globalCompositeOperation = "source-over";
    rctx.fillStyle = "#c8c8c8"; rctx.fillRect(0, 0, W, H);
    rctx.globalCompositeOperation = "multiply";
    rctx.drawImage(c, 0, 0);
    rough.needsUpdate = true;

    bctx.globalCompositeOperation = "source-over";
    bctx.fillStyle = "#808080"; bctx.fillRect(0, 0, W, H);
    bctx.globalCompositeOperation = "multiply";
    bctx.drawImage(c, 0, 0);
    bump.needsUpdate = true;
  };
  earthImg.src = "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg";

  return { map, rough, bump };
}

function buildScene(): { root: THREE.Group; scene: THREE.Scene; refs: SceneRefs; cleanup: () => void } {
  const scene = new THREE.Scene();
  scene.background = null;

  // Lights — paper material wants soft ambient + low-key key light.
  scene.add(new THREE.AmbientLight(0xefe7d6, 1.15));
  const key = new THREE.DirectionalLight(0xfff4dd, 0.18);
  key.position.set(2, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2a3a48, 0.08);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const globe = new THREE.Group();
  scene.add(globe);

  // ─── Cream paper sphere with procedural textures + earth coastline ───
  const surface = buildSurfaceTextures();
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 128);
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: surface.map,
    roughnessMap: surface.rough,
    roughness: 0.95,
    bumpMap: surface.bump,
    bumpScale: 0.008,
    metalness: 0,
  });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  // Inner darker shell — gives depth at the rim.
  const innerShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.998, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xb4bbc0, side: THREE.BackSide, transparent: true, opacity: 0.35 })
  );
  globe.add(innerShade);

  // ─── Engraved lat/long lines (the user explicitly wanted line contour) ───
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.55 });
  const lineMatFaint = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.3 });

  const makeLatRing = (latDeg: number, mat: THREE.LineBasicMaterial) => {
    const lat = (latDeg * Math.PI) / 180;
    const r = Math.cos(lat);
    const y = Math.sin(lat);
    const pts: THREE.Vector3[] = [];
    const segs = 128;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r * 1.001, y * 1.001, Math.sin(a) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };
  const makeMeridian = (lonDeg: number, mat: THREE.LineBasicMaterial) => {
    const lon = (lonDeg * Math.PI) / 180;
    const pts: THREE.Vector3[] = [];
    const segs = 128;
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI - Math.PI / 2;
      const r = Math.cos(t);
      pts.push(new THREE.Vector3(Math.cos(lon) * r * 1.001, Math.sin(t) * 1.001, Math.sin(lon) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };

  globe.add(makeLatRing(0, lineMat)); // equator stronger
  for (let lat = -75; lat <= 75; lat += 15) if (lat !== 0) globe.add(makeLatRing(lat, lineMatFaint));
  for (let lon = 0; lon < 360; lon += 15) {
    const mat = lon % 90 === 0 ? lineMat : lineMatFaint;
    globe.add(makeMeridian(lon, mat));
  }

  // ─── Contour rings — irregular elevation lines on the surface ───
  const contoursGroup = new THREE.Group();
  globe.add(contoursGroup);
  const contourMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.7 });
  const makeContour = (latCenter: number, ampl: number, phase: number) => {
    const pts: THREE.Vector3[] = [];
    const segs = 256;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const lat =
        ((latCenter + ampl * (Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 + phase * 1.7) * 0.4)) * Math.PI) /
        180;
      const r = Math.cos(lat);
      const y = Math.sin(lat);
      pts.push(new THREE.Vector3(Math.cos(a) * r * 1.003, y * 1.003, Math.sin(a) * r * 1.003));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), contourMat.clone());
  };
  [-65, -45, -25, -5, 15, 35, 55].forEach((lat, i) => {
    contoursGroup.add(makeContour(lat, 6, i * 1.7));
  });

  // ─── Ne0N — polar axis spine + survey-triangle caps + pole beacons ───
  const axisGroup = new THREE.Group();
  globe.add(axisGroup);
  const axisCylinderMat = new THREE.MeshBasicMaterial({ color: 0x1f5063 });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 16), axisCylinderMat);
  axisGroup.add(axis);

  const axisLineMat = new THREE.LineBasicMaterial({ color: 0x1f5063 });
  const axisCap = (yPos: number, dir: number) => {
    const g = new THREE.Group();
    const sz = 0.04;
    const tip = new THREE.Vector3(0, yPos + dir * 0.06, 0);
    const a = new THREE.Vector3(sz, yPos, 0);
    const b = new THREE.Vector3(-sz, yPos, 0);
    const c = new THREE.Vector3(0, yPos, sz);
    const d = new THREE.Vector3(0, yPos, -sz);
    const segs: [THREE.Vector3, THREE.Vector3][] = [
      [tip, a], [tip, b], [tip, c], [tip, d],
      [a, c], [c, b], [b, d], [d, a],
    ];
    for (const [p, q] of segs) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, q]), axisLineMat));
    }
    return g;
  };
  axisGroup.add(axisCap(1.3, 1));
  axisGroup.add(axisCap(-1.3, -1));

  const poleBeacon = (yPos: number, dir: number) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.04, 0.05, 48),
      new THREE.MeshBasicMaterial({ color: 0xd4602a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yPos;
    g.add(ring);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd4602a })
    );
    dot.position.y = yPos;
    g.add(dot);
    g.userData.dir = dir;
    return g;
  };
  const northPole = poleBeacon(1.0, 1);
  const southPole = poleBeacon(-1.0, -1);
  globe.add(northPole, southPole);

  // ─── NeX — possibility field: concentric translucent wireframe spheres + radial rays ───
  const nexField = new THREE.Group();
  scene.add(nexField);
  const makeShell = (radius: number, opacity: number) => {
    const m = new THREE.MeshBasicMaterial({
      color: 0x1f5063,
      wireframe: true,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), m);
  };
  nexField.add(makeShell(1.18, 0.1), makeShell(1.32, 0.07), makeShell(1.48, 0.05));

  const raysGroup = new THREE.Group();
  nexField.add(raysGroup);
  const rayMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 48; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / 48));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = Math.sin(phi) * Math.sin(theta);
    const inner = new THREE.Vector3(dx * 1.18, dy * 1.18, dz * 1.18);
    const outer = new THREE.Vector3(dx * 1.55, dy * 1.55, dz * 1.55);
    raysGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([inner, outer]), rayMat));
  }

  // ─── Ne0 — surveyed archive nodes at real-world coordinates ───
  const nodesGroup = new THREE.Group();
  globe.add(nodesGroup);

  const nodeMatInk = new THREE.MeshBasicMaterial({ color: 0x1f5063 });
  const nodeMatAcc = new THREE.MeshBasicMaterial({ color: 0xd4602a });

  // Entry pins (clickable, with hit proxies for raycaster)
  const pinObjects: { entry: Entry; head: THREE.Mesh; hit: THREE.Mesh }[] = [];
  for (const e of RECENT_ENTRIES) {
    const v = latLonToVec3(e.coords.lat, e.coords.lon, 1.005);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), nodeMatInk.clone());
    head.position.copy(v);
    nodesGroup.add(head);

    const hitGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.copy(v);
    hit.renderOrder = 999;
    hit.userData.entry = e.fileNum;
    nodesGroup.add(hit);

    pinObjects.push({ entry: e, head, hit });
  }

  // Observer nodes (α + 012 + 047, not clickable)
  let alphaRing: THREE.Mesh | null = null;
  const observerObjects: { node: ArchiveNode; head: THREE.Mesh }[] = [];
  for (const n of OBSERVER_NODES) {
    const v = latLonToVec3(n.coords.lat, n.coords.lon, 1.005);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(n.primary ? 0.018 : 0.01, 12, 12),
      n.primary ? nodeMatAcc.clone() : nodeMatInk.clone()
    );
    head.position.copy(v);
    nodesGroup.add(head);

    if (n.primary) {
      alphaRing = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.038, 32),
        new THREE.MeshBasicMaterial({ color: 0xd4602a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      alphaRing.position.copy(v.clone().multiplyScalar(1.001));
      alphaRing.lookAt(0, 0, 0);
      alphaRing.rotateY(Math.PI);
      globe.add(alphaRing);
    }
    observerObjects.push({ node: n, head });
  }

  // ─── Worldline arc — α point swooping out into NeX field ───
  const arcStart = latLonToVec3(ALPHA_LAT, ALPHA_LON, 1.01);
  const arcMid = arcStart.clone().multiplyScalar(1.35).add(new THREE.Vector3(0.2, 0.15, 0));
  const arcEnd = arcStart.clone().multiplyScalar(1.55).add(new THREE.Vector3(0.4, 0.3, -0.1));
  const arcCurve = new THREE.QuadraticBezierCurve3(arcStart, arcMid, arcEnd);
  const arcPts = arcCurve.getPoints(64);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
  const arcMat = new THREE.LineDashedMaterial({
    color: 0xd4602a,
    dashSize: 0.05,
    gapSize: 0.03,
    transparent: true,
    opacity: 0.95,
  });
  const arcLine = new THREE.Line(arcGeo, arcMat);
  arcLine.computeLineDistances();
  scene.add(arcLine);

  return {
    root: globe,
    scene,
    refs: {
      globe,
      contoursGroup,
      axisGroup,
      nexField,
      raysGroup,
      northPole,
      southPole,
      alphaRing,
      arcLine,
      pinObjects,
      observerObjects,
    },
    cleanup: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else (m.material as THREE.Material).dispose();
        }
      });
    },
  };
}

export function WorldlineGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [stratum, setStratum] = useState<StratumKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live readouts driven via DOM refs (mutated each frame inside the render
  // loop) — keeps the component from re-rendering 60×/sec and prevents the
  // ResizeObserver→renderer.setSize feedback that produced the shake.
  const hudCamRef = useRef<HTMLSpanElement | null>(null);
  const netraCoordRef = useRef<HTMLSpanElement | null>(null);
  const netraRangeRef = useRef<HTMLSpanElement | null>(null);
  // Target name only changes on click — fine to use React state.
  const [netraTarget, setNetraTarget] = useState("STANDBY");

  const stratumRef = useRef<StratumKey>("all");
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { stratumRef.current = stratum; }, [stratum]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const entryById = useMemo(
    () => Object.fromEntries(RECENT_ENTRIES.map((e) => [e.fileNum, e])),
    []
  );
  const selected = selectedId ? entryById[selectedId] : null;

  const t = STRATA[stratum];

  /**
   * NETRA voice — companion-intelligence framing line shown below the console.
   * When a pin is selected it speaks about that node. Otherwise it speaks
   * about the current stratum. Italic, lowercase, terse — never chatty.
   */
  const netraVoice = selected
    ? `trace · "${selected.title.toLowerCase()}". patched ${selected.date} · anchored ${selected.coords.place.toLowerCase()}.`
    : t.voice;

  // ESC closes article panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedIdRef.current) setSelectedId(null);
        else setStratum("all");
      } else if (e.key === "1") setStratum((s) => (s === "neo" ? "all" : "neo"));
      else if (e.key === "2") setStratum((s) => (s === "neon" ? "all" : "neon"));
      else if (e.key === "3") setStratum((s) => (s === "nex" ? "all" : "nex"));
      else if (e.key === "0") setStratum("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Jump-to-next-node (NETRA) — cycles through observer + entry nodes.
  const jumpIdxRef = useRef(0);
  const jumpTargetsRef = useRef<{ label: string; place: string; coords: { lat: number; lon: number } }[]>([]);
  useEffect(() => {
    jumpTargetsRef.current = [
      ...OBSERVER_NODES.map((n) => ({ label: n.label, place: n.coords.place, coords: { lat: n.coords.lat, lon: n.coords.lon } })),
      ...RECENT_ENTRIES.map((e) => ({ label: e.fileNum, place: e.coords.place, coords: { lat: e.coords.lat, lon: e.coords.lon } })),
    ];
  }, []);

  // ─── THREE setup ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scene, refs, cleanup } = buildScene();

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 4.2);
    const currentLook = new THREE.Vector3(0, 0, 0);
    camera.lookAt(currentLook);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const r = container.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Drag to orbit (only in 'all' or 'nex').
    let dragging = false;
    let lastX = 0;
    let baseRotY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMoveDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const sk = stratumRef.current;
      if (sk === "all" || sk === "nex") {
        baseRotY += dx * 0.005;
        refs.globe.rotation.y = baseRotY;
      }
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMoveDrag);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    // Pin click via raycaster.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onClick = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(refs.pinObjects.map((p) => p.hit), false);
      if (hits.length > 0) {
        const fileNum = (hits[0].object as THREE.Mesh).userData.entry as string | undefined;
        if (fileNum) setSelectedId(fileNum);
      } else if (selectedIdRef.current) {
        setSelectedId(null);
      }
    };
    const onHover = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(refs.pinObjects.map((p) => p.hit), false);
      renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "";
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("pointermove", onHover);

    // ─── Camera transitions per stratum ───
    let cameraAnim: ((now: number) => void) | null = null;
    const applyStratum = (key: StratumKey) => {
      const T = STRATA[key];
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const endPos = T.camPos.clone();
      const endLook = T.look.clone();
      const dur = 1400;
      const t0 = performance.now();
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(startPos, endPos, e);
        currentLook.lerpVectors(startLook, endLook, e);
        camera.lookAt(currentLook);
        if (k >= 1) cameraAnim = null;
      };
      refs.nexField.visible = T.showField;
      refs.axisGroup.visible = T.showAxis;
      refs.contoursGroup.visible = T.showContours;
      refs.arcLine.visible = key !== "neon" && key !== "neo";
    };
    // Expose for state changes from outside the effect.
    (window as unknown as { __atlasApplyStratum?: (k: StratumKey) => void }).__atlasApplyStratum = applyStratum;

    // Entry-selected camera focus — orbit camera to face the selected pin's world position.
    const applySelected = (id: string | null) => {
      if (!id) {
        applyStratum(stratumRef.current);
        return;
      }
      const entry = RECENT_ENTRIES.find((e) => e.fileNum === id);
      if (!entry) return;
      const v = latLonToVec3(entry.coords.lat, entry.coords.lon, 1.0);
      const camTarget = v.clone().multiplyScalar(2.4);
      const lookTarget = v.clone();
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const dur = 1100;
      const t0 = performance.now();
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(startPos, camTarget, e);
        currentLook.lerpVectors(startLook, lookTarget, e);
        camera.lookAt(currentLook);
        if (k >= 1) cameraAnim = null;
      };
    };
    (window as unknown as { __atlasApplySelected?: (id: string | null) => void }).__atlasApplySelected = applySelected;

    // NETRA jump.
    (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump = () => {
      const targets = jumpTargetsRef.current;
      if (!targets.length) return;
      jumpIdxRef.current = (jumpIdxRef.current + 1) % targets.length;
      const n = targets[jumpIdxRef.current];
      const dest = latLonToVec3(n.coords.lat, n.coords.lon, 2.6);
      const startPos = camera.position.clone();
      const t0 = performance.now();
      const dur = 1100;
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(startPos, dest, e);
        camera.lookAt(0, 0, 0);
        currentLook.set(0, 0, 0);
        if (k >= 1) cameraAnim = null;
      };
      setNetraTarget(`${n.label} · ${n.place}`);
    };

    // Initial stratum.
    applyStratum("all");

    // Render loop — setInterval for harness robustness.
    let lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.06);
      lastT = now;
      const sk = stratumRef.current;

      if (!selectedIdRef.current) {
        if (sk === "all") {
          baseRotY += dt * 0.10;
          refs.globe.rotation.y = baseRotY;
          refs.nexField.rotation.y = -baseRotY * 0.4;
          refs.raysGroup.rotation.y = baseRotY * 0.6;
        } else if (sk === "nex") {
          refs.nexField.rotation.y += dt * 0.08;
          refs.raysGroup.rotation.y -= dt * 0.06;
          refs.globe.rotation.y += dt * 0.04;
          baseRotY = refs.globe.rotation.y;
        } else if (sk === "neon") {
          refs.globe.rotation.y += dt * 0.18;
          baseRotY = refs.globe.rotation.y;
        } else if (sk === "neo") {
          refs.globe.rotation.y += dt * 0.02;
          baseRotY = refs.globe.rotation.y;
        }
      }

      // Breathing on contour opacity.
      refs.contoursGroup.children.forEach((c, i) => {
        const m = (c as THREE.Line).material as THREE.LineBasicMaterial;
        m.opacity = 0.55 + Math.sin(now * 0.001 + i) * 0.12;
      });
      // Pulse pole beacons.
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.004);
      const np = refs.northPole.children[0] as THREE.Mesh;
      const sp = refs.southPole.children[0] as THREE.Mesh;
      ((np.material) as THREE.MeshBasicMaterial).opacity = pulse;
      ((sp.material) as THREE.MeshBasicMaterial).opacity = pulse * 0.6;
      // Pulse alpha ring.
      if (refs.alphaRing) {
        ((refs.alphaRing.material) as THREE.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.sin(now * 0.005);
      }
      // Arc dash march.
      const arcM = refs.arcLine.material as THREE.LineDashedMaterial;
      arcM.dashSize = 0.04 + Math.sin(now * 0.002) * 0.005;

      if (cameraAnim) cameraAnim(now);

      // Update HUD camera readout — DOM ref, no React render.
      const camAngle = Math.atan2(camera.position.x, camera.position.z) * 180 / Math.PI;
      const hudCamText = `ORBIT · ${camAngle.toFixed(0)}°`;
      if (hudCamRef.current && hudCamRef.current.textContent !== hudCamText) {
        hudCamRef.current.textContent = hudCamText;
      }

      // Update NETRA coord/range readouts — DOM refs.
      const camDir = camera.position.clone().normalize();
      const localDir = camDir.clone().applyMatrix4(new THREE.Matrix4().copy(refs.globe.matrixWorld).invert());
      localDir.normalize();
      const { lat, lon } = vecToLatLon(localDir);
      const coordText = fmtCoord(lat, lon);
      if (netraCoordRef.current && netraCoordRef.current.textContent !== coordText) {
        netraCoordRef.current.textContent = coordText;
      }
      const rangeText = camera.position.length().toFixed(2);
      if (netraRangeRef.current && netraRangeRef.current.textContent !== rangeText) {
        netraRangeRef.current.textContent = rangeText;
      }

      renderer.render(scene, camera);
    };
    const id = window.setInterval(tick, 16);
    tick();

    return () => {
      window.clearInterval(id);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMoveDrag);
      renderer.domElement.removeEventListener("pointermove", onHover);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("click", onClick);
      cleanup();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      delete (window as unknown as Record<string, unknown>).__atlasApplyStratum;
      delete (window as unknown as Record<string, unknown>).__atlasApplySelected;
      delete (window as unknown as Record<string, unknown>).__atlasNetraJump;
    };
  }, []);

  // Re-apply stratum / selection from React state to scene refs.
  useEffect(() => {
    const apply = (window as unknown as { __atlasApplyStratum?: (k: StratumKey) => void }).__atlasApplyStratum;
    if (apply) apply(stratum);
  }, [stratum]);

  useEffect(() => {
    const apply = (window as unknown as { __atlasApplySelected?: (id: string | null) => void }).__atlasApplySelected;
    if (apply) apply(selectedId);
  }, [selectedId]);

  return (
    <div className="atlas-frame">
      {/* Frame head */}
      <header className="atlas-head">
        <div className="flex items-baseline gap-3">
          <span>OBSERVATORY · WORLDLINE STRUCTURE <b>v.07</b></span>
          <span style={{ color: "var(--ink-faint)" }}>∇ Ne0EX · 3D ORTHOGRAPHIC</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span>α <i>1.130426</i></span>
          <span>NAV <i>NETRA</i></span>
        </div>
      </header>

      {/* 3-column content */}
      <div className="atlas-content">
        {/* LEFT — strata aside */}
        <aside>
          <div className="atlas-strata-head">§ STRATA · TRAVEL TARGETS</div>
          <div className="atlas-strata-list">
            {STRATA_BUTTONS.map((b) => {
              const active = stratum === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setStratum(active ? "all" : b.key)}
                  className={`atlas-strata-btn ${active ? "is-active" : ""}`}
                >
                  <span className="glyph">{b.glyph}</span>
                  <span>
                    <span className="label-id">{b.id}</span>
                    <span className="label-role">{b.role}</span>
                  </span>
                  <span className="key">{b.numKey}</span>
                </button>
              );
            })}
          </div>

          <div className="atlas-divider" />

          {/* Current stratum annotation — replaces redundant divergence card */}
          <div className="atlas-current">
            <div className="atlas-current-key">CURRENT STRATUM</div>
            <div className="atlas-current-val">{t.hudStratum}</div>
            <div className="atlas-current-meta">{t.role}</div>
          </div>
        </aside>

        {/* CENTER — globe canvas */}
        <div className="atlas-globe-wrap" ref={containerRef}>
          <span className="atlas-axis-label t">+Z · NORTH</span>
          <span className="atlas-axis-label b">−Z · SOUTH</span>
          <span className="atlas-axis-label l">PROJECTION FIELD</span>
          <span className="atlas-axis-label r">ARCHIVE FACE</span>

          <div className="atlas-alpha-mark">α</div>

          {/* HUD */}
          <div className="atlas-hud">
            <div className="atlas-hud-corner tl">
              <div>OBSERVING</div>
              <div><b>{t.hudStratum}</b></div>
            </div>
            <div className="atlas-hud-corner tr">
              <div>CAMERA</div>
              <div><b ref={hudCamRef}>ORBIT · 0°</b></div>
            </div>
            <div className="atlas-hud-corner bl">
              <div>α &nbsp;<b className="acc">1.130426</b></div>
              <div>13.04°N · 26.00°E</div>
            </div>
            <div className="atlas-hud-corner br">
              <div>SCALE</div>
              <div>1 : 1.30E+26</div>
            </div>
          </div>

          {t.pinShow && (
            <div className="atlas-coord-pin is-show">
              <span className="acc">α</span> WORLDLINE · {ALPHA_LAT.toFixed(2)}°N · {ALPHA_LON.toFixed(2)}°E
            </div>
          )}
        </div>

        {/* RIGHT — stratum readout */}
        <aside className="atlas-readout">
          <div className="atlas-readout-head">§ STRATUM READOUT</div>

          <div className="atlas-readout-row is-pair">
            <span className="key">ACTIVE</span>
            <span className="val acc">{t.name}</span>
            <span className="meta">{t.role}</span>
          </div>

          <div className="atlas-readout-row is-trio">
            <div><span className="key">SURVEYED</span><span className="val acc">047</span></div>
            <div><span className="key">ACTIVE</span><span className="val">012</span></div>
            <div><span className="key">BRANCHES</span><span className="val">∞</span></div>
          </div>

          <div className="atlas-readout-row is-trio">
            <div><span className="key">BEARING</span><span className="val">TRUE N</span></div>
            <div><span className="key">RADIUS</span><span className="val">{t.hudRadius}</span></div>
            <div><span className="key">DEPTH</span><span className="val">{t.hudDepth}</span></div>
          </div>

          <div className="atlas-flow">
            <div className={`step ${t.flow === "nex" ? "is-active" : ""}`}>
              <span>01</span><span>SIGNAL EMITTED &nbsp;<b>NeX</b></span>
            </div>
            <div className={`step ${t.flow === "neon" ? "is-active" : ""}`}>
              <span>02</span><span>BORNE BY POLE &nbsp;<b>Ne0N</b></span>
            </div>
            <div className={`step ${t.flow === "neo" ? "is-active" : ""}`}>
              <span>03</span><span>ARCHIVED IN &nbsp;<b>Ne0</b></span>
            </div>
            <div className="step">
              <span>04</span><span>NAVIGATED · <span style={{ color: "var(--netra)", fontWeight: 500 }}>NETRA</span></span>
            </div>
          </div>
        </aside>
      </div>

      {/* Frame foot */}
      <footer className="atlas-foot">
        <div className="atlas-foot-row">
          <div className="cell"><span>NeX · FIELD</span><b>247 RAYS</b></div>
          <div className="cell"><span>Ne0N · POLE</span><b>+90°N</b></div>
          <div className="cell"><span>Ne0 · NODES</span><b className="acc">047</b></div>

          <div className="atlas-netra" role="status" aria-live="polite">
            <span className="reticle" aria-hidden>
              <svg width="14" height="14" viewBox="-10 -10 20 20">
                <circle r="6" fill="none" stroke="currentColor" strokeWidth="0.9" />
                <circle r="1.4" fill="currentColor" />
                <line x1="-9" y1="0" x2="-6" y2="0" stroke="currentColor" strokeWidth="0.9" />
                <line x1="6" y1="0" x2="9" y2="0" stroke="currentColor" strokeWidth="0.9" />
                <line x1="0" y1="-9" x2="0" y2="-6" stroke="currentColor" strokeWidth="0.9" />
                <line x1="0" y1="6" x2="0" y2="9" stroke="currentColor" strokeWidth="0.9" />
              </svg>
            </span>
            <span className="id-box">
              <span className="lab">◎ NETRA</span>
              <span className="tgt">{netraTarget}</span>
            </span>
            <span className="readout">
              <span>RETICLE</span><b ref={netraCoordRef}>0.00°N · 0.00°E</b>
              <span>RANGE</span><b ref={netraRangeRef}>2.50</b>
            </span>
            <button
              className="jump"
              type="button"
              onClick={() => {
                const fn = (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump;
                if (fn) fn();
              }}
            >
              ⟶ NEXT NODE
            </button>
          </div>
        </div>

        <div className="atlas-netra-voice" aria-live="polite">
          <span className="voice-tag">{"//"} NETRA</span>
          <span className="voice-body">{netraVoice}</span>
        </div>
      </footer>

      {/* ── Article side panel — slides in when an entry is selected ── */}
      <article
        className="absolute z-[6] flex flex-col"
        style={{
          top: 78,
          right: 22,
          bottom: 22,
          width: "min(46%, 360px)",
          background: "var(--paper-warm)",
          border: "1px solid var(--ink-primary)",
          padding: "18px 20px",
          boxShadow: "3px 3px 0 rgba(31,80,99,0.16)",
          transform: selectedId ? "translateX(0)" : "translateX(calc(100% + 30px))",
          opacity: selectedId ? 1 : 0,
          transition: "transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 320ms ease-out",
          pointerEvents: selectedId ? "auto" : "none",
        }}
        aria-hidden={!selectedId}
      >
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="absolute top-2 right-3 t-mono text-[11px] tracking-[0.2em] text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
          aria-label="Close article"
        >
          ✕ ESC
        </button>
        {selected && (
          <>
            <div className="flex items-baseline gap-3 t-meta tracking-[0.25em] mb-1">
              <span className="t-meta-accent">FILE — {selected.fileNum}</span>
              <span className="text-[var(--ink-faint)]">/</span>
              <span className="text-[var(--ink-soft)]">{selected.date}</span>
            </div>
            <div className="t-meta tracking-[0.22em] text-[var(--ink-soft)] mb-3">
              <span className="t-meta-accent">{selected.coords.place.toUpperCase()}</span>
              <span className="text-[var(--ink-faint)] mx-1.5">·</span>
              <span>{selected.status.toUpperCase()}</span>
              <span className="text-[var(--ink-faint)] mx-1.5">·</span>
              <span>{selected.readingTime} MIN</span>
            </div>
            <h3
              className="t-display italic text-[var(--ink-primary)] mb-4"
              style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.005em" }}
            >
              {selected.title}
            </h3>
            <div
              className="t-display italic text-[var(--ink-primary)]/85"
              style={{ fontSize: 14, lineHeight: 1.55, letterSpacing: "0.01em" }}
            >
              {selected.summary}
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--ink-faint)]/60 flex items-center justify-between t-meta tracking-[0.22em]">
              <span className="text-[var(--ink-soft)]">
                TAGS · <span className="text-[var(--ink-primary)]">{selected.tags.join(" / ")}</span>
              </span>
              <a
                href={`#entry-${selected.fileNum}`}
                onClick={() => setSelectedId(null)}
                className="t-meta-accent tracking-[0.25em] hover:underline"
                style={{ textUnderlineOffset: 3 }}
              >
                READ ENTRY →
              </a>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
