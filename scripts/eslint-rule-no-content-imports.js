#!/usr/bin/env node
// ESLint rule to prevent imports from content.js files

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent imports from content.js files',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const importPath = node.source.value
        if (typeof importPath === 'string' && importPath.includes('content')) {
          // Check if importing from a content.js file or content directory
          if (importPath.includes('content.js') || importPath.includes('/content/')) {
            context.report({
              node,
              message: 'Importing from content.js or content directory is not allowed',
            })
          }
        }
      },
      
      CallExpression(node) {
        // Check dynamic imports
        if (
          node.callee.type === 'Import' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal'
        ) {
          const importPath = node.arguments[0].value
          if (typeof importPath === 'string' && 
              (importPath.includes('content.js') || importPath.includes('/content/'))) {
            context.report({
              node,
              message: 'Dynamic imports from content.js or content directory are not allowed',
            })
          }
        }
      }
    }
  }
}