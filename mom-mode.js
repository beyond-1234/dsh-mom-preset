/**
 * mom-mode — the agent-plane half of 妈妈模式 (mom mode), and the bundle
 * package's root entry (`exports["."]`).
 *
 * It sits at the REPOSITORY ROOT on purpose: the preset's `mom-mode` row names
 * the bundle package itself (`dsh-mom-preset`) rather than a path, because a
 * preset child does not inherit this patch's resolution base. That makes this
 * file the package's entry, so it needs no package of its own — which is why
 * the old `dsh-mom-mode/` directory (and its `"type": "module"` stub manifest,
 * now redundant beside the root's) is gone.
 *
 * One job: register the behavioural policy as a stable system-prompt section
 * (`mom:policy`, default order 1, immediately after the deployment persona
 * prefix at order 0). Stable ON PURPOSE — a system-prompt section whose text
 * changes from turn to turn invalidates the provider's prefix cache from the
 * first changed token.
 *
 * This plugin used to have a second job: an `agent/pre-step` listener that
 * appended a rotating "affirmation" user message every turn, chosen from a
 * mood table by matching keywords in the user's own words. That whole layer is
 * gone. It was the source of two problems that no amount of tuning fixed:
 *
 *   - the lines were CANNED, so a session that ran long started repeating
 *     itself, and the assistant mirrored their register back ("我在这儿呢，
 *     你说。") instead of saying anything;
 *   - "全肯定" as a mechanism says nothing the policy does not already say
 *     better. Warmth belongs in how the reply is written, not in a slogan
 *     appended to the conversation.
 *
 * Removing it also removed everything built to support it: the mood table, the
 * keyword classifier, the FNV-1a rotation, the notice-summary bound, and the
 * third copy of the mood table that lived in the browser bundle purely so the
 * composer banner could predict the injected line.
 *
 * Zero runtime dependencies, deliberately. The Loader imports this file by the
 * bundle's bare package name out of the PROFILE directory, and Node's upward
 * `node_modules` walk from there reaches neither the repository nor the
 * harness's own packages, so nothing here may import one.
 */

/** Cordis plugin name. */
export const name = 'mom-mode'

/** The prompt registry owns section registration; that is all this needs. */
export const inject = ['systemPrompt']

/** The section name this plugin registers; one entry per name per scope layer. */
export const POLICY_SECTION = 'mom:policy'

/**
 * Fallback behavioural policy, used only when the mounting row supplies no
 * `policy` config.
 *
 * The 妈妈 preset DOES supply one — the full, tuned voice lives in this
 * bundle's `cordis.patch.yml`, on the `mom-mode` row's `config.policy`,
 * because that declaration is what the roster stamps for a new generation:
 * editing it reaches the next session after a host restart, while editing this
 * module would also need one (the Loader caches the module and nothing watches
 * plugin sources). Keep this fallback short and in the same voice; it is a
 * safety net, not the tuned text.
 *
 * The last sentence is load-bearing: warmth without it degrades into flattery,
 * and a flattering agent hides errors.
 */
export const DEFAULT_POLICY = `你是妈妈。他写代码，你在旁边陪着他。
说话像平时在家讲话那样，把话讲完整，语气软一点，别端着。活儿还是干得稳的。
别把一句人话压成一个词组，也别追求"简洁干练"——能说"我替你看看"就别只丢一个"查"。

他一说难处、说做砸了，先接住人再说事，像"哎哟，辛苦了""来，妈妈看看"这样开口。
别拿"不对""不行""你错了"开头；想拦他，就说实话，再给一条别的路。

他难受的时候叫他"孩子"，冷冰冰的时候叫"宝宝"，平常说"你"。一段里带一两声就够。
不确定就说不确定，别拿术语糊他，也别把话说得像写文档，"约定"这种家常词就够了。
怎么一步步试出来的、当时看到的是什么、为什么会这样，这几样都别省。
一件事说完就说完了，别在末尾再接一句把话头递回去的问句。
实在没话可说，就说点刚查到的、下一步打算怎么弄。

有件事妈妈不做：不拣好听的哄他。真出了岔子、真看走眼了、真有风险，妈妈照样说明白。`

/**
 * Register the policy section.
 * @param ctx - the preset's standing agent scope context.
 * @param config - optional overrides; both fields have working defaults.
 */
export function apply(ctx, config = {}) {
  const policy = typeof config.policy === 'string' ? config.policy : DEFAULT_POLICY
  const policyOrder = Number.isFinite(config.policyOrder) ? config.policyOrder : 1

  if (policy.length > 0) {
    ctx.systemPrompt.section({ name: POLICY_SECTION, order: policyOrder, text: policy })
  }
}
