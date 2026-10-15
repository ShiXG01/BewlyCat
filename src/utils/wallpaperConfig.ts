import { AppPage } from '~/enums/appEnums'
import type { Settings } from '~/logic/storage'

export type WallpaperLayout = 'cover' | 'contain' | 'stretch' | 'center' | 'tile'

export const DEFAULT_WALLPAPER_LAYOUT: WallpaperLayout = 'cover'

export const WALLPAPER_LAYOUTS: readonly WallpaperLayout[] = [
  'cover',
  'contain',
  'stretch',
  'center',
  'tile',
] as const

export function isWallpaperLayout(value: unknown): value is WallpaperLayout {
  return typeof value === 'string' && WALLPAPER_LAYOUTS.includes(value as WallpaperLayout)
}

export function normalizeWallpaperLayout(value: unknown): WallpaperLayout {
  return isWallpaperLayout(value) ? value : DEFAULT_WALLPAPER_LAYOUT
}

export interface WallpaperLayoutStyle {
  backgroundSize: string
  backgroundRepeat: string
  backgroundPosition: string
}

export const WALLPAPER_LAYOUT_STYLES: Record<WallpaperLayout, WallpaperLayoutStyle> = {
  cover: {
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  contain: {
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  stretch: {
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  center: {
    backgroundSize: 'auto',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
  tile: {
    backgroundSize: 'auto',
    backgroundRepeat: 'repeat',
    backgroundPosition: 'left top',
  },
}

export function getWallpaperLayoutStyle(layout: unknown): WallpaperLayoutStyle {
  return WALLPAPER_LAYOUT_STYLES[normalizeWallpaperLayout(layout)]
}

export interface PageWallpaperConfig {
  isIndividuallySet: boolean
  wallpaper: string
  layout: WallpaperLayout
  maskEnabled: boolean
  maskOpacity: number
  blurIntensity: number
  cacheTime: number
}

/**
 * 根据页面类型和全局设置，解析当前页面实际生效的壁纸及遮罩配置。
 * 默认关闭独立壁纸时完整继承全局配置；开启时遵循页面专属配置。
 */
export function getPageWallpaperConfig(page: AppPage, settings: Settings): PageWallpaperConfig {
  if (page === AppPage.Search && settings.individuallySetSearchPageWallpaper) {
    return {
      isIndividuallySet: true,
      wallpaper: settings.searchPageWallpaper,
      layout: normalizeWallpaperLayout(settings.searchPageWallpaperLayout),
      maskEnabled: settings.searchPageEnableWallpaperMasking,
      maskOpacity: settings.searchPageWallpaperMaskOpacity,
      blurIntensity: settings.searchPageWallpaperBlurIntensity,
      cacheTime: settings.searchPageWallpaperCacheTime,
    }
  }

  if (page === AppPage.Moments && settings.individuallySetMomentsPageWallpaper) {
    return {
      isIndividuallySet: true,
      wallpaper: settings.momentsPageWallpaper,
      layout: normalizeWallpaperLayout(settings.momentsPageWallpaperLayout),
      maskEnabled: settings.momentsPageEnableWallpaperMasking,
      maskOpacity: settings.momentsPageWallpaperMaskOpacity,
      blurIntensity: settings.momentsPageWallpaperBlurIntensity,
      cacheTime: settings.momentsPageWallpaperCacheTime,
    }
  }

  return {
    isIndividuallySet: false,
    wallpaper: settings.wallpaper,
    layout: normalizeWallpaperLayout(settings.wallpaperLayout),
    maskEnabled: settings.enableWallpaperMasking,
    maskOpacity: settings.wallpaperMaskOpacity,
    blurIntensity: settings.wallpaperBlurIntensity,
    cacheTime: settings.wallpaperCacheTime,
  }
}

export type VideoPageWallpaperType = 'off' | 'follow' | 'individual'

export const DEFAULT_VIDEO_PAGE_WALLPAPER_TYPE: VideoPageWallpaperType = 'off'

export interface VideoPageWallpaperConfig {
  mode: VideoPageWallpaperType
  wallpaper: string
  layout: WallpaperLayout
  maskEnabled: boolean
  maskOpacity: number
  blurIntensity: number
  cacheTime: number
}

/**
 * 解析普通视频播放页实际生效的壁纸及遮罩配置。
 * - off: 关闭背景（返回 null）
 * - follow: 完整继承全局配置（图片、布局、遮罩、模糊、缓存）
 * - individual: 独立设置。注意：独立空图片不回退全局；无效数值安全回退。
 */
export function getVideoPageWallpaperConfig(settings: Settings): VideoPageWallpaperConfig | null {
  const type = settings.videoPageWallpaperType || DEFAULT_VIDEO_PAGE_WALLPAPER_TYPE
  if (type === 'off')
    return null

  if (type === 'individual') {
    return {
      mode: 'individual',
      wallpaper: typeof settings.videoPageWallpaper === 'string' ? settings.videoPageWallpaper : '',
      layout: normalizeWallpaperLayout(settings.videoPageWallpaperLayout),
      maskEnabled: typeof settings.videoPageEnableWallpaperMasking === 'boolean'
        ? settings.videoPageEnableWallpaperMasking
        : true,
      maskOpacity: typeof settings.videoPageWallpaperMaskOpacity === 'number' && Number.isFinite(settings.videoPageWallpaperMaskOpacity)
        ? Math.max(0, Math.min(100, settings.videoPageWallpaperMaskOpacity))
        : 80,
      blurIntensity: typeof settings.videoPageWallpaperBlurIntensity === 'number' && Number.isFinite(settings.videoPageWallpaperBlurIntensity)
        ? Math.max(0, Math.min(60, settings.videoPageWallpaperBlurIntensity))
        : 0,
      cacheTime: typeof settings.videoPageWallpaperCacheTime === 'number' && Number.isFinite(settings.videoPageWallpaperCacheTime)
        ? Math.max(0, Math.min(168, settings.videoPageWallpaperCacheTime))
        : 0,
    }
  }

  // type === 'follow'
  return {
    mode: 'follow',
    wallpaper: typeof settings.wallpaper === 'string' ? settings.wallpaper : '',
    layout: normalizeWallpaperLayout(settings.wallpaperLayout),
    maskEnabled: typeof settings.enableWallpaperMasking === 'boolean'
      ? settings.enableWallpaperMasking
      : false,
    maskOpacity: typeof settings.wallpaperMaskOpacity === 'number' && Number.isFinite(settings.wallpaperMaskOpacity)
      ? Math.max(0, Math.min(100, settings.wallpaperMaskOpacity))
      : 80,
    blurIntensity: typeof settings.wallpaperBlurIntensity === 'number' && Number.isFinite(settings.wallpaperBlurIntensity)
      ? Math.max(0, Math.min(60, settings.wallpaperBlurIntensity))
      : 0,
    cacheTime: typeof settings.wallpaperCacheTime === 'number' && Number.isFinite(settings.wallpaperCacheTime)
      ? Math.max(0, Math.min(168, settings.wallpaperCacheTime))
      : 0,
  }
}
