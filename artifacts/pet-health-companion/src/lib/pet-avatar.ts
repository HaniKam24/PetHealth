import dogPhoto from '@/assets/pet-avatars/dog.png';
import catPhoto from '@/assets/pet-avatars/cat.png';
import rabbitPhoto from '@/assets/pet-avatars/rabbit.png';
import birdPhoto from '@/assets/pet-avatars/bird.png';
import fishPhoto from '@/assets/pet-avatars/fish.png';
import hamsterPhoto from '@/assets/pet-avatars/hamster.png';
import pigPhoto from '@/assets/pet-avatars/pig.png';
import horsePhoto from '@/assets/pet-avatars/horse.png';
import frogPhoto from '@/assets/pet-avatars/frog.png';
import ferretPhoto from '@/assets/pet-avatars/ferret.png';

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// Front-facing species portraits with soft gradient shading, eye glints, and
// species-specific anatomical detail (a horse's long face + blaze + side-set
// eyes, a cat's cheek fluff + slit pupils, a pig's snout disc, etc). Picked
// over a flatter/bolder treatment after a side-by-side style study.
//
// DOG_AVATAR and CAT_AVATAR are kept only because PET_AVATAR_PRESETS below
// still references them — every other species now uses the illustrated
// photos imported above instead.

const DOG_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="dogBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#FBF1E4"/><stop offset="100%" stop-color="#F0DCC0"/></radialGradient>
      <radialGradient id="dogHead" cx="35%" cy="28%" r="80%"><stop offset="0%" stop-color="#E7C79A"/><stop offset="100%" stop-color="#B8783C"/></radialGradient>
      <radialGradient id="dogEar" cx="35%" cy="20%" r="90%"><stop offset="0%" stop-color="#C98A46"/><stop offset="100%" stop-color="#8B5A2B"/></radialGradient>
      <radialGradient id="dogMuzzle" cx="40%" cy="25%" r="85%"><stop offset="0%" stop-color="#FBEBD1"/><stop offset="100%" stop-color="#E9C99A"/></radialGradient>
      <radialGradient id="dogIris" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#7A4B29"/><stop offset="100%" stop-color="#20130B"/></radialGradient>
      <radialGradient id="dogNose" cx="35%" cy="25%" r="85%"><stop offset="0%" stop-color="#4A342A"/><stop offset="100%" stop-color="#1A100B"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#dogBg)"/>
    <ellipse cx="100" cy="150" rx="46" ry="14" fill="#B8783C" opacity="0.18"/>
    <path d="M58 55 C40 60 32 90 40 120 C46 132 56 130 60 118 C64 100 62 75 58 55 Z" fill="url(#dogEar)"/>
    <path d="M142 55 C160 60 168 90 160 120 C154 132 144 130 140 118 C136 100 138 75 142 55 Z" fill="url(#dogEar)"/>
    <path d="M100 40 C130 40 150 60 152 90 C154 115 148 140 130 156 C118 166 82 166 70 156 C52 140 46 115 48 90 C50 60 70 40 100 40 Z" fill="url(#dogHead)"/>
    <g stroke="#8B5A2B" stroke-width="2" stroke-linecap="round" opacity="0.55" fill="none">
      <path d="M52 108q-4 3-3 8M148 108q4 3 3 8M60 138q-3 4-1 8M140 138q3 4 1 8"/>
    </g>
    <path d="M68 100 C72 92 84 92 88 100 C84 108 72 108 68 100 Z" fill="#FBF1E4"/>
    <path d="M112 100 C116 92 128 92 132 100 C128 108 116 108 112 100 Z" fill="#FBF1E4"/>
    <circle cx="78" cy="100" r="7.5" fill="url(#dogIris)"/>
    <circle cx="122" cy="100" r="7.5" fill="url(#dogIris)"/>
    <circle cx="76" cy="97" r="1.8" fill="#fff" opacity="0.85"/>
    <circle cx="120" cy="97" r="1.8" fill="#fff" opacity="0.85"/>
    <path d="M70 90q8-5 16 0M114 90q8-5 16 0" stroke="#8B5A2B" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
    <ellipse cx="100" cy="132" rx="26" ry="20" fill="url(#dogMuzzle)"/>
    <path d="M100 116c-6 0-9 5-9 9 0 5 4 8 9 8s9-3 9-8c0-4-3-9-9-9Z" fill="url(#dogNose)"/>
    <circle cx="97" cy="120" r="1.4" fill="#fff" opacity="0.6"/>
    <path d="M100 132 Q100 140 90 142 M100 132 Q100 140 110 142" stroke="#6B4226" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>
