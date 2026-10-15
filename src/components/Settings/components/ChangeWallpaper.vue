<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { WALLPAPERS } from '~/constants/imgs'
import { settings } from '~/logic'
import {
  getLocalUploadedWallpaperRef,
  hasLocalWallpaper,
  isLocalWallpaperUrl,
  removeLocalWallpaperIfUnused,
  resolveWallpaperUrl,
  setLocalUploadedWallpaperRef,
  storeLocalWallpaper,
} from '~/utils/localWallpaper'
import { compressAndResizeImage } from '~/utils/main'

import SettingsItem from './SettingsItem.vue'
import SettingsItemGroup from './SettingsItemGroup.vue'
import SettingsSegmentedControl from './SettingsSegmentedControl.vue'

const props = defineProps<Props>()

interface Props {
  type: 'global' | 'searchPage' | 'momentsPage'
}
type WallpaperMode = 'buildIn' | 'byUrl'

const { t } = useI18n()
const uploadWallpaperRef = ref<HTMLInputElement | null>(null)

const isGlobal = computed(() => props.type === 'global')
const isSearchPage = computed(() => props.type === 'searchPage')
const isMomentsPage = computed(() => props.type === 'momentsPage')

const isIndividuallySet = computed(() => {
  if (isSearchPage.value)
    return settings.value.individuallySetSearchPageWallpaper
  if (isMomentsPage.value)
    return settings.value.individuallySetMomentsPageWallpaper
  return false
})

const isBuildInWallpaper = computed(() => {
  if (isGlobal.value)
    return settings.value.wallpaperMode === 'buildIn'
  if (isSearchPage.value)
    return settings.value.searchPageWallpaperMode === 'buildIn'
  return settings.value.momentsPageWallpaperMode === 'buildIn'
})
const wallpaperMode = computed<WallpaperMode>({
  get: () => isBuildInWallpaper.value ? 'buildIn' : 'byUrl',
  set: changeWallpaperType,
})
const wallpaperModeOptions = computed<{ label: string, value: WallpaperMode }[]>(() => [
  { label: t('settings.wallpaper_mode_opt.build_in'), value: 'buildIn' },
  { label: t('settings.wallpaper_mode_opt.by_url'), value: 'byUrl' },
])

const currentLocalUploadedWallpaper = computed(() => {
  return getLocalUploadedWallpaperRef(props.type)
})

// 计算本地壁纸的实际显示URL
const localWallpaperDisplayUrl = computed(() => {
  const localWallpaper = currentLocalUploadedWallpaper.value
  if (!localWallpaper?.url) {
    return null
  }

  return resolveWallpaperUrl(localWallpaper.url)
})

function getCurrentWallpaperUrl(): string {
  if (isGlobal.value)
    return settings.value.wallpaper
  if (isSearchPage.value)
    return settings.value.searchPageWallpaper
  return settings.value.momentsPageWallpaper
}

// 检查是否为本地壁纸URL
function isLocalWallpaper(url: string): boolean {
  return isLocalWallpaperUrl(url)
}

function changeWallpaperType(type: 'buildIn' | 'byUrl') {
  if (isGlobal.value) {
    settings.value.wallpaperMode = type
    if (type === 'byUrl' && (settings.value.wallpaper.startsWith('data:image/') || isLocalWallpaper(settings.value.wallpaper)))
      settings.value.wallpaper = ''
  }
  else if (isSearchPage.value) {
    settings.value.searchPageWallpaperMode = type
    if (type === 'byUrl' && (settings.value.searchPageWallpaper.startsWith('data:image/') || isLocalWallpaper(settings.value.searchPageWallpaper)))
      settings.value.searchPageWallpaper = ''
  }
  else {
    settings.value.momentsPageWallpaperMode = type
    if (type === 'byUrl' && (settings.value.momentsPageWallpaper.startsWith('data:image/') || isLocalWallpaper(settings.value.momentsPageWallpaper)))
      settings.value.momentsPageWallpaper = ''
  }
}

