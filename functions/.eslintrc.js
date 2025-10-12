module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.eslint.json'],
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {
        // point the resolver at the TS config for ESLint so it can resolve JS/TS files during linting
        project: ['tsconfig.eslint.json'],
      },
    },
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
    'src/**/*.js', // ignore JS files so TypeScript project parsing doesn't error
  ],
  plugins: [
    '@typescript-eslint',
    'import',
  ],
  rules: {
    'quotes': ['error', 'single'], // 작은따옴표 허용(큰따움표 'double')
    'object-curly-spacing': ['error', 'always'], // { foo } 허용
    'linebreak-style': 'off', // CRLF/LF 차이 무시
    'max-len': 'off', // 줄 길이 제한 해제
    'require-jsdoc': 'off', // JSDoc 강제 해제
    'valid-jsdoc': 'off', // JSDoc 강제 해제
    // Use TypeScript-aware rules instead of the base rule
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }], // console.warn/error allowed
    '@typescript-eslint/no-explicit-any': 'warn', // discourage any
    'operator-linebreak': 'off', // 연산자 줄바꿈 무시
    'new-cap': 'off', // 생성자 함수 대문자 강제 해제
    'import/extensions': 0, // import 확장자명 강제 해제
    // Allow the TypeScript resolver to handle module resolution; if it still fails, lower to warn
    'import/no-unresolved': ['warn', { commonjs: true, caseSensitive: false }],
    'indent': ['error', 2], // 2칸 들여쓰기 허용
  },
};
