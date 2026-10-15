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
