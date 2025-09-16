module.exports = {
	root: true,
	plugins: ['@typescript-eslint', 'n8n-nodes-base'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	ignorePatterns: [
		'dist/**',
		'node_modules/**',
		'nodes/**',
		'credentials/**',
		'gulpfile.js',
		'index.js',
	],
	overrides: [
		// TypeScript files
		{
			files: ['src/**/*.ts'],
			parser: '@typescript-eslint/parser',
			parserOptions: {
				project: './tsconfig.json',
				ecmaVersion: 2020,
				sourceType: 'module',
			},
			rules: {
				'@typescript-eslint/no-explicit-any': 'off',
			},
		},
		// JavaScript config/build files
		{
			files: ['**/*.js'],
			parser: 'espree',
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
			},
			env: { node: true },
			rules: {},
		},
	],
	rules: {
		'no-console': 'warn',
		'prefer-const': 'error',
		'no-var': 'error',
	},
};