`);

const CAT_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="catBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#F1EEF9"/><stop offset="100%" stop-color="#DED8EF"/></radialGradient>
      <radialGradient id="catHead" cx="35%" cy="26%" r="80%"><stop offset="0%" stop-color="#A796C4"/><stop offset="100%" stop-color="#6E5B94"/></radialGradient>
      <radialGradient id="catEar" cx="40%" cy="15%" r="90%"><stop offset="0%" stop-color="#9683B8"/><stop offset="100%" stop-color="#6E5B94"/></radialGradient>
      <radialGradient id="catInnerEar" cx="40%" cy="15%" r="90%"><stop offset="0%" stop-color="#F0C7D6"/><stop offset="100%" stop-color="#D9A0B6"/></radialGradient>
      <radialGradient id="catIris" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#B7D68C"/><stop offset="100%" stop-color="#4C6B2E"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#catBg)"/>
    <ellipse cx="100" cy="152" rx="46" ry="14" fill="#6E5B94" opacity="0.18"/>
    <path d="M62 55 46 28 82 48Z" fill="url(#catEar)"/>
    <path d="M138 55 154 28 118 48Z" fill="url(#catEar)"/>
    <path d="M66 52 54 34 76 46Z" fill="url(#catInnerEar)"/>
    <path d="M134 52 146 34 124 46Z" fill="url(#catInnerEar)"/>
    <path d="M100 42 C128 42 148 62 150 90 C152 118 144 146 124 158 C112 166 88 166 76 158 C56 146 48 118 50 90 C52 62 72 42 100 42 Z" fill="url(#catHead)"/>
    <g fill="#8E7AB4">
      <ellipse cx="52" cy="140" rx="9" ry="6" transform="rotate(-18 52 140)"/>
      <ellipse cx="148" cy="140" rx="9" ry="6" transform="rotate(18 148 140)"/>
    </g>
    <path d="M66 96 C70 87 86 87 90 96 C86 103 70 103 66 96 Z" fill="#EFEAF7"/>
    <path d="M110 96 C114 87 130 87 134 96 C130 103 114 103 110 96 Z" fill="#EFEAF7"/>
    <circle cx="78" cy="97" r="8" fill="url(#catIris)"/>
    <circle cx="122" cy="97" r="8" fill="url(#catIris)"/>
    <ellipse cx="78" cy="97" rx="1.6" ry="6" fill="#2A2010"/>
    <ellipse cx="122" cy="97" rx="1.6" ry="6" fill="#2A2010"/>
    <circle cx="76" cy="94" r="1.6" fill="#fff" opacity="0.8"/>
    <circle cx="120" cy="94" r="1.6" fill="#fff" opacity="0.8"/>
    <path d="M100 118c-6 2-8 8-3 10 3 1 6 1 3-2-2-2-1-5 0-8Zm0 0c6 2 8 8 3 10-3 1-6 1-3-2 2-2 1-5 0-8Z" fill="#D98CA6"/>
    <g stroke="#8B8296" stroke-width="1.6" stroke-linecap="round" opacity="0.75">
      <path d="M66 126h-26M64 132h-26M66 138h-24"/>
      <path d="M134 126h26M136 132h26M134 138h24"/>
    </g>
  </svg>
`);

const OTHER_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="othBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#EEF3EC"/><stop offset="100%" stop-color="#DAE6D6"/></radialGradient>
      <radialGradient id="othPad" cx="35%" cy="28%" r="80%"><stop offset="0%" stop-color="#8CA987"/><stop offset="100%" stop-color="#4F6A4B"/></radialGradient>
      <radialGradient id="othToe" cx="35%" cy="28%" r="80%"><stop offset="0%" stop-color="#8CA987"/><stop offset="100%" stop-color="#5F7A5B"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#othBg)"/>
    <ellipse cx="100" cy="150" rx="42" ry="13" fill="#4F6A4B" opacity="0.18"/>
    <ellipse cx="100" cy="128" rx="36" ry="28" fill="url(#othPad)"/>
    <ellipse cx="100" cy="132" rx="24" ry="17" fill="#AFC7A9" opacity="0.6"/>
    <circle cx="60" cy="80" r="16" fill="url(#othToe)"/>
    <circle cx="90" cy="62" r="16" fill="url(#othToe)"/>
    <circle cx="122" cy="62" r="16" fill="url(#othToe)"/>
    <circle cx="150" cy="80" r="16" fill="url(#othToe)"/>
  </svg>
`);

export const PET_AVATAR_PRESETS = [
  { id: 'preset:dog', label: 'Dog avatar', src: DOG_AVATAR },
  { id: 'preset:cat', label: 'Cat avatar', src: CAT_AVATAR },
] as const;

const DEFAULT_AVATARS: Record<string, string> = {
  dog: dogPhoto,
  cat: catPhoto,
  rabbit: rabbitPhoto,
  bird: birdPhoto,
  fish: fishPhoto,
  hamster: hamsterPhoto,
  pig: pigPhoto,
  horse: horsePhoto,
  // No standalone reptile illustration was provided with this icon set, so
  // the frog photo (closest visual match) stands in for it.
  reptile: frogPhoto,
  ferret: ferretPhoto,
  other: OTHER_AVATAR,
};

export function resolvePetAvatar(photoUrl?: string | null, species?: string | null) {
  if (photoUrl && !photoUrl.startsWith('preset:')) return photoUrl;
  return DEFAULT_AVATARS[species ?? ''] ?? null;
}
