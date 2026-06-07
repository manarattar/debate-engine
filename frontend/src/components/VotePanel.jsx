import { useEffect, useState } from "react";
import { useAuth, SignInButton } from "@clerk/clerk-react";
import { getVotes, submitVote } from "../api";

function getSessionId() {
  let id = sessionStorage.getItem("debate_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("debate_session_id", id);
  }
  return id;
}

function TallyBar({ pro, con, total, label }) {
  const proPct = total > 0 ? Math.round((pro / total) * 100) : 50;
  const conPct = 100 - proPct;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-slate-500 text-center">{label}</p>
      <div className="flex rounded-full overflow-hidden h-3">
        <div
          className="bg-sky-500 transition-all duration-500"
          style={{ width: `${proPct}%` }}
        />
        <div
          className="bg-rose-500 transition-all duration-500"
          style={{ width: `${conPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span className="text-sky-400">PRO {proPct}%</span>
        <span className="text-slate-500">{total} vote{total !== 1 ? "s" : ""}</span>
        <span className="text-rose-400">{conPct}% CON</span>
      </div>
    </div>
  );
}

export default function VotePanel({ debateId, phase, topic }) {
  const { isSignedIn, getToken } = useAuth();
  const [voted, setVoted] = useState(false);
  const [tally, setTally] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!debateId) return;
    getVotes(debateId).then(setTally).catch(() => {});
  }, [debateId, voted]);

  const handleVote = async (side) => {
    try {
      const token = await getToken();
      await submitVote(debateId, phase, side, getSessionId(), token);
      setVoted(true);
    } catch (err) {
      if (err?.response?.status === 409) {
        setVoted(true);
      } else {
        setError("Could not save vote.");
      }
    }
  };

  const phaseTally = tally?.[phase];

  return (
    <div className="border border-amber-500/20 bg-amber-950/20 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-sm font-medium text-amber-300 text-center">
        {phase === "before" ? "🗳 Who do you think will win?" : "🏆 Who won the debate?"}
      </p>

      {!voted ? (
        !isSignedIn ? (
          <SignInButton mode="modal">
            <button className="w-full py-2 rounded-lg border border-amber-500/40 text-amber-400 text-sm font-medium hover:bg-amber-900/30 transition-colors">
              Sign in to vote
            </button>
          </SignInButton>
        ) : (
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => handleVote("pro")}
            className="flex-1 py-2 rounded-lg bg-sky-700/40 hover:bg-sky-600/50 border border-sky-600/40 text-sky-300 text-sm font-semibold transition-colors"
          >
            ✓ PRO
          </button>
          <button
            onClick={() => handleVote("con")}
            className="flex-1 py-2 rounded-lg bg-rose-700/40 hover:bg-rose-600/50 border border-rose-600/40 text-rose-300 text-sm font-semibold transition-colors"
          >
            ✗ CON
          </button>
        </div>
        )
      ) : phaseTally ? (
        <TallyBar
          pro={phaseTally.pro}
          con={phaseTally.con}
          total={phaseTally.total}
          label="Community votes"
        />
      ) : (
        <p className="text-xs text-slate-500 text-center">Vote recorded!</p>
      )}

      {tally?.before?.total > 0 && tally?.after?.total > 0 && phase === "after" && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-700/50">
          <TallyBar
            pro={tally.before.pro}
            con={tally.before.con}
            total={tally.before.total}
            label="Before debate"
          />
          <TallyBar
            pro={tally.after.pro}
            con={tally.after.con}
            total={tally.after.total}
            label="After debate"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}
