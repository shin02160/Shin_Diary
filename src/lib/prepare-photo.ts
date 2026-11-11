import { photoMaxLength, validPhoto } from './entry-extras';

export async function preparePhoto(file: File) {
 if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
  throw new Error('15MB 이하의 JPEG, PNG, WebP 사진을 선택해 주세요.');
 }
 const bitmap = await createImageBitmap(file);
 try {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리할 수 없습니다.');
  for (const size of [1200, 900, 640, 400, 240]) {
   const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
   canvas.width = Math.max(1, Math.round(bitmap.width * scale));
   canvas.height = Math.max(1, Math.round(bitmap.height * scale));
   ctx.fillStyle = '#fff';
   ctx.fillRect(0, 0, canvas.width, canvas.height);
   ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
   const value = canvas.toDataURL('image/jpeg', 0.72);
   if (value.length <= photoMaxLength && validPhoto(value)) return value;
  }
  throw new Error('저장할 수 있는 크기로 사진을 줄이지 못했습니다.');
 } finally {
  bitmap.close();
 }
}
