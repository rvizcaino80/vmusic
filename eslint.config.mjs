import pluginVue from 'eslint-plugin-vue'
import stylisticJs from '@stylistic/eslint-plugin-js'

export default [
  ...pluginVue.configs['flat/recommended'],
  {
    plugins: {
      '@stylistic/js': stylisticJs
    },
    ignores: ['src/components/widgets/drawers/drawProfile.vue'],
    files: ['src/**/*.js', 'src/**/*.vue', 'src/**/*.html'],
    rules: {
      "vue/first-attribute-linebreak": ["error", {
        "singleline": "ignore",
        "multiline": "below"
      }],
      "vue/max-attributes-per-line": ["error", {
        "singleline": {
          "max": 1
        },
        "multiline": {
          "max": 1
        }
      }],
      '@stylistic/js/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/js/array-bracket-spacing': ['error', 'never'],
      '@stylistic/js/array-element-newline': ['error', 'consistent'],
      '@stylistic/js/arrow-parens': ['error', 'always'],
      '@stylistic/js/arrow-spacing': 'error',
      '@stylistic/js/block-spacing': 'error',
      '@stylistic/js/brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
      '@stylistic/js/comma-dangle': ["error", "never"],
      '@stylistic/js/comma-spacing': ['error', { 'before': false, 'after': true }],
      '@stylistic/js/comma-style': ["error", "last"],
      '@stylistic/js/computed-property-spacing': ["error", "never"],
      '@stylistic/js/dot-location': ["error", "property"],
      '@stylistic/js/eol-last': ["error", "always"],
      '@stylistic/js/function-call-argument-newline': ["error", "consistent"],
      '@stylistic/js/function-call-spacing': ["error", "never"],
      '@stylistic/js/function-paren-newline': ["error", { "minItems": 8 }],
      '@stylistic/js/implicit-arrow-linebreak': ["error", "beside"],
      '@stylistic/js/indent': ['error', 2],
      '@stylistic/js/key-spacing': ["error", { "beforeColon": false, "afterColon": true, "mode": 'strict' }],
      '@stylistic/js/keyword-spacing': ["error", { "before": true, "after": true }],
      '@stylistic/js/linebreak-style': ["error", "unix"],
      '@stylistic/js/lines-around-comment': ["error", { "beforeBlockComment": true, "beforeLineComment": true, "allowBlockStart": true, "allowClassStart": true }],
      '@stylistic/js/lines-between-class-members': ["error", "always"],
      '@stylistic/js/multiline-comment-style': ["error", "starred-block"],
      '@stylistic/js/multiline-ternary': ["error", "always-multiline"],
      '@stylistic/js/new-parens': "error",
      '@stylistic/js/newline-per-chained-call': ["error", { "ignoreChainWithDepth": 2 }],
      '@stylistic/js/no-extra-semi': "error",
      '@stylistic/js/no-floating-decimal': "error",
      '@stylistic/js/no-mixed-spaces-and-tabs': "error",
      '@stylistic/js/no-multi-spaces': "error",
      '@stylistic/js/no-multiple-empty-lines': "error",
      '@stylistic/js/no-tabs': ["error"],
      '@stylistic/js/no-trailing-spaces': "error",
      '@stylistic/js/no-whitespace-before-property': "error",
      '@stylistic/js/nonblock-statement-body-position': ["error", "beside"],
      '@stylistic/js/object-curly-spacing': ["error", "always"],
      '@stylistic/js/one-var-declaration-per-line': ["error", "always"],
      '@stylistic/js/operator-linebreak': ["error", "none"],
      '@stylistic/js/padded-blocks': ["error", { "blocks": "never" }],
      '@stylistic/js/padding-line-between-statements': ["error", { blankLine: "always", prev: "*", next: "return" }],
      '@stylistic/js/quotes': ['error', 'single', { 'allowTemplateLiterals': true, 'avoidEscape': true }],
      '@stylistic/js/rest-spread-spacing': ["error", "never"],
      '@stylistic/js/semi': ['error', 'never'],
      '@stylistic/js/semi-spacing': "error",
      '@stylistic/js/semi-style': ["error", "last"],
      '@stylistic/js/space-before-blocks': "error",
      '@stylistic/js/space-before-function-paren': ["error", "never"],
      '@stylistic/js/space-in-parens': ["error", "never"],
      '@stylistic/js/space-infix-ops': "error",
      '@stylistic/js/space-unary-ops': "error",
      '@stylistic/js/spaced-comment': ["error", "always"],
      '@stylistic/js/switch-colon-spacing': "error",
      '@stylistic/js/template-curly-spacing': "error",
      '@stylistic/js/template-tag-spacing': "error",
      '@stylistic/js/wrap-iife': ["error", "any"],
      '@stylistic/js/wrap-regex': "error"
    }
  }
]