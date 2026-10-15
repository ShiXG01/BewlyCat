import { watch } from 'vue'

import { resolveWallpaperSource, waitForWallpaperDecode } from '~/composables/useWallpaperSource'
import { localSettings, settings, settingsReady } from '~/logic'
import VIDEO_PAGE_WALLPAPER_CSS from '~/styles/adaptedStyles/pages/videoPageWallpaper.scss?inline'
import { stripBilibiliLocalePathname } from '~/utils/bilibiliLocale'
import { localWallpapers, localWallpapersReady } from '~/utils/localWallpaper'
import { injectCSS, isInIframe } from '~/utils/main'
import type { VideoPageWallpaperConfig } from '~/utils/wallpaperConfig'
import { getVideoPageWallpaperConfig, getWallpaperLayoutStyle } from '~/utils/wallpaperConfig'

const ROOT_ID = 'bewly-video-wallpaper-root'
const ROOT_CLASS = 'bewly-video-page-wallpaper'
const BEWLY_WIDESCREEN_BODY_CLASS = 'bewly-widescreen-active'
const BEWLY_WIDESCREEN_ROOT_ID = 'bewly-widescreen-root'

/**
 * 判断当前页面是否为受支持的 www.bilibili.com 普通 /video/ 顶层页。
 * 兼容多语言路径前缀（如 /en/video/BV...、/ja/video/BV...）与分 P（?p=...）。
 * 明确排除 iframe、list/medialist、bangumi/cheese、festival、直播等。
 */
export function isNormalVideoTopPage(url: string = location.href): boolean {
  if (isInIframe())
    return false

  try {
    const urlObj = new URL(url)
    const isBiliHost = urlObj.hostname === 'www.bilibili.com' || urlObj.hostname === 'bilibili.com'
    if (!isBiliHost)
      return false

    const pathname = stripBilibiliLocalePathname(urlObj.pathname)
    // 仅支持普通 /video/ 顶层页（例如 /video/BV...、/video/av...）
    if (!/^\/video\/(?:bv[a-z0-9]+|av\d+)\/?$/i.test(pathname))
      return false

    // 排除列表、合集播放等
    if (pathname.includes('/list/') || pathname.includes('/medialist/'))
      return false

    return true
  }
  catch {
    return false
  }
}

/**
 * 判断 Bewly 宽屏是否处于生效状态。
 */
export function isBewlyWidescreenActive(): boolean {
  return Boolean(
    document.body?.classList.contains(BEWLY_WIDESCREEN_BODY_CLASS)
    || document.getElementById(BEWLY_WIDESCREEN_ROOT_ID),
  )
}

let installed = false
let isReady = false
let currentSetupToken = 0

let styleElement: HTMLStyleElement | null = null
let rootElement: HTMLElement | null = null
let imageElement: HTMLElement | null = null
let maskElement: HTMLElement | null = null

let isApplied = false
let displayedWallpaperTarget: string | null = null
let displayedWallpaperUrl: string | null = null
let displayedConfig: VideoPageWallpaperConfig | null = null

let pendingTargetWallpaper: string | null = null
let pendingConfig: VideoPageWallpaperConfig | null = null
let currentLoadId = 0
let currentAbortController: AbortController | null = null

function ensureElements() {
  if (!styleElement) {
    styleElement = injectCSS(VIDEO_PAGE_WALLPAPER_CSS)
  }

  if (!rootElement) {
    rootElement = document.getElementById(ROOT_ID)
    if (!rootElement) {
      rootElement = document.createElement('div')
      rootElement.id = ROOT_ID
      rootElement.className = ROOT_ID
      rootElement.setAttribute('aria-hidden', 'true')
      rootElement.style.display = 'none'

      imageElement = document.createElement('div')
      imageElement.className = 'bewly-video-wallpaper-image'

      maskElement = document.createElement('div')
      maskElement.className = 'bewly-video-wallpaper-mask'

      rootElement.appendChild(imageElement)
      rootElement.appendChild(maskElement)

      const target = document.body || document.documentElement
      target.prepend(rootElement)
    }
    else {
      imageElement = rootElement.querySelector('.bewly-video-wallpaper-image')
      maskElement = rootElement.querySelector('.bewly-video-wallpaper-mask')
    }
  }
}

