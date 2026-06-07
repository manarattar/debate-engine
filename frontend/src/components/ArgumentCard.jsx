import { useState } from "react";
import { useAuth, SignInButton } from "@clerk/clerk-react";
import { submitReaction } from "../api";

const SIDE_STYLES = {
  pro: {
    accent: "border-l-4 border-sky-500",
    labelColor: "text-sky-400",
    label: "PROPOSITION",
    citationBg: "bg-sky-900/20 border-sky-800/30",
    animClass: "argument-pro",
    reactionLike: "bg-sky-900/50 border-sky-500/50 text-sky-400",
    reactionDislike: "bg-rose-900/50 border-rose-500/50 text-rose-400",
  },
  con: {
    accent: "border-l-4 border-rose-500",
    labelColor: "text-rose-400",
    label: "OPPOSITION",
    citationBg: "bg-rose-900/20 border-rose-800/30",
    animClass: "argument-con",
    reactionLike: "bg-sky-900/50 border-sky-500/50 text-sky-400",
    reactionDislike: "bg-rose-900/50 border-rose-500/50 text-rose-400",
  },
};

const ROUND_LABELS = {
  opening: "Opening Statement",
  rebuttal: "Rebuttal",
  cross_pro_questions: "Cross-Examination",
  cross_con_answers: "Cross-Examination Response",
  cross_con_questions: "Cross-Examination",
  cross_pro_answers: "Cross-Examination Response",
  closing: "Closing Statement",
  verdict: "Ruling",
};

const ROUND_NUMERALS = {
  opening: "I",
  rebuttal: "II",
  closing: "III",
};

const SCOREABLE_ROUNDS = new Set(["opening", "rebuttal", "closing"]);

function getSessionId() {
  let id = sessionStorage.getItem("debate_session_id");
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    sessionStorage.setItem("debate_session_id", id);
  }
  return id;
}

function ScoreBadge({ score }) {
  const color =
    score >= 8
      ? "text-sky-400 border-sky-500/40"
      : score >= 5
        ? "text-amber-400 border-amber-500/40"
        : "text-rose-400 border-rose-500/40";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${color}`}>
      {score}/10
    </span>
  );
}

function ReactionButtons({ debateId, side, round_name, initialReactions, styles }) {
  const { isSignedIn, getToken } = useAuth();
  const [myReaction, setMyReaction] = useState(null);
  const [likes, setLikes] = useState(initialReactions?.likes ?? 0);
  const [dislikes, setDislikes] = useState(initialReactions?.dislikes ?? 0);

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="text-xs text-slate-600 hover:text-slate-400 transition-colors pt-1">
          Sign in to react
        </button>
      </SignInButton>
    );
  }

  const handleReact = async (reaction) => {
    const sessionId = getSessionId();
    const prev = myReaction;
    const isToggleOff = prev === reaction;

    if (isToggleOff) {
      setMyReaction(null);
      reaction === "like" ? setLikes((n) => n - 1) : setDislikes((n) => n - 1);
    } else {
      if (prev === "like") setLikes((n) => n - 1);
      if (prev === "dislike") setDislikes((n) => n - 1);
      setMyReaction(reaction);
      reaction === "like" ? setLikes((n) => n + 1) : setDislikes((n) => n + 1);
    }

    try {
      const token = await getToken();
      await submitReaction(debateId, side, round_name, reaction, sessionId, token);
    } catch {
      setMyReaction(prev);
      setLikes(initialReactions?.likes ?? 0);
      setDislikes(initialReactions?.dislikes ?? 0);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        onClick={() => handleReact("like")}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors
          ${myReaction === "like"
            ? styles.reactionLike
            : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"}`}
      >
        👍 {likes > 0 && <span>{likes}</span>}
      </button>
      <button
        onClick={() => handleReact("dislike")}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors
          ${myReaction === "dislike"
            ? styles.reactionDislike
            : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"}`}
      >
        👎 {dislikes > 0 && <span>{dislikes}</span>}
      </button>
    </div>
  );
}

export default function ArgumentCard({
  side,
  round_name,
  content,
  citations = [],
  streaming = false,
  score,
  debateId,
  reactions,
}) {
  const [showCitations, setShowCitations] = useState(false);
  const styles = SIDE_STYLES[side] || SIDE_STYLES.pro;
  const reactionKey = `${side}_${round_name}`;
  const showReactions = debateId && !streaming && SCOREABLE_ROUNDS.has(round_name);
  const numeral = ROUND_NUMERALS[round_name];

  return (
    <div className={`${styles.accent} ${streaming ? "" : styles.animClass} pl-5 pr-4 py-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold uppercase tracking-widest ${styles.labelColor}`}>
            {styles.label}
          </span>
          {numeral && (
            <span className="text-slate-600 text-xs font-mono">— {numeral}</span>
          )}
          <span className="text-slate-500 text-xs tracking-wide">
            {ROUND_LABELS[round_name] || round_name}
          </span>
          {score !== undefined && <ScoreBadge score={score} />}
        </div>
        {citations.length > 0 && (
          <button
            onClick={() => setShowCitations(!showCitations)}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors tabular-nums"
          >
            {citations.length} source{citations.length !== 1 ? "s" : ""} {showCitations ? "▲" : "▼"}
          </button>
        )}
      </div>

      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
        {streaming && <span className="animate-pulse text-amber-400">▌</span>}
      </p>

      {showReactions && (
        <ReactionButtons
          debateId={debateId}
          side={side}
          round_name={round_name}
          initialReactions={reactions?.[reactionKey]}
          styles={styles}
        />
      )}

      {showCitations && citations.length > 0 && (
        <div className={`border-l-2 ${styles.accent.split(" ")[1]} pl-3 flex flex-col gap-2 ml-1`}>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sources</p>
          {citations.map((c, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-slate-600 font-mono shrink-0">[{c.index}]</span>
              <div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 underline block truncate max-w-xs"
                >
                  {c.title || c.url}
                </a>
                <p className="text-slate-500 mt-0.5 line-clamp-2">{c.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
