// Register TypeScript for runtime compilation
require('ts-node').register({
  transpileOnly: true,
  swc: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2022',
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true
  }
});