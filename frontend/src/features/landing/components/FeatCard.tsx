import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";

type FeatCardProps = {
  index: string;
  title: string;
  description: string;
  illustration: ReactNode;
};

const tiltSpring = { stiffness: 240, damping: 24, mass: 0.6 };

/**
 * The card follows the pointer only while hovered. Touch input and reduced
 * motion keep the flat, static treatment so the effect never fights a user.
 */
export const FeatCard = ({
  index,
  title,
  description,
  illustration,
}: FeatCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const normalizedX = useMotionValue(0.5);
  const normalizedY = useMotionValue(0.5);
  const glareX = useMotionValue(0);
  const glareY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(normalizedY, [0, 1], [7, -7]),
    tiltSpring,
  );
  const rotateY = useSpring(
    useTransform(normalizedX, [0, 1], [-9, 9]),
    tiltSpring,
  );
  const glare = useMotionTemplate`radial-gradient(260px circle at ${glareX}px ${glareY}px, rgba(255,255,255,0.075), transparent 62%)`;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse" || !cardRef.current) {
      return;
    }

    const bounds = cardRef.current.getBoundingClientRect();
    normalizedX.set((event.clientX - bounds.left) / bounds.width);
    normalizedY.set((event.clientY - bounds.top) / bounds.height);
    glareX.set(event.clientX - bounds.left);
    glareY.set(event.clientY - bounds.top);
  };

  const resetTilt = () => {
    normalizedX.set(0.5);
    normalizedY.set(0.5);
  };

  return (
    <div className="tilt-scene h-full">
      <motion.article
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        style={reduceMotion ? undefined : { rotateX, rotateY }}
        whileHover={reduceMotion ? undefined : { scale: 1.015, y: -4 }}
        transition={{ type: "spring", ...tiltSpring }}
        className="feature-card tilt-card group relative flex h-full flex-col border border-line bg-panel"
      >
        <div className="tilt-depth-sm relative overflow-hidden border-b border-line">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#1a1a1a,transparent_70%)]"
          />
          <div className="relative aspect-[22/15] w-full p-3">
            {illustration}
          </div>

          <span
            aria-hidden="true"
            className="absolute left-4 top-3 text-[10px] tracking-[0.08em] text-faint"
          >
            {index}
          </span>
        </div>

        <div className="tilt-depth-sm flex flex-1 flex-col p-5">
          <h3 className="flex min-h-[2.6rem] items-start text-[15px] leading-5 font-medium tracking-[-0.02em] text-fg">
            {title}
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-muted">
            {description}
          </p>
        </div>

        <motion.div
          aria-hidden="true"
          style={{ background: glare }}
          className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      </motion.article>
    </div>
  );
};
