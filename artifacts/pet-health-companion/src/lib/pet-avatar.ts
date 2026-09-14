const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

// Front-facing species portraits with soft gradient shading, eye glints, and
// species-specific anatomical detail (a horse's long face + blaze + side-set
// eyes, a cat's cheek fluff + slit pupils, a pig's snout disc, etc). Picked
// over a flatter/bolder treatment after a side-by-side style study.

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

const RABBIT_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="rabBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#FAF1F5"/><stop offset="100%" stop-color="#EDD9E3"/></radialGradient>
      <radialGradient id="rabHead" cx="35%" cy="26%" r="80%"><stop offset="0%" stop-color="#D9AFC2"/><stop offset="100%" stop-color="#966780"/></radialGradient>
      <radialGradient id="rabEar" cx="40%" cy="15%" r="90%"><stop offset="0%" stop-color="#C797AC"/><stop offset="100%" stop-color="#966780"/></radialGradient>
      <radialGradient id="rabInnerEar" cx="40%" cy="15%" r="90%"><stop offset="0%" stop-color="#F0C7D6"/><stop offset="100%" stop-color="#D9A0B6"/></radialGradient>
      <radialGradient id="rabIris" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#8A5A3A"/><stop offset="100%" stop-color="#241408"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#rabBg)"/>
    <ellipse cx="100" cy="150" rx="42" ry="13" fill="#966780" opacity="0.18"/>
    <ellipse cx="76" cy="44" rx="11" ry="30" transform="rotate(-10 76 44)" fill="url(#rabEar)"/>
    <ellipse cx="124" cy="44" rx="11" ry="30" transform="rotate(10 124 44)" fill="url(#rabEar)"/>
    <ellipse cx="76" cy="46" rx="6" ry="22" transform="rotate(-10 76 46)" fill="url(#rabInnerEar)"/>
    <ellipse cx="124" cy="46" rx="6" ry="22" transform="rotate(10 124 46)" fill="url(#rabInnerEar)"/>
    <path d="M100 44 C126 44 146 64 148 90 C150 116 142 142 124 154 C112 162 88 162 76 154 C58 142 50 116 52 90 C54 64 74 44 100 44 Z" fill="url(#rabHead)"/>
    <path d="M68 100 C72 92 84 92 88 100 C84 108 72 108 68 100 Z" fill="#F7EAF0"/>
    <path d="M112 100 C116 92 128 92 132 100 C128 108 116 108 112 100 Z" fill="#F7EAF0"/>
    <circle cx="78" cy="100" r="7" fill="url(#rabIris)"/>
    <circle cx="122" cy="100" r="7" fill="url(#rabIris)"/>
    <circle cx="76" cy="97" r="1.6" fill="#fff" opacity="0.85"/>
    <circle cx="120" cy="97" r="1.6" fill="#fff" opacity="0.85"/>
    <path d="M100 116c-5 2-7 7-4 10 2 2 5 1 4-3-1-3 0-5 0-7Zm0 0c5 2 7 7 4 10-2 2-5 1-4-3 1-3 0-5 0-7Z" fill="#C9788F"/>
    <g stroke="#966780" stroke-width="1.6" stroke-linecap="round" opacity="0.75">
      <path d="M70 122h-24M68 128h-24"/>
      <path d="M130 122h24M132 128h24"/>
    </g>
    <rect x="93" y="128" width="14" height="16" rx="3" fill="#FBFAF8"/>
    <path d="M100 128v16" stroke="#D9C9CF" stroke-width="1.2"/>
  </svg>
`);

const BIRD_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="birdBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#E7F6F3"/><stop offset="100%" stop-color="#CBEAE4"/></radialGradient>
      <radialGradient id="birdHead" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#6FC0B6"/><stop offset="100%" stop-color="#357A72"/></radialGradient>
      <radialGradient id="birdIris" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#3A2A1E"/><stop offset="100%" stop-color="#120C08"/></radialGradient>
      <linearGradient id="birdBeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F0B36A"/><stop offset="100%" stop-color="#D98B34"/></linearGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#birdBg)"/>
    <ellipse cx="100" cy="148" rx="42" ry="12" fill="#357A72" opacity="0.18"/>
    <circle cx="76" cy="92" r="17" fill="#A8DDD3"/>
    <circle cx="124" cy="92" r="17" fill="#A8DDD3"/>
    <circle cx="100" cy="96" r="54" fill="url(#birdHead)"/>
    <g fill="#357A72">
      <path d="M92 44c-2-10 2-18 8-20-2 8-2 16-8 20Z"/>
      <path d="M108 44c2-10-2-18-8-20 2 8 2 16 8 20Z"/>
    </g>
    <path d="M88 118 112 118 100 136Z" fill="url(#birdBeak)"/>
    <circle cx="76" cy="92" r="12" fill="url(#birdIris)"/>
    <circle cx="124" cy="92" r="12" fill="url(#birdIris)"/>
    <circle cx="73" cy="88" r="2.4" fill="#fff" opacity="0.85"/>
    <circle cx="121" cy="88" r="2.4" fill="#fff" opacity="0.85"/>
  </svg>
`);