function applyLayoutAndMask(config: VideoPageWallpaperConfig) {
  if (!imageElement || !maskElement)
    return

  const layoutStyle = getWallpaperLayoutStyle(config.layout)
  imageElement.style.backgroundSize = layoutStyle.backgroundSize
  imageElement.style.backgroundRepeat = layoutStyle.backgroundRepeat
  imageElement.style.backgroundPosition = layoutStyle.backgroundPosition

  if (config.blurIntensity > 0) {
    imageElement.style.filter = `blur(${config.blurIntensity}px)`
    imageElement.style.transform = 'scale(1.05)'
    imageElement.style.transformOrigin = 'center'
  }
  else {
    imageElement.style.filter = 'none'
    imageElement.style.transform = 'none'
  }

  if (config.maskEnabled) {
    maskElement.style.display = 'block'
    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('bili_dark')
    const alpha = Math.max(0, Math.min(100, config.maskOpacity)) / 100
    maskElement.style.backgroundColor = isDark ? `rgba(24, 25, 28, ${alpha})` : `rgba(247, 248, 250, ${alpha})`
  }
  else {
    maskElement.style.display = 'none'
  }
}

function cancelPendingLoad() {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  currentLoadId++
  pendingTargetWallpaper = null
  pendingConfig = null
}

function deactivateWallpaper() {
  cancelPendingLoad()

  if (isApplied) {
    document.documentElement.classList.remove(ROOT_CLASS)
    if (rootElement) {
      rootElement.style.display = 'none'
    }
    isApplied = false
    displayedWallpaperUrl = null
    displayedWallpaperTarget = null
    displayedConfig = null
  }
}

async function updateVideoPageWallpaper(setupToken: number = currentSetupToken) {
  if (!installed || setupToken !== currentSetupToken || !isReady)
    return

  // 1. 检查是否在受支持的普通视频顶层页
  if (!isNormalVideoTopPage()) {
    cancelPendingLoad()
    deactivateWallpaper()
    return
  }

  // 2. 检查是否处于 Bewly 宽屏生效期间（排除模式）
  if (isBewlyWidescreenActive()) {
    cancelPendingLoad()
    deactivateWallpaper()
    return
  }

  // 3. 读取当前配置
  const config = getVideoPageWallpaperConfig(settings.value)
  if (!config || !config.wallpaper) {
    // 关闭模式或独立未配置图片时不显示壁纸，独立空图片不回退全局
    cancelPendingLoad()
    deactivateWallpaper()
    return
  }

  // 4. 当前正处于展示状态，且当前展示的源正是期望的 wallpaper 和 cacheTime
  if (
    isApplied
    && displayedWallpaperTarget === config.wallpaper
    && displayedConfig?.cacheTime === config.cacheTime
    && displayedWallpaperUrl
  ) {
    // 若此前有针对其他图片的异步任务正在加载，立即中断，防止旧异步结果覆盖当前正确壁纸
    cancelPendingLoad()
    displayedConfig = config
    applyLayoutAndMask(config)
    return
  }

  // 5. 若目标图片正在异步加载中，且仅为布局/遮罩/模糊等样式改变，更新 pendingConfig，不重复解码同源图
  if (
    pendingTargetWallpaper === config.wallpaper
    && pendingConfig?.cacheTime === config.cacheTime
  ) {
    pendingConfig = config
    return
  }

  // 6. 开启新一轮异步加载
  cancelPendingLoad()
  const loadId = ++currentLoadId
  currentAbortController = new AbortController()
  const signal = currentAbortController.signal
  pendingTargetWallpaper = config.wallpaper
  pendingConfig = config

  try {
    const resolvedUrl = await resolveWallpaperSource(config.wallpaper, config.cacheTime)
    if (signal.aborted || loadId !== currentLoadId || !installed || setupToken !== currentSetupToken)
      return

    if (!resolvedUrl) {
      pendingTargetWallpaper = null
      pendingConfig = null
      deactivateWallpaper()
      return
    }

    // 若解析后与当前已展示的完全一致，直接复用
    if (isApplied && resolvedUrl === displayedWallpaperUrl) {
      const finalConfig = pendingConfig || config
      pendingTargetWallpaper = null
      pendingConfig = null
      displayedWallpaperTarget = config.wallpaper
      displayedConfig = finalConfig
      applyLayoutAndMask(finalConfig)
      return
    }

    // 解码图片
    await waitForWallpaperDecode(resolvedUrl, signal)
    if (signal.aborted || loadId !== currentLoadId || !installed || setupToken !== currentSetupToken)
      return

    // 解码成功，激活壁纸
    ensureElements()
    if (!rootElement || !imageElement || !maskElement)
      return

    const finalConfig = pendingConfig || config
    imageElement.style.backgroundImage = `url("${resolvedUrl}")`
    applyLayoutAndMask(finalConfig)
    rootElement.style.display = 'block'
    document.documentElement.classList.add(ROOT_CLASS)

    isApplied = true
    displayedWallpaperUrl = resolvedUrl
    displayedWallpaperTarget = config.wallpaper
    displayedConfig = finalConfig
    pendingTargetWallpaper = null
    pendingConfig = null
    currentAbortController = null
  }
  catch {
    if (loadId === currentLoadId && installed && setupToken === currentSetupToken) {
      pendingTargetWallpaper = null
      pendingConfig = null
      currentAbortController = null
      deactivateWallpaper()
    }
  }
}

