import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
export async function generateMetadata():Promise<Metadata>{
  const requestHeaders=await headers();
  const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost:3000";
  const protocol=requestHeaders.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https");
  const origin=`${protocol}://${host}`;
  return {metadataBase:new URL(origin),title:{default:"Axion",template:"%s · Axion"},description:"Gestion des interventions terrain pour les équipes de maintenance.",applicationName:"Axion",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"Axion",statusBarStyle:"black-translucent"},openGraph:{type:"website",locale:"fr_FR",siteName:"Axion",title:"Axion — Les interventions terrain, enfin maîtrisées.",description:"Planifiez, suivez et clôturez vos interventions terrain.",images:[{url:`${origin}/og.png`,width:1731,height:909,alt:"Axion — Les interventions terrain, enfin maîtrisées."}]},twitter:{card:"summary_large_image",title:"Axion — Gestion des interventions",description:"Les interventions terrain, enfin maîtrisées.",images:[`${origin}/og.png`]}};
}
export const viewport:Viewport={themeColor:"#173f36",width:"device-width",initialScale:1,maximumScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