const FISH_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="fishBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#EAF4FC"/><stop offset="100%" stop-color="#CCE5F5"/></radialGradient>
      <radialGradient id="fishBody" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#6BA9D4"/><stop offset="100%" stop-color="#3E7CA6"/></radialGradient>
      <radialGradient id="fishIris" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#2E4A5E"/><stop offset="100%" stop-color="#0F1B22"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#fishBg)"/>
    <ellipse cx="100" cy="150" rx="42" ry="12" fill="#3E7CA6" opacity="0.18"/>
    <path d="M100 40c8 6 10 16 8 26-6-4-14-4-18 2-2-12 2-22 10-28Z" fill="#2E5F80"/>
    <path d="M46 100c-8 4-12 12-10 20 8-2 14-8 16-16Z" fill="#2E5F80"/>
    <path d="M154 100c8 4 12 12 10 20-8-2-14-8-16-16Z" fill="#2E5F80"/>
    <ellipse cx="100" cy="102" rx="52" ry="56" fill="url(#fishBody)"/>
    <path d="M64 76q10-6 20 0M116 76q10-6 20 0" stroke="#2E5F80" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>
    <circle cx="72" cy="90" r="15" fill="#EAF4FC"/>
    <circle cx="128" cy="90" r="15" fill="#EAF4FC"/>
    <circle cx="72" cy="90" r="11" fill="url(#fishIris)"/>
    <circle cx="128" cy="90" r="11" fill="url(#fishIris)"/>
    <circle cx="69" cy="87" r="2.2" fill="#fff" opacity="0.85"/>
    <circle cx="125" cy="87" r="2.2" fill="#fff" opacity="0.85"/>
    <ellipse cx="100" cy="128" rx="9" ry="7" fill="#2E5F80"/>
    <ellipse cx="100" cy="127" rx="4" ry="3" fill="#1E3F54"/>
  </svg>
`);

const HAMSTER_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="hamBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#FDF3E7"/><stop offset="100%" stop-color="#F3DDBE"/></radialGradient>
      <radialGradient id="hamHead" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#E4B27E"/><stop offset="100%" stop-color="#C97B3D"/></radialGradient>
      <radialGradient id="hamCheek" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#F6D9AE"/><stop offset="100%" stop-color="#E4B27E"/></radialGradient>
      <radialGradient id="hamIris" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#4A2E1C"/><stop offset="100%" stop-color="#160D06"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#hamBg)"/>
    <ellipse cx="100" cy="152" rx="44" ry="12" fill="#C97B3D" opacity="0.18"/>
    <circle cx="58" cy="58" r="15" fill="url(#hamHead)"/>
    <circle cx="142" cy="58" r="15" fill="url(#hamHead)"/>
    <circle cx="58" cy="60" r="7" fill="#F6D9AE"/>
    <circle cx="142" cy="60" r="7" fill="#F6D9AE"/>
    <ellipse cx="52" cy="120" rx="25" ry="27" fill="url(#hamCheek)"/>
    <ellipse cx="148" cy="120" rx="25" ry="27" fill="url(#hamCheek)"/>
    <circle cx="100" cy="102" r="58" fill="url(#hamHead)"/>
    <circle cx="76" cy="92" r="6.5" fill="url(#hamIris)"/>
    <circle cx="124" cy="92" r="6.5" fill="url(#hamIris)"/>
    <circle cx="74" cy="90" r="1.4" fill="#fff" opacity="0.85"/>
    <circle cx="122" cy="90" r="1.4" fill="#fff" opacity="0.85"/>
    <ellipse cx="100" cy="110" rx="4" ry="3" fill="#3A2416"/>
    <path d="M100 113q0 6-6 8M100 113q0 6 6 8" stroke="#8A5A2E" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>
`);

