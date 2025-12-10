export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.src = url
    })

export async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return null
    }

    // Add padding (Quiet Zone)
    const padding = Math.max(40, Math.floor(pixelCrop.width * 0.1));

    // Enforce minimum size for decoder (upscale if too small)
    const minSize = 600;
    const scale = Math.max(1, minSize / pixelCrop.width);

    const destWidth = pixelCrop.width * scale;
    const destHeight = pixelCrop.height * scale;
    const paddingScaled = padding * scale;

    canvas.width = destWidth + (paddingScaled * 2)
    canvas.height = destHeight + (paddingScaled * 2)

    // Fill white
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // CRISP EDGES for QR Codes (Nearest Neighbor) is often better for digital captures
    ctx.imageSmoothingEnabled = false

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        paddingScaled,
        paddingScaled,
        destWidth,
        destHeight
    )

    return new Promise((resolve) => {
        // High quality JPEG might be safer than PNG if size is huge? No, PNG is best for QR.
        canvas.toBlob((blob) => {
            resolve(blob)
        }, 'image/png')
    })
}

export async function invertImage(blob: Blob): Promise<Blob> {
    const image = await createImage(URL.createObjectURL(blob)) // Re-use existing createImage helper if possible, or simple standard way. 
    // Actually createImage takes a URL string.

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No context');

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];     // r
        data[i + 1] = 255 - data[i + 1]; // g
        data[i + 2] = 255 - data[i + 2]; // b
    }
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
    })
}
