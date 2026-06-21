import { motion } from "framer-motion";

import type { ChatMessage } from "../../lib/chatStorage";

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={isUser ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={[
          "max-w-[82%] rounded-bloom px-4 py-3 text-[15px] leading-6",
          isUser
            ? "bg-bloom-accent text-bloom-on-accent"
            : "border border-bloom-border bg-bloom-surface text-bloom-text-primary",
        ].join(" ")}
      >
        {message.content}
      </div>
    </motion.div>
  );
}