const PIG_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="pigBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#FCEEF0"/><stop offset="100%" stop-color="#F3D3D8"/></radialGradient>
      <radialGradient id="pigHead" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#E8A9B3"/><stop offset="100%" stop-color="#C97682"/></radialGradient>
      <radialGradient id="pigEar" cx="40%" cy="15%" r="90%"><stop offset="0%" stop-color="#DD97A2"/><stop offset="100%" stop-color="#C97682"/></radialGradient>
      <radialGradient id="pigSnout" cx="40%" cy="30%" r="85%"><stop offset="0%" stop-color="#F6D3D8"/><stop offset="100%" stop-color="#E7B3BC"/></radialGradient>
      <radialGradient id="pigIris" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#5A2E32"/><stop offset="100%" stop-color="#1E0F10"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#pigBg)"/>
    <ellipse cx="100" cy="150" rx="44" ry="13" fill="#C97682" opacity="0.18"/>
    <path d="M66 52 C50 54 42 74 48 92 C52 100 60 98 62 90 C66 78 68 62 66 52 Z" fill="url(#pigEar)"/>
    <path d="M134 52 C150 54 158 74 152 92 C148 100 140 98 138 90 C134 78 132 62 134 52 Z" fill="url(#pigEar)"/>
    <path d="M100 46 C126 46 144 64 146 90 C148 114 140 138 122 150 C110 158 90 158 78 150 C60 138 52 114 54 90 C56 64 74 46 100 46 Z" fill="url(#pigHead)"/>
    <circle cx="74" cy="92" r="6.5" fill="url(#pigIris)"/>
    <circle cx="126" cy="92" r="6.5" fill="url(#pigIris)"/>
    <circle cx="72" cy="90" r="1.4" fill="#fff" opacity="0.85"/>
    <circle cx="124" cy="90" r="1.4" fill="#fff" opacity="0.85"/>
    <ellipse cx="100" cy="126" rx="26" ry="20" fill="url(#pigSnout)"/>
    <ellipse cx="91" cy="126" rx="4" ry="6" fill="#8A4650"/>
    <ellipse cx="109" cy="126" rx="4" ry="6" fill="#8A4650"/>
  </svg>
`);

const HORSE_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="horBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#F3ECE3"/><stop offset="100%" stop-color="#E2D3C1"/></radialGradient>
      <linearGradient id="horHead" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="#8A6647"/><stop offset="100%" stop-color="#5E4530"/></linearGradient>
      <linearGradient id="horBlaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EFDFC8" stop-opacity="0.95"/><stop offset="100%" stop-color="#EFDFC8" stop-opacity="0.5"/></linearGradient>
      <radialGradient id="horIris" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#4A2F1D"/><stop offset="100%" stop-color="#160D06"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#horBg)"/>
    <path d="M74 40 62 18 88 34Z" fill="url(#horHead)"/>
    <path d="M126 40 138 18 112 34Z" fill="url(#horHead)"/>
    <path d="M78 36 70 22 88 32Z" fill="#4C3820"/>
    <path d="M122 36 130 22 112 32Z" fill="#4C3820"/>
    <path d="M100 30 C118 30 130 44 132 66 C134 90 130 130 122 158 C116 178 84 178 78 158 C70 130 66 90 68 66 C70 44 82 30 100 30 Z" fill="url(#horHead)"/>
    <g fill="#4C3820">
      <path d="M90 30c-4 8-4 16 2 20 2-8 0-16-2-20Z"/>
      <path d="M100 28c-2 9-1 18 3 22 3-9 1-18-3-22Z"/>
      <path d="M110 30c4 8 4 16-2 20-2-8 0-16 2-20Z"/>
    </g>
    <path d="M100 58c-8 0-12 8-12 20l2 62c1 10 8 16 10 16s9-6 10-16l2-62c0-12-4-20-12-20Z" fill="url(#horBlaze)"/>
    <ellipse cx="76" cy="97" rx="11" ry="13" fill="#2E2013"/>
    <ellipse cx="124" cy="97" rx="11" ry="13" fill="#2E2013"/>
    <ellipse cx="76" cy="95" rx="8" ry="10" fill="url(#horIris)"/>
    <ellipse cx="124" cy="95" rx="8" ry="10" fill="url(#horIris)"/>
    <circle cx="73" cy="91" r="2" fill="#fff" opacity="0.75"/>
    <circle cx="121" cy="91" r="2" fill="#fff" opacity="0.75"/>
    <g fill="#3A2A18">
      <path d="M80 150c-6 2-9 8-6 13 4 2 10-1 11-7 1-3 0-5-5-6Z"/>
      <path d="M120 150c6 2 9 8 6 13-4 2-10-1-11-7-1-3 0-5 5-6Z"/>
    </g>
    <path d="M84 168q16 8 32 0" stroke="#2E2013" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>
`);

