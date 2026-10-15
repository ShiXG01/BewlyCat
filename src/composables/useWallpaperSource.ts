import { isLocalWallpaperUrl, localWallpapersReady, resolveWallpaperUrl } from '~/utils/localWallpaper'
import { getOrCacheWallpaper } from '~/utils/wallpaperCache'

export function waitForWallpaperDecode(url: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve()
      return
    }

    const image = new Image()
    let settled = false
    let decoding = false

    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal?.removeEventListener('abort', handleAbort)
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
    signal?.addEventListener('abort', handleAbort, { once: true })
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

export async function resolveWallpaperSource(originalUrl: string, cacheTime: number): Promise<string> {
  if (isLocalWallpaperUrl(originalUrl)) {
    await localWallpapersReady
    return resolveWallpaperUrl(originalUrl) || ''
  }

  return originalUrl ? await getOrCacheWallpaper(originalUrl, cacheTime) : ''
}
