// Next.js exige que o middleware esteja em middleware.ts na raiz do projeto.
// A lógica de auth fica em proxy.ts para manter separação de responsabilidades.
export { proxy as default, config } from './proxy'
