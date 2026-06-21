// Vite imports .dax query files as raw strings via the `?raw` suffix.
declare module '*.dax?raw' {
  const content: string;
  export default content;
}
