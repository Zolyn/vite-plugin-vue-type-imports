module.exports = {
    root: true,
    extends: ['alloy', 'alloy/typescript', 'plugin:prettier/recommended'],
    env: {
        node: true,
        browser: true,
        commonjs: true,
        jest: true,
    },
    plugins: ['jest'],
    globals: {},
    rules: {
        'no-console': 'off',
        'no-use-before-define': 'off'
    },
};
