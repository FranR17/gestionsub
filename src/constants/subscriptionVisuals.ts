export type SubscriptionTone = 'netflix' | 'spotify' | 'hbo' | 'bank' | 'cancelled' | 'default'

type SubscriptionBrand = {
  tone: Exclude<SubscriptionTone, 'cancelled'>
  logoFile: string
  keywords: string[]
}

const logoBasePath = '/logos'

const subscriptionBrands: SubscriptionBrand[] = [
  { tone: 'netflix', logoFile: 'netflix.svg', keywords: ['netflix'] },
  { tone: 'spotify', logoFile: 'spotify.svg', keywords: ['spotify'] },
  { tone: 'hbo', logoFile: 'hbo.svg', keywords: ['hbo', 'max'] },
  { tone: 'bank', logoFile: 'banco.svg', keywords: ['banco', 'bank', 'caixa', 'bbva', 'santander'] },
  { tone: 'default', logoFile: 'disney-plus.svg', keywords: ['disney+', 'disney plus'] },
  { tone: 'default', logoFile: 'disney.svg', keywords: ['disney'] },
  { tone: 'default', logoFile: 'apple-tv.svg', keywords: ['apple tv', 'apple tv+'] },
  { tone: 'default', logoFile: 'apple-music.svg', keywords: ['apple music'] },
  { tone: 'default', logoFile: 'icloud.svg', keywords: ['icloud'] },
  { tone: 'default', logoFile: 'youtube.svg', keywords: ['youtube'] },
  { tone: 'default', logoFile: 'youtube-premium.svg', keywords: ['youtube premium'] },
  { tone: 'default', logoFile: 'youtube-music.svg', keywords: ['youtube music'] },
  { tone: 'default', logoFile: 'prime-video.svg', keywords: ['prime', 'amazon'] },
  { tone: 'default', logoFile: 'amazon-music.svg', keywords: ['amazon music'] },
  { tone: 'default', logoFile: 'twitch.svg', keywords: ['twitch'] },
  { tone: 'default', logoFile: 'paramount-plus.svg', keywords: ['paramount', 'paramount+'] },
  { tone: 'default', logoFile: 'movistar-plus.svg', keywords: ['movistar', 'movistar plus'] },
  { tone: 'default', logoFile: 'dazn.svg', keywords: ['dazn'] },
  { tone: 'default', logoFile: 'filmin.svg', keywords: ['filmin'] },
  { tone: 'default', logoFile: 'atresplayer.svg', keywords: ['atresplayer'] },
  { tone: 'default', logoFile: 'mubi.svg', keywords: ['mubi'] },
  { tone: 'default', logoFile: 'deezer.svg', keywords: ['deezer'] },
  { tone: 'default', logoFile: 'tidal.svg', keywords: ['tidal'] },
  { tone: 'default', logoFile: 'soundcloud.svg', keywords: ['soundcloud'] },
  { tone: 'default', logoFile: 'xbox-game-pass.svg', keywords: ['xbox game pass', 'game pass'] },
  { tone: 'default', logoFile: 'playstation-plus.svg', keywords: ['playstation plus', 'ps plus'] },
  { tone: 'default', logoFile: 'nintendo-switch-online.svg', keywords: ['nintendo switch online'] },
  { tone: 'default', logoFile: 'ea-play.svg', keywords: ['ea play'] },
  { tone: 'default', logoFile: 'ubisoft-plus.svg', keywords: ['ubisoft+', 'ubisoft plus'] },
  { tone: 'default', logoFile: 'adobe.svg', keywords: ['adobe', 'creative cloud'] },
  { tone: 'default', logoFile: 'microsoft-365.svg', keywords: ['microsoft 365', 'office 365'] },
  { tone: 'default', logoFile: 'notion.svg', keywords: ['notion'] },
  { tone: 'default', logoFile: 'figma.svg', keywords: ['figma'] },
  { tone: 'default', logoFile: 'chatgpt.svg', keywords: ['chatgpt'] },
  { tone: 'default', logoFile: 'claude.svg', keywords: ['claude'] },
  { tone: 'default', logoFile: 'dropbox.svg', keywords: ['dropbox'] },
  { tone: 'default', logoFile: 'google-one.svg', keywords: ['google one'] },
  { tone: 'default', logoFile: 'gym.svg', keywords: ['gym', 'gimnasio'] },
  { tone: 'default', logoFile: 'health.svg', keywords: ['salud', 'health'] },
  { tone: 'default', logoFile: 'phone.svg', keywords: ['telefono', 'móvil', 'movil', 'phone'] },
  { tone: 'default', logoFile: 'internet.svg', keywords: ['internet', 'fibra', 'wifi'] },
  { tone: 'default', logoFile: 'electricity.svg', keywords: ['luz', 'electricidad'] },
  { tone: 'default', logoFile: 'water.svg', keywords: ['agua'] },
  { tone: 'default', logoFile: 'gas.svg', keywords: ['gas'] },
]

export const getSubscriptionVisual = (name: string, category: string, status: 'activa' | 'cancelada') => {
  const normalized = `${name} ${category}`.toLowerCase()
  const match = subscriptionBrands.find((brand) =>
    brand.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  )

  const tone: SubscriptionTone = status === 'cancelada' ? 'cancelled' : (match?.tone ?? 'default')
  const logoSrc = match ? `${logoBasePath}/${match.logoFile}` : null

  return { tone, logoSrc }
}
