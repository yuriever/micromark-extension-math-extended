/**
 * @import {Options} from 'micromark-extension-math-extended'
 * @import {Extension} from 'micromark-util-types'
 */

import {codes} from 'micromark-util-symbol'
import {mathFlowDollar, mathFlowBackslash} from './math-flow.js'
import {mathFlowEnvironment} from './math-flow-environment.js'
import {mathText} from './math-text.js'

/**
 * Create an extension for `micromark` to enable math syntax.
 *
 * @param {Options | null | undefined} [options={}]
 *   Configuration (default: `{}`).
 * @returns {Extension}
 *   Extension for `micromark` that can be passed in `extensions`, to
 *   enable math syntax.
 */
export function math(options) {
  const textConstructs = mathText(options)
  const backslash = options?.backslashDelimiters !== false
  const environments = options?.processEnvironments !== false
  const backslashFlow = [
    ...(backslash ? [mathFlowBackslash] : []),
    ...(environments ? [mathFlowEnvironment] : [])
  ]

  return {
    flow: {
      [codes.dollarSign]: mathFlowDollar,
      ...(backslashFlow.length > 0 ? {[codes.backslash]: backslashFlow} : {})
    },
    text: {
      [codes.dollarSign]: textConstructs.dollar,
      ...(backslash ? {[codes.backslash]: textConstructs.backslash} : {})
    }
  }
}
