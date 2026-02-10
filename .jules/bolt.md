## 2024-05-23 - React Compiler and Refs
**Learning:** React Compiler treats `useCallback` manual memoization strictly. If a hook depends on a `ref.current` value inside, the compiler may skip optimization unless `.current` is explicitly listed in the dependency array (or the hook is suppressed), even though standard React hooks rules discourage it.
**Action:** When using `useCallback` with refs in a React Compiler environment, explicitly list `ref.current` in dependencies if the compiler complains about "inferred dependency", and suppress `react-hooks/exhaustive-deps` if necessary.
