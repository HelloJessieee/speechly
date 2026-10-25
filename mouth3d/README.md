# Speechly 3D mouth lab

A standalone web page for building and checking the 3D mouth model. It does
not import anything from the original app, so it keeps working while that app
moves to SwiftUI.

```sh
cd mouth3d
npm install
npm run dev        # http://localhost:5180
```

## Layout

- `src/model/` — the model itself.
  - `shapes.ts`, `types.ts`, `lessons.ts`: mouth parameters, shapes and lesson
    timelines, copied from the original app.
  - `surface.ts`: plain math (lip contours, skin depth). No web code, so it is
    the part to port to Swift.
  - `rig.ts`: builds the three.js meshes from `surface.ts`.
  - `viewer.ts`, `MouthModel3D.tsx`: renderer, camera and drag controls.
- `src/lab/` — the lab page: 2D comparison, shape buttons, lesson playback,
  parameter sliders and the build progress list (`progress.ts`).
