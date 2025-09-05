import { logger } from '../config/buildFLagsV2'

//import { initPixiv } from './pixiv'
import { initBilibili } from './bilibili'
import { initX } from './x'

export function Uninject() {
  try {
    //initPixiv() //for bad
  } catch (e) {
    logger.error('[OneClickAdd] initPixiv failed', e)
  }

  try {
    initBilibili()
  } catch (e) {
    logger.error('[OneClickAdd] initBilibili failed', e)
  }

  try {
    initX()
  } catch (e) {
    logger.error('[OneClickAdd] initX failed', e)
  }
}
