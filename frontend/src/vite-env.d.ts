/// <reference types="vite/client" />

import 'react';

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly REACT_APP_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'react' {
  function forwardRef<T, P = any>(
    render: (props: P, ref: ForwardedRef<T>) => ReactNode
  ): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
}