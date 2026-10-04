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

// Negative insets on these props shrink the touch area, which is legitimate
const TOUCH_AREA_KEYS = new Set(['hitSlop', 'pressRetentionOffset']);

const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/']);

// Negative numbers as strings, e.g. '-10%'
const NEGATIVE_STRING = /^\s*-\s*\.?\d/;
// A lone minus, which only counts in a template head followed by an
// expression, e.g. `-${x}%`
const MINUS_ONLY = /^\s*-\s*$/;

const getKeyName = (property) => {
    if (property.computed) return null;
    if (property.key.type === 'Identifier') return property.key.name;
    if (property.key.type === 'Literal') return String(property.key.value);
    return null;
};

// Nodes that pass a value on to the property, as opposed to e.g. calls,
// comparisons or functions, where a minus doesn't make the value negative
const passesValueThrough = (parent, child) =>
    (parent.type === 'ConditionalExpression' && parent.test !== child) ||
    (parent.type === 'BinaryExpression' &&
        ARITHMETIC_OPERATORS.has(parent.operator)) ||
    parent.type === 'LogicalExpression' ||
    parent.type === 'TSAsExpression' ||
    parent.type === 'TSSatisfiesExpression' ||
    parent.type === 'TSNonNullExpression';

// Walks up from a value through pass-through nodes and returns the node
// that receives it (e.g. a property) together with the received value
const findReceiver = (node) => {
    let child = node;
    let parent = node.parent;
    while (passesValueThrough(parent, child)) {
        child = parent;
        parent = parent.parent;
    }
    return { receiver: parent, value: child };
};

const isTouchAreaObject = (object) => {
    const { receiver, value } = findReceiver(object);
    if (receiver.type === 'JSXExpressionContainer') {
        return (
            receiver.parent.type === 'JSXAttribute' &&
            TOUCH_AREA_KEYS.has(receiver.parent.name.name)
        );
    }
    return (
        receiver.type === 'Property' &&
        receiver.value === value &&
        TOUCH_AREA_KEYS.has(getKeyName(receiver))
    );
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

        const checkNegativeValue = (node) => {
            const { receiver: property, value } = findReceiver(node);
            if (
                property.type !== 'Property' ||
                property.value !== value ||
                property.parent.type !== 'ObjectExpression' ||
                reported.has(property) ||
                !LAYOUT_OFFSET_KEYS.has(getKeyName(property)) ||
                isTouchAreaObject(property.parent)
            ) {
                return;
            }
            reported.add(property);
            // Report the property rather than the value, so a disable
            // comment above the key also works when the value wraps
            context.report({ node: property, messageId: 'negativeOffset' });
        };

        return {
            "UnaryExpression[operator='-']": checkNegativeValue,
            Literal(node) {
                if (
                    typeof node.value === 'string' &&
                    NEGATIVE_STRING.test(node.value)
                ) {
                    checkNegativeValue(node);
                }
            },
            TemplateLiteral(node) {
                const head = node.quasis[0].value.cooked;
                if (
                    NEGATIVE_STRING.test(head) ||
                    (node.expressions.length > 0 && MINUS_ONLY.test(head))
                ) {
                    checkNegativeValue(node);
                }
            }
        };
    }
};
