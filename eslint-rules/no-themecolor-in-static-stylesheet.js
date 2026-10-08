// Disallows themeColor() inside a StyleSheet.create() call that runs at
// module scope. Such a style sheet is built once when the module loads, so
// its colors stay on the theme that was active at that time. Styles that use
// themeColor() must be built inside a component or function (e.g. a
// getStyles() helper or an inline style object) so they follow theme changes.

const FUNCTION_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression'
]);

const isStyleSheetCreate = (node) => {
    if (node.type !== 'CallExpression') return false;
    const callee = node.callee;
    if (
        callee.type !== 'MemberExpression' ||
        callee.computed ||
        callee.property.type !== 'Identifier' ||
        callee.property.name !== 'create'
    ) {
        return false;
    }
    const object = callee.object;
    return (
        (object.type === 'Identifier' && object.name === 'StyleSheet') ||
        (object.type === 'MemberExpression' &&
            !object.computed &&
            object.property.type === 'Identifier' &&
            object.property.name === 'StyleSheet')
    );
};

// Class instance fields are evaluated per instance, like a constructor body
const isInstanceField = (node) =>
    (node.type === 'PropertyDefinition' || node.type === 'ClassProperty') &&
    !node.static;

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow themeColor() inside a module-level StyleSheet.create()'
        },
        messages: {
            themeColorInStaticStyleSheet:
                'Do not call themeColor() inside a module-level StyleSheet.create(); the color will not update when the theme changes. Move the style into the component or a function that builds the styles.'
        },
        schema: []
    },
    create(context) {
        return {
            "CallExpression[callee.type='Identifier'][callee.name='themeColor']"(
                node
            ) {
                let child = node;
                let parent = node.parent;
                let inStyleSheet = false;
                while (parent) {
                    if (FUNCTION_TYPES.has(parent.type)) return;
                    if (isInstanceField(parent) && parent.value === child) {
                        return;
                    }
                    if (
                        isStyleSheetCreate(parent) &&
                        parent.arguments.includes(child)
                    ) {
                        inStyleSheet = true;
                    }
                    child = parent;
                    parent = parent.parent;
                }
                if (inStyleSheet) {
                    context.report({
                        node,
                        messageId: 'themeColorInStaticStyleSheet'
                    });
                }
            }
        };
    }
};
