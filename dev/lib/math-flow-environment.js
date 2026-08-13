/**
 * @import {Construct, Resolver, State, TokenizeContext, Tokenizer} from 'micromark-util-types'
 */

import {ok as assert} from 'devlop'
import {factorySpace} from 'micromark-factory-space'
import {markdownLineEnding, markdownSpace} from 'micromark-util-character'
import {codes, types} from 'micromark-util-symbol'
import {nonLazyContinuation} from './math-flow.js'

/** @type {Construct} */
export const mathFlowEnvironment = {
  tokenize: tokenizeMathFlowEnvironment,
  resolve: resolveMathFlowEnvironment,
  concrete: true,
  name: 'mathFlow'
}

/**
 * Include the opening backslash in the first value token.  The backslash is
 * also the non-empty fence that tells existing math handlers when to start
 * collecting flow value.
 *
 * @type {Resolver}
 */
function resolveMathFlowEnvironment(events) {
  const fence = events.find(
    (event) => event[0] === 'enter' && event[1].type === 'mathFlowFence'
  )
  const value = events.find(
    (event) => event[0] === 'enter' && event[1].type === 'mathFlowValue'
  )

  assert(fence, 'expected environment fence')
  assert(value, 'expected environment value')
  value[1].start = {...fence[1].start}
  return events
}

/**
 * Tokenize flow math delimited by matching LaTeX environments.
 *
 * The complete environment is emitted as `mathFlowValue`, including its
 * opening and closing commands.  This preserves environment semantics for
 * renderers and syntax-tree consumers while still using the standard math
 * token names.
 *
 * @this {TokenizeContext}
 * @type {Tokenizer}
 */
function tokenizeMathFlowEnvironment(effects, ok, nok) {
  const self = this
  const tail = self.events[self.events.length - 1]
  const initialSize =
    tail && tail[1].type === types.linePrefix
      ? tail[2].sliceSerialize(tail[1], true).length
      : 0
  /** @type {Array<string>} */
  const stack = []
  let command = 'begin'
  let commandIndex = 0
  let environmentName = ''
  let opening = true

  return start

  /** @type {State} */
  function start(code) {
    assert(code === codes.backslash, 'expected `\\`')
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.consume(code)
    effects.exit('mathFlowFence')
    effects.enter('mathFlowValue')
    return commandCharacter
  }

  /** @type {State} */
  function commandCharacter(code) {
    if (commandIndex < command.length) {
      if (code !== command.codePointAt(commandIndex)) {
        return opening ? nok(code) : value(code)
      }

      effects.consume(code)
      commandIndex++
      return commandCharacter
    }

    if (markdownSpace(code)) {
      effects.consume(code)
      return commandCharacter
    }

    if (code !== codes.leftCurlyBrace) {
      return opening ? nok(code) : value(code)
    }

    effects.consume(code)
    environmentName = ''
    return environmentNameInside
  }

  /** @type {State} */
  function environmentNameInside(code) {
    if (code === codes.rightCurlyBrace) {
      if (environmentName.length === 0) {
        effects.consume(code)
        return opening ? nok : value
      }

      effects.consume(code)
      return afterEnvironmentName
    }

    if (
      code === codes.eof ||
      code === codes.leftCurlyBrace ||
      markdownLineEnding(code) ||
      markdownSpace(code)
    ) {
      return opening ? nok(code) : value(code)
    }

    assert(code >= 0, 'expected character in environment name')
    environmentName += String.fromCodePoint(code)
    effects.consume(code)
    return environmentNameInside
  }

  /** @type {State} */
  function afterEnvironmentName(code) {
    if (opening) {
      stack.push(environmentName)
      opening = false
      return value(code)
    }

    if (command === 'begin') {
      stack.push(environmentName)
      return value(code)
    }

    if (environmentName !== stack[stack.length - 1]) {
      return value(code)
    }

    if (stack.length > 1) {
      stack.pop()
      return value(code)
    }

    return afterClose(code)
  }

  /** @type {State} */
  function afterClose(code) {
    if (markdownSpace(code)) {
      effects.consume(code)
      return afterClose
    }

    if (code === codes.eof || markdownLineEnding(code)) {
      stack.pop()
      effects.exit('mathFlowValue')
      effects.exit('mathFlow')
      return ok(code)
    }

    return value(code)
  }

  /** @type {State} */
  function beforeContent(code) {
    if (code === codes.eof) {
      return nok(code)
    }

    if (markdownLineEnding(code)) {
      return effects.attempt(nonLazyContinuation, contentStart, nok)(code)
    }

    effects.enter('mathFlowValue')
    return value(code)
  }

  /** @type {State} */
  function contentStart(code) {
    return (
      initialSize
        ? factorySpace(
            effects,
            beforeContent,
            types.linePrefix,
            initialSize + 1
          )
        : beforeContent
    )(code)
  }

  /** @type {State} */
  function value(code) {
    if (code === codes.eof) {
      effects.exit('mathFlowValue')
      return nok(code)
    }

    if (markdownLineEnding(code)) {
      effects.exit('mathFlowValue')
      return effects.attempt(nonLazyContinuation, contentStart, nok)(code)
    }

    if (code === codes.percentSign) {
      effects.consume(code)
      return comment
    }

    if (code === codes.backslash) {
      effects.consume(code)
      return afterBackslash
    }

    effects.consume(code)
    return value
  }

  /** @type {State} */
  function afterBackslash(code) {
    if (code === codes.backslash) {
      effects.consume(code)
      return value
    }

    if (code === codes.lowercaseB || code === codes.lowercaseE) {
      command = code === codes.lowercaseB ? 'begin' : 'end'
      commandIndex = 0
      return commandCharacter(code)
    }

    return value(code)
  }

  /** @type {State} */
  function comment(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return value(code)
    }

    effects.consume(code)
    return comment
  }
}
