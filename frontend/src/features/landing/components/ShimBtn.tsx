import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

type ShimBtnProps = {
  label: string;
  href?: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * Primary action. The moving sheen is intentionally neutral: the product is
 * monochrome and pink is reserved for tiny status and focus details.
 */
export const ShimBtn = ({
  label,
  href,
  className = "",
  size = "md",
}: ShimBtnProps) => {
  const content = (
    <>
      <span className="relative z-10">{label}</span>
      <ArrowUpRight
        aria-hidden="true"
        size={15}
        strokeWidth={2}
        className="relative z-10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
      <motion.span
        aria-hidden="true"
        initial={{ x: "-160%", skewX: -18 }}
        animate={{ x: "260%" }}
        transition={{
          repeat: Infinity,
          duration: 1.1,
          delay: 2.4,
          repeatDelay: 3.2,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute inset-y-0 left-0 z-0 w-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent"
      />
    </>
  );

  const classes = `group relative inline-flex items-center justify-center gap-2 overflow-hidden bg-fg font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] ${
    size === "sm" ? "px-3.5 py-2 text-xs" : "px-5 py-3 text-sm"
  } ${className}`;

  if (href) {
    return (
      <motion.a
        href={href}
        whileTap={{ scale: 0.985 }}
        className={classes}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      className={classes}
    >
      {content}
    </motion.button>
  );
};
