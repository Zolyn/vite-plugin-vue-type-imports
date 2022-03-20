module.exports = {
    root: true,
    extends: ['alloy-patched', 'plugin:prettier/recommended'],
    env: {
        jest: true,
    },
    plugins: ['jest'],
    globals: {},
    // rules: {
    //     'no-console': 'off',
    //     'no-use-before-define': 'off',
    //     'no-param-reassign': 'off',
    // },
};
