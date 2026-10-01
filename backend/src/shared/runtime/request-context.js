import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage();
export const currentRuntime = () => context.getStore();
export const withRuntime = (runtime, operation) => context.run(runtime, operation);
