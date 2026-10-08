import type { Metadata } from "next";
import { Chat } from "./_components/chat";

export const metadata: Metadata = { title: "الشات" };

// محادثة جديدة: المعرّف ينولد في المتصفح مع أول رسالة
export default function NewChatPage() {
  return <Chat id={null} initialMessages={[]} />;
}
