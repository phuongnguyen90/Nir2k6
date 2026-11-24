// Ambient type declaration for `screenshot-desktop`, which ships no types.
// The package's default export is a function returning a PNG/JPG Buffer (or,
// when `filename` is given, the path string it wrote to).
declare module "screenshot-desktop" {
  interface ScreenshotOptions {
    filename?: string;
    format?: "png" | "jpg";
    screen?: string | number;
    linuxLibrary?: "scrot" | "imagemagick";
  }

  interface Display {
    id: string | number;
    name?: string;
    width?: number;
    height?: number;
  }

  interface Screenshot {
    (options?: ScreenshotOptions): Promise<Buffer>;
    (options: ScreenshotOptions & { filename: string }): Promise<string>;
    listDisplays(): Promise<Display[]>;
    all(options?: ScreenshotOptions): Promise<Buffer[]>;
  }

  const screenshot: Screenshot;
  export = screenshot;
}
