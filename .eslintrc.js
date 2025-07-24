module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: './tsconfig.json',
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['dist/**', 'node_modules/**', 'gulpfile.js', '*.js'],
	rules: {
		'no-console': 'warn',
		'prefer-const': 'error',
		'no-var': 'error',
	},
};
