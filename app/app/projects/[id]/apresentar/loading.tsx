/** Enquanto a rota carrega: tela escura (evita o flash claro entre o editor e a apresentação). */
export default function Carregando() {
  return <div className="h-dvh w-full bg-[#111]" aria-busy="true" />
}
