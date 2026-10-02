// Disallows negative margin/position values. They are usually layout hacks
// that compensate for spacing elsewhere and break when that spacing changes
// (see https://github.com/ZeusLN/zeus/issues/2794).
// Intentional offsets (e.g. overlapping avatars) must be disabled inline
// with a reason.

const LAYOUT_OFFSET_KEYS = new Set([
    'margin',
    'marginTop',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'marginHorizontal',
    'marginVertical',
    'marginStart',
    'marginEnd',
    'marginBlock',
    'marginBlockStart',
    'marginBlockEnd',
    'marginInline',
    'marginInlineStart',
    'marginInlineEnd',
    'top',
    'bottom',
    'left',
    'right',
    'start',
    'end',
    'inset',
    'insetBlock',
    'insetBlockStart',
    'insetBlockEnd',
    'insetInline',
    'insetInlineStart',
    'insetInlineEnd'
]);

const getKeyName = (property) => {
    if (property.computed) return null;
    if (property.key.type === 'Identifier') return property.key.name;
    if (property.key.type === 'Literal') return String(property.key.value);
    return null;
};

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow negative margin/position values'
        },
        messages: {
            negativeOffset:
                'Avoid negative margin/position values; fix the spacing at its source instead (see #2794). If the offset is intentional, disable this rule for the line and give a reason.'
        },
        schema: []
    },
    create(context) {
        const reported = new Set();
        return {
            "UnaryExpression[operator='-']"(node) {
                // Attribute the minus to the closest enclosing object
                // property, so ternaries and expressions are covered too
                const property = context.sourceCode
                    .getAncestors(node)
                    .findLast((ancestor) => ancestor.type === 'Property');
                if (
                    !property ||
                    reported.has(property) ||
                    property.parent.type !== 'ObjectExpression' ||
                    !LAYOUT_OFFSET_KEYS.has(getKeyName(property))
                ) {
                    return;
                }
                reported.add(property);
                // Report the property rather than the minus, so a disable
                // comment above the key also works when the value wraps
                context.report({
                    node: property,
                    messageId: 'negativeOffset'
                });
            }
        };
    }
};
