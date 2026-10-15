import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'

import type { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import type { PageWallpaperConfig } from '~/utils/wallpaperConfig'
import { getPageWallpaperConfig } from '~/utils/wallpaperConfig'

export function usePageWallpaper(activatedPage: Ref<AppPage> | ComputedRef<AppPage>) {
  const currentConfig = computed<PageWallpaperConfig>(() => {
    return getPageWallpaperConfig(activatedPage.value, settings.value)
  })

  return {
    currentConfig,
  }
}
