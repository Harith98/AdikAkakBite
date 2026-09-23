import "./globals.css";
export const metadata={title:"Dessert Business OS",description:"Small business operating dashboard"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="manifest" href="/manifest.json"/></head><body>{children}</body></html>}