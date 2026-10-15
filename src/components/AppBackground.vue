<script setup lang="ts">
import type { CSSProperties } from 'vue'

import { useDark } from '~/composables/useDark'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { isLocalWallpaperUrl, resolveWallpaperUrl } from '~/utils/localWallpaper'
import { hexToHSL } from '~/utils/main'
import { cleanupExpiredCache, getOrCacheWallpaper } from '~/utils/wallpaperCache'
import { getPageWallpaperConfig } from '~/utils/wallpaperConfig'

const props = defineProps<{ activatedPage: AppPage }>()
const emit = defineEmits<{ wallpaperReady: [ready: boolean] }>()

const { isDark } = useDark()

// 组件挂载时清理过期缓存
onMounted(() => {
  cleanupExpiredCache()
})

// 计算解析后的壁纸URL(支持本地壁纸和缓存控制)
const resolvedWallpaper = ref('')
const resolvedSearchPageWallpaper = ref('')
const resolvedMomentsPageWallpaper = ref('')

function waitForWallpaperDecode(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const image = new Image()
    let settled = false
    let decoding = false

    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', handleAbort)
      image.removeAttribute('src')
    }
    function handleAbort() {
      if (settled)
        return

      settled = true
      cleanup()
      resolve()
    }
    const handleLoad = async () => {
      if (settled || decoding)
        return

      decoding = true
      try {
        await image.decode()
      }
      catch {
        // load 已成功时仍允许展示；部分浏览器会对已解码图片拒绝重复 decode。
      }
      if (settled)
        return

      settled = true
      cleanup()
      resolve()
    }
    const handleError = () => {
      if (settled)
        return

      settled = true
      cleanup()
      reject(new Error('Failed to load wallpaper'))
    }

    image.decoding = 'async'
    image.onload = () => void handleLoad()
    image.onerror = handleError
    signal.addEventListener('abort', handleAbort, { once: true })
    image.src = url

    // data URL 或内存缓存可能在监听器注册后已经完成加载。
    if (image.complete) {
      if (image.naturalWidth > 0)
        void handleLoad()
      else
        handleError()
    }
  })
}

async function resolveWallpaperSource(originalUrl: string, cacheTime: number): Promise<string> {
  if (isLocalWallpaperUrl(originalUrl))
    return resolveWallpaperUrl(originalUrl) || ''

  return originalUrl ? await getOrCacheWallpaper(originalUrl, cacheTime) : ''
}

// 解析全局壁纸
async function resolveGlobalWallpaper(signal: AbortSignal) {
  const originalUrl = settings.value.wallpaper
  const resolvedUrl = await resolveWallpaperSource(originalUrl, settings.value.wallpaperCacheTime)
  if (signal.aborted)
    return

  if (!resolvedUrl) {
    resolvedWallpaper.value = ''
    return
  }

  try {
    await waitForWallpaperDecode(resolvedUrl, signal)
    if (!signal.aborted)
      resolvedWallpaper.value = resolvedUrl
  }
  catch {
    if (!signal.aborted)
      resolvedWallpaper.value = ''
  }
}

// 解析搜索页壁纸
async function resolveSearchWallpaper(signal: AbortSignal) {
  if (!settings.value.individuallySetSearchPageWallpaper) {
    resolvedSearchPageWallpaper.value = ''
    return
  }

  const originalUrl = settings.value.searchPageWallpaper
  const resolvedUrl = await resolveWallpaperSource(originalUrl, settings.value.searchPageWallpaperCacheTime)
  if (signal.aborted)
    return

  if (!resolvedUrl) {
    resolvedSearchPageWallpaper.value = ''
    return
  }

  try {
    await waitForWallpaperDecode(resolvedUrl, signal)
    if (!signal.aborted)
      resolvedSearchPageWallpaper.value = resolvedUrl
  }
  catch {
    if (!signal.aborted)
      resolvedSearchPageWallpaper.value = ''
  }
}

