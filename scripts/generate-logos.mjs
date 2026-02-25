import fs from 'node:fs/promises'
import path from 'node:path'
import * as simpleIcons from 'simple-icons'

const projectRoot = process.cwd()
const logosDir = path.join(projectRoot, 'public', 'logos')

const logoMappings = [
  { file: 'netflix.svg', candidates: ['siNetflix'] },
  { file: 'spotify.svg', candidates: ['siSpotify'] },
  { file: 'hbo.svg', candidates: ['siHbo', 'siHbomax'] },
  { file: 'banco.svg', placeholder: 'BANK' },
  { file: 'disney-plus.svg', candidates: ['siDisneyplus'] },
  { file: 'disney.svg', candidates: ['siDisney'] },
  { file: 'apple-tv.svg', candidates: ['siAppletv'] },
  { file: 'apple-music.svg', candidates: ['siApplemusic'] },
  { file: 'icloud.svg', candidates: ['siIcloud'] },
  { file: 'youtube.svg', candidates: ['siYoutube'] },
  { file: 'youtube-premium.svg', candidates: ['siYoutubepremium'] },
  { file: 'youtube-music.svg', candidates: ['siYoutubemusic'] },
  { file: 'prime-video.svg', candidates: ['siPrimevideo'] },
  { file: 'amazon-music.svg', candidates: ['siAmazonmusic'] },
  { file: 'twitch.svg', candidates: ['siTwitch'] },
  { file: 'paramount-plus.svg', candidates: ['siParamountplus'] },
  { file: 'movistar-plus.svg', candidates: ['siMovistar'] },
  { file: 'dazn.svg', candidates: ['siDazn'] },
  { file: 'filmin.svg', placeholder: 'FILM' },
  { file: 'atresplayer.svg', placeholder: 'ATR' },
  { file: 'mubi.svg', candidates: ['siMubi'] },
  { file: 'deezer.svg', candidates: ['siDeezer'] },
  { file: 'tidal.svg', candidates: ['siTidal'] },
  { file: 'soundcloud.svg', candidates: ['siSoundcloud'] },
  { file: 'xbox-game-pass.svg', candidates: ['siXbox'] },
  { file: 'playstation-plus.svg', candidates: ['siPlaystation'] },
  { file: 'nintendo-switch-online.svg', candidates: ['siNintendoswitch'] },
  { file: 'ea-play.svg', candidates: ['siEa'] },
  { file: 'ubisoft-plus.svg', candidates: ['siUbisoft'] },
  { file: 'adobe.svg', candidates: ['siAdobe'] },
  { file: 'microsoft-365.svg', candidates: ['siMicrosoft365', 'siMicrosoftoffice'] },
  { file: 'notion.svg', candidates: ['siNotion'] },
  { file: 'figma.svg', candidates: ['siFigma'] },
  { file: 'chatgpt.svg', candidates: ['siOpenai', 'siChatgpt'] },
  { file: 'claude.svg', candidates: ['siClaude'] },
  { file: 'dropbox.svg', candidates: ['siDropbox'] },
  { file: 'google-one.svg', candidates: ['siGoogleone'] },
  { file: 'gym.svg', placeholder: 'GYM' },
  { file: 'health.svg', placeholder: 'HLT' },
  { file: 'phone.svg', placeholder: 'TEL' },
  { file: 'internet.svg', placeholder: 'NET' },
  { file: 'electricity.svg', placeholder: 'ELE' },
  { file: 'water.svg', placeholder: 'H2O' },
  { file: 'gas.svg', placeholder: 'GAS' },
]

const iconToSvg = (icon) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${icon.title}">
  <path fill="#${icon.hex}" d="${icon.path}"/>
</svg>
`

const placeholderSvg = (label) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${label}">
  <rect width="120" height="120" rx="24" fill="#1f2937"/>
  <text x="60" y="67" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" fill="#f9fafb" font-weight="700">${label}</text>
</svg>
`

await fs.mkdir(logosDir, { recursive: true })

let generated = 0
let placeholders = 0
const autoPlaceholders = []

for (const mapping of logoMappings) {
  const outPath = path.join(logosDir, mapping.file)
  let content = null

  if (mapping.candidates) {
    const icon = mapping.candidates.map((name) => simpleIcons[name]).find(Boolean)
    if (icon) {
      content = iconToSvg(icon)
      generated += 1
    }
  }

  if (!content && mapping.placeholder) {
    content = placeholderSvg(mapping.placeholder)
    placeholders += 1
  }

  if (!content) {
    const autoLabel = mapping.file.replace('.svg', '').split('-').map((part) => part[0]).join('').toUpperCase().slice(0, 3)
    content = placeholderSvg(autoLabel || 'APP')
    placeholders += 1
    autoPlaceholders.push(mapping.file)
  }

  await fs.writeFile(outPath, content, 'utf8')
}

console.log(`Logos generados desde marcas: ${generated}`)
console.log(`Placeholders generados: ${placeholders}`)
if (autoPlaceholders.length > 0) {
  console.log('Placeholders automáticos:', autoPlaceholders.join(', '))
}
