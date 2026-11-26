import { buildApp } from './app';

buildApp().listen(4000, () => {
  process.stdout.write('API listening on port 4000\n');
});
