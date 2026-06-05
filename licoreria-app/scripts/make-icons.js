import sharp from 'sharp';

const INPUT  = 'public/LOGO CATERING SERVICES SIL&TE.png';
const SIZES  = [192, 512];
const TOLERANCE = 35; // 0-255: qué tan "blanco" se considera fondo

// Flood-fill DFS desde las 4 esquinas para quitar solo el fondo blanco,
// sin afectar blancos internos del logo.
function removeBackground(data, width, height) {
  const channels = 4;
  const visited  = new Uint8Array(width * height);

  function isWhitish(x, y) {
    const i = (y * width + x) * channels;
    return (
      data[i]     >= 255 - TOLERANCE &&
      data[i + 1] >= 255 - TOLERANCE &&
      data[i + 2] >= 255 - TOLERANCE
    );
  }

  function makeTransparent(x, y) {
    const i = (y * width + x) * channels;
    data[i + 3] = 0;
  }

  const stack = [];

  for (const [cx, cy] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]]) {
    if (!visited[cy * width + cx] && isWhitish(cx, cy)) {
      stack.push([cx, cy]);
      visited[cy * width + cx] = 1;
    }
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    makeTransparent(x, y);

    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (visited[ny * width + nx]) continue;
      if (!isWhitish(nx, ny)) continue;
      visited[ny * width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
}

async function makeIcon(size) {
  const output = `public/icon-${size}.png`;

  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeBackground(data, info.width, info.height);

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output);

  console.log(`✓ ${output}  (${size}×${size} px)`);
}

for (const size of SIZES) {
  await makeIcon(size);
}

console.log('\nIconos generados correctamente.');
