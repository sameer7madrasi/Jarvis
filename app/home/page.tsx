import { ChatPage } from "@/components/chat/ChatPage";
import { anyProviderConfigured } from "@/lib/ai";
import { homePersona } from "@/lib/personas/home";

export const dynamic = "force-dynamic";

export default function JarvisHomePage() {
  return <ChatPage persona={homePersona} aiConfigured={anyProviderConfigured()} />;
}
