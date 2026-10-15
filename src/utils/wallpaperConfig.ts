import { AppPage } from '~/enums/appEnums'
import type { Settings } from '~/logic/storage'

export interface PageWallpaperConfig {
  isIndividuallySet: boolean
  wallpaper: string
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
      maskEnabled: settings.momentsPageEnableWallpaperMasking,
      maskOpacity: settings.momentsPageWallpaperMaskOpacity,
      blurIntensity: settings.momentsPageWallpaperBlurIntensity,
      cacheTime: settings.momentsPageWallpaperCacheTime,
    }
  }

  return {
    isIndividuallySet: false,
    wallpaper: settings.wallpaper,
    maskEnabled: settings.enableWallpaperMasking,
    maskOpacity: settings.wallpaperMaskOpacity,
    blurIntensity: settings.wallpaperBlurIntensity,
    cacheTime: settings.wallpaperCacheTime,
  }
}
