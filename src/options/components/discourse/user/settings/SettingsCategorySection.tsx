import { defineComponent } from 'vue'
import type { PropType, Ref } from 'vue'
import { Select } from 'ant-design-vue'

import type { CategoryOption, PreferencesPayload } from './types'

export default defineComponent({
  name: 'SettingsCategorySection',
  props: {
    form: {
      type: Object as PropType<Ref<PreferencesPayload>>,
      required: true
    },
    categoryOptions: {
      type: Array as PropType<CategoryOption[]>,
      required: true
    },
    filterCategoryOption: {
      type: Function as PropType<
        (input: string, option?: { label?: string; value?: number; slug?: string }) => boolean
      >,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
        <div class="text-xs font-semibold text-gray-400 mb-2">分类偏好</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
          <div class="text-gray-500">关注</div>
          <Select
            mode="multiple"
            size="small"
            class="w-full"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.watched_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={(value: number[]) =>
              (props.form.value.watched_category_ids = value || [])
            }
          />
          <div class="text-gray-500">追踪</div>
          <Select
            mode="multiple"
            size="small"
            class="w-full"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.tracked_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={(value: number[]) =>
              (props.form.value.tracked_category_ids = value || [])
            }
          />
          <div class="text-gray-500">关注首帖</div>
          <Select
            mode="multiple"
            size="small"
            class="w-full"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.watched_first_post_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={(value: number[]) =>
              (props.form.value.watched_first_post_category_ids = value || [])
            }
          />
          <div class="text-gray-500">静音</div>
          <Select
            mode="multiple"
            size="small"
            class="w-full"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.muted_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={(value: number[]) =>
              (props.form.value.muted_category_ids = value || [])
            }
          />
        </div>
      </div>
    )
  }
})
