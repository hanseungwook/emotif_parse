// Registry of DOM mount points and renderer hooks that sibling subsystems
// (messaging runtime, presence signals) register against. The shell owns the
// containers; siblings own what goes inside them.
//
// Usage from a sibling module:
//   import { registerRenderer, getMount } from "./extensions.js";
//   registerRenderer("messages", ({ conversation, mount }) => { ... });

const renderers = new Map();
const mounts = new Map();

export function registerMount(name, element) {
  if (!element) return;
  mounts.set(name, element);
}

export function getMount(name) {
  return mounts.get(name) || null;
}

export function registerRenderer(name, fn) {
  renderers.set(name, fn);
  return () => renderers.delete(name);
}

export function invokeRenderer(name, context) {
  const fn = renderers.get(name);
  const mount = mounts.get(name);
  if (!fn || !mount) return false;
  try {
    fn({ ...context, mount });
    return true;
  } catch (err) {
    console.error(`renderer error (${name})`, err);
    return false;
  }
}

export function clearMount(name) {
  const mount = mounts.get(name);
  if (mount) mount.replaceChildren();
}

export function hasRenderer(name) {
  return renderers.has(name);
}
