const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const DOG_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#F6E7D8"/>
    <path d="M45 64C28 48 26 31 40 27c13-4 27 9 33 24M115 64c17-16 19-33 5-37-13-4-27 9-33 24" fill="#B86A38"/>
    <path d="M42 81c0-31 17-51 38-51s38 20 38 51v18c0 24-17 40-38 40s-38-16-38-40V81Z" fill="#D99056"/>
    <ellipse cx="80" cy="104" rx="28" ry="25" fill="#F8D7B4"/>
    <circle cx="62" cy="78" r="5" fill="#33251F"/>
    <circle cx="98" cy="78" r="5" fill="#33251F"/>
    <path d="M70 100c0-7 20-7 20 0 0 6-5 10-10 10s-10-4-10-10Z" fill="#33251F"/>
    <path d="M80 110v8m0 0c-8 0-12-4-13-8m13 8c8 0 12-4 13-8" fill="none" stroke="#33251F" stroke-width="3" stroke-linecap="round"/>
  </svg>
`);

const CAT_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#E8E5F4"/>
    <path d="M44 64 39 27l30 22M116 64l5-37-30 22" fill="#8876A8" stroke="#665384" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 82c0-31 18-51 40-51s40 20 40 51v17c0 25-18 41-40 41S40 124 40 99V82Z" fill="#9E8BBC"/>
    <path d="m47 42 18 13-19 7Zm66 0L95 55l19 7Z" fill="#D7A8B6"/>
    <ellipse cx="80" cy="107" rx="24" ry="22" fill="#C8BBDD"/>
    <path d="M57 78c4-5 10-5 14 0M89 78c4-5 10-5 14 0" fill="none" stroke="#30283C" stroke-width="4" stroke-linecap="round"/>
    <path d="M73 99c0-5 14-5 14 0 0 5-4 8-7 8s-7-3-7-8Z" fill="#6F4058"/>
    <path d="M80 107v7m0 0c-7 0-10-3-11-7m11 7c7 0 10-3 11-7M55 100l-22-5m23 13-23 3m72-11 22-5m-23 13 23 3" fill="none" stroke="#30283C" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
`);

const BIRD_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#DDF0EE"/>
    <circle cx="80" cy="82" r="48" fill="#5DA9A2"/>
    <path d="M52 82c18-19 40-26 67-22-12 8-19 19-23 33-13 2-29-1-44-11Z" fill="#9FD4C7"/>
    <path d="m116 63 22 10-22 11Z" fill="#E9A451"/>
    <circle cx="105" cy="65" r="6" fill="#263B3D"/>
    <path d="M73 111c7 7 17 11 29 11M61 62c-9-12-11-22-7-30 12 6 20 17 22 31" fill="none" stroke="#347772" stroke-width="5" stroke-linecap="round"/>
  </svg>
`);

const RABBIT_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#F3E6EC"/>
    <path d="M57 60C42 35 43 16 55 18c13 2 19 24 18 45M103 60c15-25 14-44 2-42-13 2-19 24-18 45" fill="#C898AF" stroke="#A97792" stroke-width="4"/>
    <ellipse cx="80" cy="94" rx="44" ry="43" fill="#D7B2C4"/>
    <circle cx="64" cy="88" r="5" fill="#3B2C35"/>
    <circle cx="96" cy="88" r="5" fill="#3B2C35"/>
    <path d="M72 103c5-5 11-5 16 0-2 8-14 8-16 0Z" fill="#8D5570"/>
    <path d="M80 109v7m0 0c-8 0-11-3-13-8m13 8c8 0 11-3 13-8" fill="none" stroke="#3B2C35" stroke-width="3" stroke-linecap="round"/>
  </svg>
`);

const OTHER_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="80" fill="#E9EEE8"/>
    <circle cx="80" cy="80" r="50" fill="#91A68D"/>
    <path d="M80 48c8 12 16 18 30 19-9 9-11 18-8 31-13-4-22-1-32 8-4-13-11-20-24-25 12-6 18-14 20-27 5 3 9 1 14-6Z" fill="#D9E3D4"/>
    <circle cx="67" cy="79" r="5" fill="#344336"/>
    <circle cx="93" cy="79" r="5" fill="#344336"/>
    <path d="M70 103c7 6 13 6 20 0" fill="none" stroke="#344336" stroke-width="4" stroke-linecap="round"/>
  </svg>
`);

export const PET_AVATAR_PRESETS = [
  { id: 'preset:dog', label: 'Dog avatar', src: DOG_AVATAR },
  { id: 'preset:cat', label: 'Cat avatar', src: CAT_AVATAR },
] as const;

const DEFAULT_AVATARS: Record<string, string> = {
  dog: DOG_AVATAR,
  cat: CAT_AVATAR,
  bird: BIRD_AVATAR,
  rabbit: RABBIT_AVATAR,
  other: OTHER_AVATAR,
};

export function resolvePetAvatar(photoUrl?: string | null, species?: string | null) {
  if (photoUrl && !photoUrl.startsWith('preset:')) return photoUrl;
  return DEFAULT_AVATARS[species ?? ''] ?? null;
}