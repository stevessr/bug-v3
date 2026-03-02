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
      type: Function as PropType<(input: string, option?: any) => boolean>,
      required: true
    }
  },
  setup(props) {
    return () => (
      <div class="user-settings-section">
        <div class="user-settings-section__title">分类偏好</div>
        <div class="user-settings-grid">
          <div class="user-settings-label">关注</div>
          <Select
            mode="multiple"
            size="small"
            class="user-settings-control"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.watched_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={value =>
              (props.form.value.watched_category_ids = (value || []) as number[])
            }
          />
          <div class="user-settings-label">追踪</div>
          <Select
            mode="multiple"
            size="small"
            class="user-settings-control"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.tracked_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={value =>
              (props.form.value.tracked_category_ids = (value || []) as number[])
            }
          />
          <div class="user-settings-label">关注首帖</div>
          <Select
            mode="multiple"
            size="small"
            class="user-settings-control"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.watched_first_post_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={value =>
              (props.form.value.watched_first_post_category_ids = (value || []) as number[])
            }
          />
          <div class="user-settings-label">静音</div>
          <Select
            mode="multiple"
            size="small"
            class="user-settings-control"
            placeholder="选择分类"
            options={props.categoryOptions}
            value={props.form.value.muted_category_ids}
            filterOption={props.filterCategoryOption}
            onUpdate:value={value =>
              (props.form.value.muted_category_ids = (value || []) as number[])
            }
          />
        </div>
      </div>
    )
  }
})