// 解析动态页壁纸
async function resolveMomentsWallpaper(signal: AbortSignal) {
  if (!settings.value.individuallySetMomentsPageWallpaper) {
    resolvedMomentsPageWallpaper.value = ''
    return
  }

  const originalUrl = settings.value.momentsPageWallpaper
  const resolvedUrl = await resolveWallpaperSource(originalUrl, settings.value.momentsPageWallpaperCacheTime)
  if (signal.aborted)
    return

  if (!resolvedUrl) {
    resolvedMomentsPageWallpaper.value = ''
    return
  }

  try {
    await waitForWallpaperDecode(resolvedUrl, signal)
    if (!signal.aborted)
      resolvedMomentsPageWallpaper.value = resolvedUrl
  }
  catch {
    if (!signal.aborted)
      resolvedMomentsPageWallpaper.value = ''
  }
}

// 逐项监听壁纸来源和缓存时间，避免无关设置触发大图重复加载、解码。
watch([() => settings.value.wallpaper, () => settings.value.wallpaperCacheTime], ([, newCacheTime], oldValue, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  // 如果缓存时间改变,用新的缓存时间清理可能已过期的缓存
  if (oldValue && newCacheTime !== oldValue[1]) {
    cleanupExpiredCache(newCacheTime)
  }
  void resolveGlobalWallpaper(controller.signal)
}, { immediate: true })

watch(
  [
    () => settings.value.individuallySetSearchPageWallpaper,
    () => settings.value.searchPageWallpaper,
    () => settings.value.searchPageWallpaperCacheTime,
  ],
  ([individuallySet, , newCacheTime], oldValue, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    if (oldValue && newCacheTime !== oldValue[2]) {
      cleanupExpiredCache(newCacheTime)
    }
    if (individuallySet) {
      void resolveSearchWallpaper(controller.signal)
    }
    else {
      resolvedSearchPageWallpaper.value = ''
    }
  },
  { immediate: true },
)

watch(
  [
    () => settings.value.individuallySetMomentsPageWallpaper,
    () => settings.value.momentsPageWallpaper,
    () => settings.value.momentsPageWallpaperCacheTime,
  ],
  ([individuallySet, , newCacheTime], oldValue, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    if (oldValue && newCacheTime !== oldValue[2]) {
      cleanupExpiredCache(newCacheTime)
    }
    if (individuallySet) {
      void resolveMomentsWallpaper(controller.signal)
    }
    else {
      resolvedMomentsPageWallpaper.value = ''
    }
  },
  { immediate: true },
)

// 计算当前页面使用的壁纸URL
const currentWallpaperUrl = computed(() => {
  if (props.activatedPage === AppPage.Search && settings.value.individuallySetSearchPageWallpaper) {
    return resolvedSearchPageWallpaper.value
  }
  if (props.activatedPage === AppPage.Moments && settings.value.individuallySetMomentsPageWallpaper) {
    return resolvedMomentsPageWallpaper.value
  }
  return resolvedWallpaper.value
})

// 控件只在实际壁纸解码成功后使用融合底色，加载失败时仍保持普通页面的可读性。
watch(currentWallpaperUrl, url => emit('wallpaperReady', Boolean(url)), { immediate: true })
onBeforeUnmount(() => emit('wallpaperReady', false))

const currentWallpaperConfig = computed(() => getPageWallpaperConfig(props.activatedPage, settings.value))

const currentWallpaperBlurIntensity = computed(() => {
  return currentWallpaperConfig.value.blurIntensity
})

const isCurrentWallpaperMaskEnabled = computed(() => {
  return currentWallpaperConfig.value.maskEnabled
})

const wallpaperMaskStyle = computed((): CSSProperties => {
  const wallpaperReady = Boolean(currentWallpaperUrl.value)
  const blurIntensity = currentWallpaperBlurIntensity.value
  const backdropFilter = wallpaperReady && blurIntensity > 0 ? `blur(${blurIntensity}px)` : 'none'

  return {
    visibility: wallpaperReady ? 'visible' : 'hidden',
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
  }
})

