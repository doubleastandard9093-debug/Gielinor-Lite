// Lets the shared browser modules in ../js import 'three' and 'three/addons/...' from server/node_modules.
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const base = req.resolve('three').replace(/build[\\/]three\.cjs$/, '').replace(/build[\\/]three\.module\.js$/, '');
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: pathToFileURL(base + 'build/three.module.js').href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: pathToFileURL(base + 'examples/jsm/' + spec.slice(13)).href, shortCircuit: true };
  return next(spec, ctx);
}