export function setupVideoPageWallpaper(): () => void {
  if (installed) {
    return () => {}
  }
  installed = true
  isReady = false
  const setupToken = ++currentSetupToken

  // 监听 SPA 路由导航（pushstate, replacestate, popstate, hashchange）
  const handleUrlChange = () => {
    queueMicrotask(() => {
      if (!installed || setupToken !== currentSetupToken)
        return
      void updateVideoPageWallpaper(setupToken)
    })
  }

  window.addEventListener('pushstate', handleUrlChange, true)
  window.addEventListener('replacestate', handleUrlChange, true)
  window.addEventListener('popstate', handleUrlChange, true)
  window.addEventListener('hashchange', handleUrlChange, true)

  // 监听 Bewly 宽屏类名及 DOM 变化
  const bodyObserver = new MutationObserver(() => {
    if (!installed || setupToken !== currentSetupToken)
      return
    void updateVideoPageWallpaper(setupToken)
  })

  const docObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && isApplied && displayedConfig) {
        if (!installed || setupToken !== currentSetupToken)
          return
        applyLayoutAndMask(displayedConfig)
        break
      }
    }
  })

  // 在 body 就绪后启动 observer
  const startObservers = () => {
    if (!installed || setupToken !== currentSetupToken)
      return
    if (document.body) {
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    }
    if (document.documentElement) {
      docObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    }
  }

  let domContentLoadedHandler: (() => void) | null = null
  if (document.body) {
    startObservers()
  }
  else {
    domContentLoadedHandler = startObservers
    document.addEventListener('DOMContentLoaded', domContentLoadedHandler, { once: true })
  }

  // 监听设置变更
  const stopWatch = watch(
    [
      () => settings.value.videoPageWallpaperType,
      () => settings.value.videoPageWallpaperMode,
      () => settings.value.videoPageWallpaper,
      () => settings.value.videoPageWallpaperLayout,
      () => settings.value.videoPageEnableWallpaperMasking,
      () => settings.value.videoPageWallpaperMaskOpacity,
      () => settings.value.videoPageWallpaperBlurIntensity,
      () => settings.value.videoPageWallpaperCacheTime,
      () => settings.value.wallpaper,
      () => settings.value.wallpaperLayout,
      () => settings.value.enableWallpaperMasking,
      () => settings.value.wallpaperMaskOpacity,
      () => settings.value.wallpaperBlurIntensity,
      () => settings.value.wallpaperCacheTime,
      () => localSettings.value.videoPageLocallyUploadedWallpaper,
      () => localWallpapers.value,
    ],
    () => {
      if (!installed || setupToken !== currentSetupToken)
        return
      void updateVideoPageWallpaper(setupToken)
    },
  )

  // 等待真实设置与本地壁纸双重水合完成后首次执行
  void Promise.all([settingsReady, localWallpapersReady]).then(() => {
    if (!installed || setupToken !== currentSetupToken)
      return
    isReady = true
    void updateVideoPageWallpaper(setupToken)
  })

  return () => {
    if (setupToken !== currentSetupToken)
      return

    installed = false
    isReady = false
    currentSetupToken++ // 失效针对该代次的所有待处理微任务与异步回调

    window.removeEventListener('pushstate', handleUrlChange, true)
    window.removeEventListener('replacestate', handleUrlChange, true)
    window.removeEventListener('popstate', handleUrlChange, true)
    window.removeEventListener('hashchange', handleUrlChange, true)

    if (domContentLoadedHandler) {
      document.removeEventListener('DOMContentLoaded', domContentLoadedHandler)
    }

    bodyObserver.disconnect()
    docObserver.disconnect()
    stopWatch()

    cancelPendingLoad()
    deactivateWallpaper()

    if (rootElement) {
      rootElement.remove()
      rootElement = null
      imageElement = null
      maskElement = null
    }

    if (styleElement) {
      styleElement.remove()
      styleElement = null
    }
  }
}
