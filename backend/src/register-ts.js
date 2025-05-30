// Register TypeScript for runtime compilation
import { register } from 'ts-node';

register({
  transpileOnly: true,
  swc: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2022',
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true,
  },
});
