import { useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { fileUrl } from '@/lib/api';

const MAX_SIDE = 800;
const MAX_FILE_MB = 10;

/** Reads an image file and returns it as a JPEG data URL no larger than MAX_SIDE on either side. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a readable image')); };
    img.src = url;
  });
}

/**
 * A person's photo, or their initial on a coloured circle when there is none.
 * `className` sets the size and the fallback colours, e.g. "w-9 h-9 text-sm bg-gold-500 text-primary-950".
 */
export function Avatar({ name, photo, className }: { name: string; photo: string | null | undefined; className: string }) {
  return photo
    ? <img src={fileUrl(photo)} alt={name} className={`${className} rounded-full object-cover flex-shrink-0 bg-gray-100`} />
    : <div className={`${className} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>{name.charAt(0) || '?'}</div>;
}

/** A customer's photo, or their initial when there is none. */
export function CustomerAvatar({ name, photo, size = 'sm' }: { name: string; photo: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-8 h-8 text-xs', md: 'w-16 h-16 text-xl', lg: 'w-24 h-24 text-3xl' }[size];
  return photo
    ? <img src={fileUrl(photo)} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0 bg-gray-100`} />
    : <div className={`${cls} rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-primary-950 font-bold flex-shrink-0`}>{name.charAt(0) || '?'}</div>;
}

interface Props {
  /** Photo already saved for the customer (path from the API), if any. */
  current: string | null;
  /** Newly chosen photo as a data URL, or '' when none was chosen. */
  value: string;
  removed: boolean;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
  error?: string;
}

/** Choose, preview, change or remove a customer photo. Nothing is uploaded until the form is saved. */
export default function PhotoInput({ current, value, removed, onChange, onRemove, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState('');
  const preview = value || (!removed && current ? fileUrl(current) : '');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLocalError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setLocalError('Choose a JPG, PNG or WebP image'); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setLocalError(`The photo must be smaller than ${MAX_FILE_MB} MB`); return; }
    try {
      onChange(await shrink(file));
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not read this image');
    }
  };

  const shown = localError || error;
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => inputRef.current?.click()} title="Choose photo"
        className={`w-24 h-24 rounded-full overflow-hidden flex-shrink-0 border-2 border-dashed flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors ${shown ? 'border-danger-400' : 'border-gray-200'}`}>
        {preview ? <img src={preview} alt="Photo" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-400" />}
      </button>
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Profile Photo</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
            <Upload className="w-3.5 h-3.5" /> {preview ? 'Change' : 'Upload'}
          </button>
          {preview && (
            <button type="button" onClick={() => { setLocalError(''); onRemove(); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-danger-50 text-danger-600">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
        <p className={`text-xs mt-1.5 ${shown ? 'text-danger-600' : 'text-gray-400'}`}>{shown || 'JPG, PNG or WebP · optional'}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
