import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(relativePath) {
  const filename = path.resolve(process.cwd(), relativePath);
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  const testModule = { exports: {} };
  const sandbox = {
    exports: testModule.exports,
    module: testModule,
    require,
  };

  vm.runInNewContext(output, sandbox, { filename });
  return testModule.exports;
}

function rotateY(v, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: v.x * cos + v.z * sin,
    y: v.y,
    z: -v.x * sin + v.z * cos,
  };
}

test("NETRA coordinates stay earth-fixed while the visual globe rotates", () => {
  const {
    latLonToVec3,
    netraCoordFromCameraPosition,
    vecToLatLon,
  } = loadTsModule("lib/globe-coordinates.ts");

  const bangkok = { lat: 13.7563, lon: 100.5018 };
  const cameraPosition = latLonToVec3(bangkok.lat, bangkok.lon, 2.6);

  const netra = netraCoordFromCameraPosition(cameraPosition);
  assert.equal(netra.lat.toFixed(4), bangkok.lat.toFixed(4));
  assert.equal(netra.lon.toFixed(4), bangkok.lon.toFixed(4));

  const legacyGlobeLocalDirection = rotateY(
    netraCoordFromCameraPosition(cameraPosition).direction,
    -Math.PI / 2
  );
  const legacy = vecToLatLon(legacyGlobeLocalDirection);

  assert.ok(
    Math.abs(legacy.lon - bangkok.lon) > 45,
    "the old inverse-globe-matrix path would drift longitude after visual rotation"
  );
});

test("WorldlineGlobe reads NETRA coordinates outside the animated globe matrix", () => {
  const source = readFileSync(
    path.resolve(process.cwd(), "components/WorldlineGlobe.tsx"),
    "utf8"
  );

  assert.match(source, /netraCoordFromCameraPosition\(camera\.position\)/);
  assert.match(source, /globeSurfacePointAtRotation\(coords\.lat, coords\.lon, refs\.globe\.rotation\.y/);
  assert.doesNotMatch(source, /refs\.globe\.matrixWorld/);
});

test("ATLAS tracking points follow the visual globe rotation", () => {
  const {
    globeSurfacePointAtRotation,
    latLonToVec3,
  } = loadTsModule("lib/globe-coordinates.ts");

  const tokyo = { lat: 35.6762, lon: 139.6503 };
  const local = latLonToVec3(tokyo.lat, tokyo.lon, 2.6);
  const tracked = globeSurfacePointAtRotation(tokyo.lat, tokyo.lon, Math.PI / 2, 2.6);

  assert.notDeepEqual(
    {
      x: tracked.x.toFixed(4),
      y: tracked.y.toFixed(4),
      z: tracked.z.toFixed(4),
    },
    {
      x: local.x.toFixed(4),
      y: local.y.toFixed(4),
      z: local.z.toFixed(4),
    },
    "a tracked ATLAS point must move with the rendered globe, not stay at its unrotated coordinate"
  );
});

test("soft tracking eases toward an ATLAS point instead of snapping to it", () => {
  const { dampVec3 } = loadTsModule("lib/globe-coordinates.ts");

  const next = dampVec3(
    { x: 0, y: 0, z: 4 },
    { x: 2, y: 1, z: 2 },
    0.016,
    3
  );

  assert.ok(next.x > 0 && next.x < 2);
  assert.ok(next.y > 0 && next.y < 1);
  assert.ok(next.z < 4 && next.z > 2);
});