function changeWallpaper(url: string) {
  if (isGlobal.value) {
    // If you had already set the wallpaper, it enables the wallpaper masking to prevent text hard to see
    if (url)
      settings.value.enableWallpaperMasking = true
    else
      settings.value.enableWallpaperMasking = false
    settings.value.wallpaper = url
  }
  else if (isSearchPage.value) {
    settings.value.searchPageWallpaper = url
  }
  else {
    settings.value.momentsPageWallpaper = url
  }
}

function fileToBase64(inputFile: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(inputFile)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

function triggerUploadWallpaper() {
  uploadWallpaperRef.value?.click()
}

function handleLocalWallpaperClick() {
  const localWallpaper = currentLocalUploadedWallpaper.value
  const localWallpaperUrl = localWallpaper?.url
  if (localWallpaperUrl && localWallpaper?.id && hasLocalWallpaper(localWallpaper.id))
    changeWallpaper(localWallpaperUrl)
  else
    triggerUploadWallpaper()
}

async function handleUploadWallpaper(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  input.value = ''

  compressAndResizeImage(file, 2560, 1440, 0.9, async (compressedFile: File) => {
    try {
      // 转换为base64
      const base64 = await fileToBase64(compressedFile) as string

      // 清理旧的本地壁纸（有引用保护，若仍被其他页面引用则保留）
      const oldRef = getLocalUploadedWallpaperRef(props.type)
      if (oldRef?.isLocal && oldRef.id) {
        removeLocalWallpaperIfUnused(oldRef.id, props.type)
      }

      // 存储到本地storage
      const localWallpaperRef = await storeLocalWallpaper(compressedFile, base64)

      // 使用特殊标识符作为壁纸URL，而不是base64
      const localWallpaperUrl = `local-wallpaper:${localWallpaperRef.id}`
      changeWallpaper(localWallpaperUrl)

      // 保存本地壁纸引用（按页面保存引用）
      setLocalUploadedWallpaperRef(props.type, {
        ...localWallpaperRef,
        url: localWallpaperUrl,
      })
    }
    catch (error) {
      console.error('上传壁纸失败:', error)
    }
  })
}

function handleRemoveCustomWallpaper() {
  // 清理本地存储的壁纸数据（有引用保护）
  const currentRef = getLocalUploadedWallpaperRef(props.type)
  if (currentRef?.isLocal && currentRef.id) {
    removeLocalWallpaperIfUnused(currentRef.id, props.type)
  }

  changeWallpaper('')
  setLocalUploadedWallpaperRef(props.type, null)
}

// 检查本地壁纸是否有效，如果无效则清理
function validateLocalWallpaper() {
  const localWallpaper = getLocalUploadedWallpaperRef(props.type)
  if (localWallpaper?.isLocal && localWallpaper.id) {
    if (!hasLocalWallpaper(localWallpaper.id)) {
      setLocalUploadedWallpaperRef(props.type, null)

      // 如果当前壁纸使用的是丢失的本地壁纸，也清理掉
      const currentWallpaper = getCurrentWallpaperUrl()
      if (isLocalWallpaper(currentWallpaper)) {
        changeWallpaper('')
      }
    }
  }
}

// 组件挂载时验证本地壁纸
onMounted(() => {
  validateLocalWallpaper()
})
</script>

<template>
  <SettingsItemGroup :title="$t('settings.group_wallpaper')">
    <SettingsItem v-if="isSearchPage" :title="$t('settings.individually_set_search_page_wallpaper')" right-width="auto">
      <template #desc>
        <span class="bew-warning-text">{{ $t('common.performance_impact_warn') }}</span>
      </template>

      <Radio v-model="settings.individuallySetSearchPageWallpaper" />
    </SettingsItem>

    <SettingsItem v-else-if="isMomentsPage" :title="$t('settings.individually_set_moments_page_wallpaper')" right-width="auto">
      <template #desc>
        <span class="bew-warning-text">{{ $t('common.performance_impact_warn') }}</span>
      </template>

      <Radio v-model="settings.individuallySetMomentsPageWallpaper" />
    </SettingsItem>

    <template v-if="isGlobal || isIndividuallySet">
      <SettingsItem :title="$t('settings.wallpaper_mode')" :desc="$t('settings.wallpaper_mode_desc')" right-width="auto">
        <SettingsSegmentedControl
          v-model="wallpaperMode"
          :label="$t('settings.wallpaper_mode')"
          :options="wallpaperModeOptions"
        />
      </SettingsItem>

      <!-- 缓存时间设置 - 对所有URL壁纸生效 -->
      <SettingsItem :title="$t('settings.wallpaper_cache_time')" right-width="auto">
        <template #desc>
          {{ $t('settings.wallpaper_cache_time_desc') }}
        </template>
        <Input
          v-if="isGlobal"
          v-model="settings.wallpaperCacheTime"
          type="number"
          :min="0"
          :max="168"
          placeholder="0"
          w-100px
        >
          <template #suffix>
            <span text="sm $bew-text-2">h</span>
          </template>
        </Input>
        <Input
          v-else-if="isSearchPage"
          v-model="settings.searchPageWallpaperCacheTime"
          type="number"
          :min="0"
          :max="168"
          placeholder="0"
          w-100px
        >
          <template #suffix>
            <span text="sm $bew-text-2">h</span>
          </template>
        </Input>
        <Input
          v-else
          v-model="settings.momentsPageWallpaperCacheTime"
          type="number"
          :min="0"
          :max="168"
          placeholder="0"
          w-100px
        >
          <template #suffix>
            <span text="sm $bew-text-2">h</span>
          </template>
        </Input>
      </SettingsItem>

      <SettingsItem v-if="isBuildInWallpaper" :title="$t('settings.choose_ur_wallpaper')">
        <template #bottom>
          <div grid="~ xl:cols-5 lg:cols-4 cols-3 gap-4">
            <picture
              class="bew-settings-option--lift"
              aspect-video bg="$bew-fill-1" rounded="$bew-radius" overflow-hidden
              un-border="4 transparent" cursor-pointer
              grid place-items-center
              :class="{ 'selected-wallpaper': getCurrentWallpaperUrl() === '' }"
              @click="changeWallpaper('')"
            >
              <div i-tabler:photo-off text="size-$bew-icon-size-xl $bew-text-3" />
            </picture>

            <Tooltip v-for="item in WALLPAPERS" :key="item.url" placement="top" :content="item.name" aspect-video>
              <picture
                class="bew-settings-option--lift"
                aspect-video bg="$bew-fill-1" rounded="$bew-radius" overflow-hidden
                un-border="4 transparent" w-full
                :class="{ 'selected-wallpaper': getCurrentWallpaperUrl() === item.url }"
                @click="changeWallpaper(item.url)"
              >
                <img
                  :src="item.thumbnail || item.url"
                  :alt="item.name"
                  w-full h-full object-cover
                  class="img-no-error"
                >
              </picture>
            </Tooltip>

            <Tooltip placement="top" :content="currentLocalUploadedWallpaper?.name || ''" aspect-video>
              <!-- Upload wallpaper input -->
              <input
                ref="uploadWallpaperRef" type="file" accept="image/*"
                hidden
                @change="handleUploadWallpaper"
              >

              <picture
                class="group bew-settings-option--lift"
                :class="{ 'selected-wallpaper': getCurrentWallpaperUrl() === currentLocalUploadedWallpaper?.url }"
                aspect-video bg="$bew-fill-1" rounded="$bew-radius" overflow-hidden
                un-border="4 transparent" w-full
                flex="~ items-center justify-center"
                @click="handleLocalWallpaperClick"
              >
                <div
                  v-if="currentLocalUploadedWallpaper"
                  class="opacity-0 group-hover:opacity-100" duration-300
                  pos="absolute top-1 right-1" z-1 flex="~ gap-1"
                  :style="{ fontSize: 'var(--bew-font-size-control)', lineHeight: 'var(--bew-line-height-control)' }"
                >
                  <button
                    style="backdrop-filter: var(--bew-filter-glass-1);"
                    bg="$bew-content" rounded-full w-28px h-28px
                    grid place-items-center
                    @click.stop="triggerUploadWallpaper"
                  >
                    <i i-mingcute:edit-2-line />
                  </button>
                  <button
                    style="backdrop-filter: var(--bew-filter-glass-1);"
                    bg="$bew-content" rounded-full w-28px h-28px
                    grid place-items-center
                    @click.stop="handleRemoveCustomWallpaper"
                  >
                    <i i-mingcute:delete-2-line />
                  </button>
                </div>
                <div
                  v-if="!currentLocalUploadedWallpaper"
                  absolute w-full h-full grid place-items-center
                >
                  <div
                    i-tabler:photo-up
                    text="size-$bew-icon-size-xl $bew-text-3"
                  />
                </div>
                <img
                  v-else
                  :src="localWallpaperDisplayUrl || currentLocalUploadedWallpaper.url"
                  :alt="currentLocalUploadedWallpaper.name"
                  w-full h-full object-cover
                >
              </picture>
            </Tooltip>
          </div>
        </template>
      </SettingsItem>
      <SettingsItem v-else :title="$t('settings.image_url')">
        <template #bottom>
          <div flex items-center gap-4>
            <picture
              aspect-video bg="$bew-fill-1" rounded="$bew-radius" overflow-hidden
              un-border="4 transparent" cursor-pointer shrink-0
              w="xl:1/5 lg:1/4 md:1/3"
            >
              <img
                v-if="getCurrentWallpaperUrl()"
                :src="getCurrentWallpaperUrl()" alt="" loading="lazy"
                w-full h-full object-cover
                onerror="this.style.display='none'; this.onerror=null;"
              >
            </picture>
            <div>
              <Input v-if="isGlobal" v-model="settings.wallpaper" w-full />
              <Input v-else-if="isSearchPage" v-model="settings.searchPageWallpaper" w-full />
              <Input v-else v-model="settings.momentsPageWallpaper" w-full />
              <p color="sm $bew-text-3" mt-2>
                {{ $t('settings.image_url_hint') }}
              </p>
            </div>
          </div>
        </template>
      </SettingsItem>

      <SettingsItem :title="$t('settings.enable_wallpaper_masking')" right-width="auto">
        <template #desc>
          <span class="bew-warning-text">{{ $t('common.performance_impact_warn') }}</span>
        </template>

        <Radio v-if="isGlobal" v-model="settings.enableWallpaperMasking" />
        <Radio v-else-if="isSearchPage" v-model="settings.searchPageEnableWallpaperMasking" />
        <Radio v-else v-model="settings.momentsPageEnableWallpaperMasking" />
      </SettingsItem>
      <SettingsItem
        v-if="isGlobal ? settings.enableWallpaperMasking : (isSearchPage ? settings.searchPageEnableWallpaperMasking : settings.momentsPageEnableWallpaperMasking)"
        :title="$t('settings.wallpaper_mask_opacity')"
        right-width="auto"
      >
        <div class="slider-control">
          <Slider v-if="isGlobal" v-model="settings.wallpaperMaskOpacity" :label="`${settings.wallpaperMaskOpacity}%`" />
          <Slider v-else-if="isSearchPage" v-model="settings.searchPageWallpaperMaskOpacity" :label="`${settings.searchPageWallpaperMaskOpacity}%`" />
          <Slider v-else v-model="settings.momentsPageWallpaperMaskOpacity" :label="`${settings.momentsPageWallpaperMaskOpacity}%`" />
        </div>
      </SettingsItem>
      <SettingsItem
        v-if="isGlobal ? settings.enableWallpaperMasking : (isSearchPage ? settings.searchPageEnableWallpaperMasking : settings.momentsPageEnableWallpaperMasking)"
        :title="$t('settings.wallpaper_blur_intensity')"
        right-width="auto"
      >
        <div class="slider-control">
          <Slider v-if="isGlobal" v-model="settings.wallpaperBlurIntensity" :min="0" :max="60" :label="`${settings.wallpaperBlurIntensity}px`" />
          <Slider v-else-if="isSearchPage" v-model="settings.searchPageWallpaperBlurIntensity" :min="0" :max="60" :label="`${settings.searchPageWallpaperBlurIntensity}px`" />
          <Slider v-else v-model="settings.momentsPageWallpaperBlurIntensity" :min="0" :max="60" :label="`${settings.momentsPageWallpaperBlurIntensity}px`" />
        </div>
      </SettingsItem>
    </template>
  </SettingsItemGroup>
</template>

<style lang="scss" scoped>
.selected-wallpaper {
  --uno: "border-$bew-theme-color-60";
}

.slider-control {
  width: 220px;
}
</style>
