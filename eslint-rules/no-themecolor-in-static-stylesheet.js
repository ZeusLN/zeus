// Disallows themeColor() inside a StyleSheet.create() call that runs at
// module scope. Such a style sheet is built once when the module loads, so
// its colors stay on the theme that was active at that time. Styles that use
// themeColor() must be built inside a component or function (e.g. a
// getStyles() helper or an inline style object) so they follow theme changes.
// placeholderColor() and getUpgradeBackgroundColor() call themeColor(), so
// they are checked too.

const FUNCTION_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression'
]);

const THEME_FUNCTIONS = [
    'themeColor',
    'placeholderColor',
    'getUpgradeBackgroundColor'
];

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

// Array methods that call their callback before returning
const ITERATION_METHODS = new Set([
    'map',
    'flatMap',
    'forEach',
    'filter',
    'reduce',
    'reduceRight',
    'find',
    'findIndex',
    'some',
    'every'
]);

const memberName = (node) =>
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
        ? node.property.name
        : null;

// themeColor(...) or a namespace call such as ThemeUtils.themeColor(...)
const themeFunctionName = (callee) => {
    const name =
        callee.type === 'Identifier' ? callee.name : memberName(callee);
    return THEME_FUNCTIONS.includes(name) ? name : null;
};

// A function runs where it is defined when it is called in place, e.g.
// (() => ...)(), (function () {}).call(this) or keys.map((k) => ...)
const runsImmediately = (fn) => {
    const parent = fn.parent;
    if (parent.type === 'CallExpression') {
        if (parent.callee === fn) return true;
        if (!parent.arguments.includes(fn)) return false;
        const method = memberName(parent.callee);
        if (ITERATION_METHODS.has(method)) return true;
        return (
            method === 'from' &&
            parent.callee.object.type === 'Identifier' &&
            parent.callee.object.name === 'Array'
        );
    }
    const method = memberName(parent);
    return (
        parent.object === fn &&
        (method === 'call' || method === 'apply') &&
        parent.parent.type === 'CallExpression' &&
        parent.parent.callee === parent
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
                'Do not call {{name}}() inside a module-level StyleSheet.create(); the color will not update when the theme changes. Move the style into the component or a function that builds the styles.'
        },
        schema: []
    },
    create(context) {
        return {
            CallExpression(node) {
                const name = themeFunctionName(node.callee);
                if (!name) return;
                let child = node;
                let parent = node.parent;
                let inStyleSheet = false;
                while (parent) {
                    // A function or instance field only defers the call when
                    // it wraps the StyleSheet.create() call. One inside the
                    // create() arguments (a map callback or an IIFE) runs
                    // while the sheet is built, and so does a wrapper that is
                    // called in place.
                    if (
                        inStyleSheet &&
                        FUNCTION_TYPES.has(parent.type) &&
                        !runsImmediately(parent)
                    ) {
                        return;
                    }
                    if (
                        inStyleSheet &&
                        isInstanceField(parent) &&
                        parent.value === child
                    ) {
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
                        messageId: 'themeColorInStaticStyleSheet',
                        data: { name }
                    });
                }
            }
        };
    }
};