const themeColorHsl = computed(() => {
  return hexToHSL(settings.value.themeColor).replace('hsl(', '').replace(')', '')
})
const themeColorHue = computed((): number => {
  return Number(themeColorHsl.value.split(',')[0]) || 0
})
const themeColorSaturation = computed((): number => {
  return Number(themeColorHsl.value.split(',')[1].replace('%', '')) || 0
})
const themeColorLightness = computed((): number => {
  return Number(themeColorHsl.value.split(',')[2].replace('%', '')) || 0
})
const themeColorLinearGradientBackground = computed((): string => {
  return `linear-gradient(180deg, 
    transparent 0% 44%,
    hsla(${themeColorHue.value}, ${themeColorSaturation.value + 20}%, ${themeColorLightness.value}%, 0.4) 62%, 
    hsl(${themeColorHue.value}, ${themeColorSaturation.value}%, ${themeColorLightness.value}%) 80%,
    hsl(${themeColorHue.value}, ${themeColorSaturation.value}%, 100%) 100%)`
})

function setAppWallpaperMaskingOpacity() {
  const bewlyElement = document.querySelector<HTMLElement>('#bewly')
  if (!bewlyElement)
    return

  const config = getPageWallpaperConfig(props.activatedPage, settings.value)
  bewlyElement.style.setProperty('--bew-homepage-bg-mask-opacity', `${config.maskOpacity}%`)
}

watch(
  [
    () => props.activatedPage,
    () => settings.value.wallpaperMaskOpacity,
    () => settings.value.searchPageWallpaperMaskOpacity,
    () => settings.value.individuallySetSearchPageWallpaper,
    () => settings.value.momentsPageWallpaperMaskOpacity,
    () => settings.value.individuallySetMomentsPageWallpaper,
  ],
  () => {
    setAppWallpaperMaskingOpacity()
  },
  { immediate: true },
)

// setup 阶段即写入遮罩透明度，避免首帧沿用 token 的 0 默认值。
setAppWallpaperMaskingOpacity()
</script>

<template>
  <div>
    <!-- linear gradient background -->
    <Transition name="fade">
      <div
        v-if="settings.useLinearGradientThemeColorBackground && isDark"
        :style="{
          opacity: activatedPage === AppPage.Search ? 1 : 0.4,
          background: themeColorLinearGradientBackground,
        }"
        pos="absolute top-0 left-0" w-full h-full z-0 pointer-events-none
      />
    </Transition>

    <Transition name="fade">
      <div v-if="activatedPage === AppPage.Search" key="search">
        <!-- background -->
        <div
          pos="absolute top-0 left-0" w-full h-full duration-300 bg="cover center $bew-homepage-bg"
          z--1
          :style="{ backgroundImage: `url('${currentWallpaperUrl}')` }"
        />
        <!-- background mask -->
        <Transition name="fade">
          <div
            v-if="isCurrentWallpaperMaskEnabled"
            pos="absolute top-0 left-0" w-full h-full pointer-events-none bg="$bew-homepage-bg-mask"
            z--1
            :style="wallpaperMaskStyle"
          />
        </Transition>
      </div>
      <div v-else-if="activatedPage === AppPage.Moments" key="moments">
        <!-- background -->
        <div
          pos="absolute top-0 left-0" w-full h-full duration-300 bg="cover center $bew-homepage-bg"
          z--1
          :style="{ backgroundImage: `url('${currentWallpaperUrl}')` }"
        />
        <!-- background mask -->
        <Transition name="fade">
          <div
            v-if="isCurrentWallpaperMaskEnabled"
            pos="absolute top-0 left-0" w-full h-full pointer-events-none bg="$bew-homepage-bg-mask"
            z--1
            :style="wallpaperMaskStyle"
          />
        </Transition>
      </div>
      <div v-else key="default">
        <!-- background -->
        <div
          :style="{ backgroundImage: `url('${currentWallpaperUrl}')` }"
          pos="absolute top-0 left-0" w-full h-full duration-300 bg="cover center $bew-homepage-bg"
          z--1
        />

        <!-- background mask -->
        <Transition name="fade">
          <div
            v-if="isCurrentWallpaperMaskEnabled"
            pos="absolute top-0 left-0" w-full h-full pointer-events-none bg="$bew-homepage-bg-mask"
            z--1
            :style="wallpaperMaskStyle"
          />
        </Transition>
      </div>
    </Transition>
  </div>
</template>
