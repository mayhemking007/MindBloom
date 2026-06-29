import { motion } from "framer-motion";
import type { TopicPill } from "@mindbloom/shared";

import { colorClasses, getColorForTopic } from "../../lib/topicColors";

interface TopicPillsProps {
  topics: TopicPill[];
}

export function TopicPills({ topics }: TopicPillsProps) {
  if (topics.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.07,
          },
        },
      }}
      className="bloom-scrollbar -mx-4 overflow-x-auto px-4 pb-1"
    >
      <div className="flex gap-2">
        {topics.map((topic) => {
          const color = colorClasses[getColorForTopic(topic.label)];

          return (
            <motion.div
              key={topic.id}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0 },
              }}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] leading-none",
                color.bg,
                color.border,
                color.text,
              ].join(" ")}
            >
              <span className={["h-1.5 w-1.5 rounded-full", color.dot].join(" ")} />
              <span>{topic.label}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
