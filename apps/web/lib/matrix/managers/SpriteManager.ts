
/**
 * SpriteManager.ts
 * Manages loading and caching of enemy sprite assets.
 */

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteAnimation {
  name: string;
  frames: SpriteFrame[];
  duration: number; // ms per frame or total? Let's say total duration for loop
  loop: boolean;
}

export interface SpriteSheetConfig {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  animations: {
    idle: { row: number, frames: number };
    move: { row: number, frames: number };
    attack: { row: number, frames: number };
    die: { row: number, frames: number };
  };
}

class SpriteManager {
  private static instance: SpriteManager;
  private images: Map<string, HTMLImageElement> = new Map();
  private listLoading: Map<string, boolean> = new Map();

  private constructor() { }

  public static getInstance(): SpriteManager {
    if (!SpriteManager.instance) {
      SpriteManager.instance = new SpriteManager();
    }
    return SpriteManager.instance;
  }

  public load_image(url: string): HTMLImageElement | null {
    if (this.images.has(url)) {
      return this.images.get(url)!;
    }

    if (!this.listLoading.get(url)) {
      this.listLoading.set(url, true);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        this.images.set(url, img);
        this.listLoading.set(url, false);
      };
      img.onerror = () => {
        console.error(`Failed to load sprite: ${url}`);
        this.listLoading.set(url, false);
      };
    }

    return null;
  }

  private async processImageTransparency(img: HTMLImageElement): Promise<HTMLImageElement> {
    // Create an offscreen canvas to process pixel data
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Detect background color from top-left pixel
    // Assuming simple background removal (chroma key)
    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];
    // We won't check alpha here, assuming the original image is opaque (255)

    // Threshold for similar colors (e.g. compression artifacts)
    const threshold = 15;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (
        Math.abs(r - r0) < threshold &&
        Math.abs(g - g0) < threshold &&
        Math.abs(b - b0) < threshold
      ) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Create a new image from the processed canvas
    const newImg = new Image();
    newImg.src = canvas.toDataURL();

    // Return a promise that resolves when the new processed image is ready
    return new Promise((resolve) => {
      newImg.onload = () => resolve(newImg);
    });
  }

  public drawSprite(
    ctx: CanvasRenderingContext2D,
    imageKey: string, // e.g., 'glitch', 'boss_1'
    row: number,
    col: number, // current frame index
    x: number,
    y: number,
    width: number,
    height: number,
    flipX: boolean = false,
    opacity: number = 1.0,
    isHit: boolean = false
  ) {
    // Construct cached URL path assuming assets structure
    // We will save images in /public/assets/enemies/[key].svg
    // In Vite/Dev, just /assets/enemies/... might work if in public folder.
    // Let's assume absolute path from root for now or relative to public.
    const url = `./assets/enemies/${imageKey}.svg`;

    // Check if we have the processed image
    if (!this.images.has(url)) {
      // Trigger load if not already loading
      this.load_image(url);
      return;
    }

    const img = this.images.get(url)!;

    // Assume standard 64x64 or similar consistent cell size based on width/height passed,
    // OR we can rely on image dimensions if we want automatic detection,
    // but fixed grid is easier. Let's assume the passed width/height IS the frame size.

    // For now, let's assume the sprite sheet is tightly packed with uniform cell size.
    // If the image is 256x256 and has 4 rows, cell height is 64.
    // We'll trust the caller to know the grid or infer from image size if needed.
    // But simplicity: Caller says "frame 0 of row 1".

    const frameW = img.width / 4; // Assuming 4 columns standard 
    const frameH = img.height / 4; // Assuming 4 rows standard (Idle, Move, Attack, Die)

    const sx = col * frameW;
    const sy = row * frameH;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    if (flipX) {
      ctx.scale(-1, 1);
    }

    // Draw centered
    ctx.drawImage(
      img,
      sx, sy, frameW, frameH,
      -width / 2, -height / 2, width, height
    );

    // Hit Flash Effect (White overlay)
    if (isHit) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-width / 2, -height / 2, width, height);
    }

    ctx.restore();
  }
}

export default SpriteManager;
