// Photo slots: the five samples in reading order — hero first, then the
// four right-hand panels. A slot holds an Image once loaded; the editor can
// replace a slot with a user upload, and undo restores the earlier slot.

export const SAMPLE_FILES = ['duo.jpg', 'car.jpg', 'heli.jpg', 'dj.jpg', 'boat.jpg'];
export const SAMPLE_LABELS = ['Duo', 'Car', 'Heli', 'DJ', 'Boat'];

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadSamples() {
  const photos = [];
  for (const file of SAMPLE_FILES) {
    photos.push(await loadImage(`samples/${file}`));
  }
  return photos;
}

export function loadFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
