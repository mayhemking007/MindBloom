import { motion } from "framer-motion";

interface BloomCTAProps {
  onBloom: () => void;
}

export function BloomCTA({ onBloom }: BloomCTAProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      onClick={onBloom}
      className="flex w-full items-center gap-3 rounded-bloom border border-purple-border bg-purple-bg px-4 py-3 text-left text-purple-text transition-colors duration-150 hover:bg-bloom-accent-bg"
    >
      <span className="relative h-7 w-7 shrink-0" aria-hidden="true">
        <span className="absolute left-2.5 top-0 h-2 w-2 rounded-full bg-purple-border" />
        <span className="absolute right-0 top-2.5 h-2 w-2 rounded-full bg-purple-border" />
        <span className="absolute bottom-0 left-2.5 h-2 w-2 rounded-full bg-purple-border" />
        <span className="absolute left-0 top-2.5 h-2 w-2 rounded-full bg-purple-border" />
      </span>
      <span>
        <span className="block text-[15px] font-medium leading-5">
          Bloom My Mind
        </span>
        <span className="block text-[11px] leading-4 text-bloom-text-tertiary">
          See your session, differently
        </span>
      </span>
    </motion.button>
  );
}
