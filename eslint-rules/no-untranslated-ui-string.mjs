/**
 * Flags user-facing text written straight into JSX instead of coming from the i18n layer:
 * text children, string-literal children such as {"Hi"}, and string literals on the attributes
 * people read or hear. Text with no letters (punctuation, numbers, whitespace, alt="") is fine.
 */
const LETTER = /\p{L}/u;
const USER_FACING_ATTRIBUTES = new Set(["aria-label", "alt", "title", "placeholder"]);
const MAX_SHOWN = 40;

/** The string literals an expression can evaluate to directly, including through ?: and &&/||. */
function literalStrings(node) {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? [{ node, text: node.value }] : [];
    case "TemplateLiteral":
      return node.expressions.length === 0 ? [{ node, text: node.quasis[0].value.cooked }] : [];
    case "ConditionalExpression":
      return [...literalStrings(node.consequent), ...literalStrings(node.alternate)];
    case "LogicalExpression":
      return [...literalStrings(node.left), ...literalStrings(node.right)];
    default:
      return [];
  }
}

function shown(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > MAX_SHOWN ? `${trimmed.slice(0, MAX_SHOWN)}…` : trimmed;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require user-facing JSX text and labels to come from the i18n layer",
    },
    schema: [],
    messages: {
      text: 'UI text "{{text}}" must come from the i18n layer: add it to both catalogues and use t("…").',
      attribute:
        '{{attribute}}="{{text}}" must come from the i18n layer: add it to both catalogues and use t("…").',
    },
  },
  create(context) {
    const reportText = (node, text) => {
      if (LETTER.test(text)) context.report({ node, messageId: "text", data: { text: shown(text) } });
    };

    return {
      JSXText(node) {
        if (!LETTER.test(node.value)) return;
        // Text often starts on the line after its tag; point at the words, not the whitespace.
        const start = context.sourceCode.getLocFromIndex(node.range[0] + node.value.search(/\S/));
        context.report({ loc: { start, end: node.loc.end }, messageId: "text", data: { text: shown(node.value) } });
      },
      JSXExpressionContainer(node) {
        if (node.parent.type !== "JSXElement" && node.parent.type !== "JSXFragment") return;
        for (const literal of literalStrings(node.expression)) reportText(literal.node, literal.text);
      },
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || !USER_FACING_ATTRIBUTES.has(node.name.name)) return;
        if (!node.value) return;
        const literals =
          node.value.type === "Literal"
            ? literalStrings(node.value)
            : node.value.type === "JSXExpressionContainer"
              ? literalStrings(node.value.expression)
              : [];
        for (const literal of literals) {
          if (!LETTER.test(literal.text)) continue;
          context.report({
            node: literal.node,
            messageId: "attribute",
            data: { attribute: node.name.name, text: shown(literal.text) },
          });
        }
      },
    };
  },
};

export default rule;
