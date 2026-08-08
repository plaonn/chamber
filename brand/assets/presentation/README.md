# Chamber repository presentation assets

These files are **derived presentation surfaces**, not additional canonical marks.

- `chamber-readme-light.svg` and `chamber-readme-dark.svg` inline the canonical `chamber-wordmark.svg` geometry over fixed light/dark brand backgrounds. This keeps the wordmark's backdrop-responsive blend behavior inside one SVG document when GitHub embeds the asset as an image.
- `chamber-social-preview.svg` is the editable 1280×640 source for the repository social preview.

Regenerate the SVG presentation files with:

```bash
pnpm brand:generate
```

The canonical symbol, wordmark geometry, palette, and usage rules remain defined by `../../brand-spec.json`, `../../README.md`, and the canonical assets one directory above.