const REPTILE_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="repBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#EAF5E6"/><stop offset="100%" stop-color="#D2E9CB"/></radialGradient>
      <radialGradient id="repHead" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#7FBF78"/><stop offset="100%" stop-color="#3F7A3B"/></radialGradient>
      <radialGradient id="repIris" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#C8DE8A"/><stop offset="100%" stop-color="#5A8A3E"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#repBg)"/>
    <ellipse cx="100" cy="150" rx="44" ry="12" fill="#3F7A3B" opacity="0.18"/>
    <g fill="#2E5E2A">
      <path d="M86 52 100 40 100 56Z"/>
      <path d="M114 52 100 40 100 56Z"/>
      <path d="M74 58 88 48 90 62Z"/>
      <path d="M126 58 112 48 110 62Z"/>
    </g>
    <path d="M100 50 C122 50 138 66 140 88 C142 108 134 128 118 138 C108 144 92 144 82 138 C66 128 58 108 60 88 C62 66 78 50 100 50 Z" fill="url(#repHead)"/>
    <circle cx="72" cy="90" r="13" fill="#EAF5E6"/>
    <circle cx="128" cy="90" r="13" fill="#EAF5E6"/>
    <circle cx="72" cy="90" r="10" fill="url(#repIris)"/>
    <circle cx="128" cy="90" r="10" fill="url(#repIris)"/>
    <ellipse cx="72" cy="90" rx="2.2" ry="8" fill="#1B1408"/>
    <ellipse cx="128" cy="90" rx="2.2" ry="8" fill="#1B1408"/>
    <circle cx="69" cy="86" r="1.8" fill="#fff" opacity="0.75"/>
    <circle cx="125" cy="86" r="1.8" fill="#fff" opacity="0.75"/>
    <g fill="#2E5E2A" opacity="0.7">
      <ellipse cx="92" cy="118" rx="2.6" ry="4" transform="rotate(20 92 118)"/>
      <ellipse cx="108" cy="118" rx="2.6" ry="4" transform="rotate(-20 108 118)"/>
    </g>
    <path d="M80 130 Q100 140 120 130" stroke="#22461F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>
`);

const FERRET_AVATAR = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="ferBg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#F5F3EE"/><stop offset="100%" stop-color="#E6E1D5"/></radialGradient>
      <radialGradient id="ferHead" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#D9D2C4"/><stop offset="100%" stop-color="#A69C89"/></radialGradient>
      <radialGradient id="ferMask" cx="35%" cy="26%" r="85%"><stop offset="0%" stop-color="#5C544A"/><stop offset="100%" stop-color="#2E2921"/></radialGradient>
      <radialGradient id="ferIris" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#6B4530"/><stop offset="100%" stop-color="#1E1108"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="98" fill="url(#ferBg)"/>
    <ellipse cx="100" cy="150" rx="40" ry="12" fill="#A69C89" opacity="0.18"/>
    <circle cx="66" cy="58" r="12" fill="url(#ferHead)"/>
    <circle cx="134" cy="58" r="12" fill="url(#ferHead)"/>
    <path d="M100 46 C120 46 134 62 136 86 C138 108 132 130 118 142 C110 148 90 148 82 142 C68 130 62 108 64 86 C66 62 80 46 100 46 Z" fill="url(#ferHead)"/>
    <rect x="58" y="82" width="84" height="26" rx="13" fill="url(#ferMask)"/>
    <circle cx="78" cy="95" r="9" fill="#EDE9DD"/>
    <circle cx="122" cy="95" r="9" fill="#EDE9DD"/>
    <circle cx="78" cy="95" r="6.5" fill="url(#ferIris)"/>
    <circle cx="122" cy="95" r="6.5" fill="url(#ferIris)"/>
    <circle cx="76" cy="93" r="1.4" fill="#fff" opacity="0.85"/>
    <circle cx="120" cy="93" r="1.4" fill="#fff" opacity="0.85"/>
    <ellipse cx="100" cy="128" rx="5" ry="4" fill="#2E2921"/>
    <path d="M100 132q0 6-6 8M100 132q0 6 6 8" stroke="#8A7E6C" stroke-width="1.6" fill="none" stroke-linecap="round"/>
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
  dog: DOG_AVATAR,
  cat: CAT_AVATAR,
  rabbit: RABBIT_AVATAR,
  bird: BIRD_AVATAR,
  fish: FISH_AVATAR,
  hamster: HAMSTER_AVATAR,
  pig: PIG_AVATAR,
  horse: HORSE_AVATAR,
  reptile: REPTILE_AVATAR,
  ferret: FERRET_AVATAR,
  other: OTHER_AVATAR,
};

export function resolvePetAvatar(photoUrl?: string | null, species?: string | null) {
  if (photoUrl && !photoUrl.startsWith('preset:')) return photoUrl;
  return DEFAULT_AVATARS[species ?? ''] ?? null;
}
