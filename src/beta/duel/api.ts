import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/api/Api';
import { fetchAPI } from '@/api/apiClient';

/** How a word of a guess, or a keyword of the prompt, fared: green, yellow or gray */
export type MarkStatus = 'hit' | 'close' | 'miss';

export interface WordMark {
  text: string;
  status: MarkStatus;
  note: string;
}

export interface KeywordMark {
  /** '' while it's still secret from you */
  keyword: string;
  status: MarkStatus;
  credit: number;
  note: string;
}

export interface DuelGuess {
  attempt: number;
  guess: string;
  /** 0..100 */
  score: number;
  /** Word for word: the bonus */
  exact: boolean;
  feedback: { words: Array<WordMark>; keywords: Array<KeywordMark> };
  note: string;
  createdAt: string;
}

export interface DuelRound {
  number: 1 | 2;
  drawerId: string;
  guesserId: string;
  /** '' while it's secret from you */
  prompt: string;
  keywords: Array<string>;
  keywordCount: number;
  drawStartedAt: string | null;
  drawDeadline: string | null;
  drawn: boolean;
  /** A data: URL, only on a single duel */
  image: string;
  guesses: Array<DuelGuess>;
  score: number | null;
  finished: boolean;
  finishedAt: string | null;
}

export interface DuelHost {
  id: string;
  name: string;
  avatarUrl: string;
  decoration: string;
}

export type DuelPhase = 'draw' | 'guess' | 'done' | 'expired' | 'cancelled';

export interface Duel {
  id: string;
  status: 'active' | 'done' | 'expired' | 'cancelled';
  challenger: User;
  opponent: User;
  host: DuelHost;
  /** The round being played, or 0 when it's over */
  round: 0 | 1 | 2;
  phase: DuelPhase;
  /** Whose move it is; '' when it's over */
  turnUserId: string;
  otherHereNow: boolean;
  otherSeenAt: string | null;
  nudgeAvailableAt: string | null;
  expiresAt: string | null;
  rounds: Array<DuelRound>;
  combined: number | null;
  complete: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** The server's clock when it answered */
  now: string;
}

export interface DuelList {
  duels: Array<Duel>;
  opponents: Array<User>;
  drawSeconds: number;
  maxGuesses: number;
}

export const DRAW_SECONDS = 60;
export const MAX_GUESSES = 3;

export const duelKeys = {
  all: ['beta', 'duels'] as const,
  one: (id: string) => ['beta', 'duels', id] as const,
};

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchAPI(method, path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(data.error ?? `Request failed (${response.status})`),
      {
        duelId: data.duelId as string | undefined,
      },
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Your duels and who you can challenge. Polls gently so turns show up */
export const useDuels = () =>
  useQuery({
    queryKey: duelKeys.all,
    queryFn: () => call<DuelList>('GET', '/beta/duels'),
    refetchInterval: 15_000,
  });

/**
 * One duel, with its drawings. It polls fast while you're waiting on the other
 * player (so their moves land live, and you count as "here"), slower on your
 * own turn, and stops once it's over and summed up.
 */
export const useDuel = (id: string, userId: string) =>
  useQuery({
    queryKey: duelKeys.one(id),
    queryFn: () => call<Duel>('GET', `/beta/duels/${id}`),
    refetchInterval: (query) => {
      const duel = query.state.data;
      if (!duel) return false;
      if (duel.status !== 'active') return duel.summary ? false : 3000;
      return duel.turnUserId === userId ? 8000 : 3000;
    },
    refetchIntervalInBackground: false,
  });

/** A move on the duel: the answer is the duel as it now stands */
const useDuelMove = <TVars>(
  id: string,
  move: (vars: TVars) => Promise<Duel>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: move,
    onSuccess: (duel) => {
      queryClient.setQueryData(duelKeys.one(id), duel);
      queryClient.invalidateQueries({ queryKey: duelKeys.all, exact: true });
    },
  });
};

export const useStartDrawing = (id: string) =>
  useDuelMove<void>(id, () =>
    call<Duel>('POST', `/beta/duels/${id}/start`, {}),
  );

export const useSubmitDrawing = (id: string) =>
  useDuelMove(id, (image: string) =>
    call<Duel>('POST', `/beta/duels/${id}/drawing`, { image }),
  );

export const useGuess = (id: string) =>
  useDuelMove(id, (guess: string) =>
    call<Duel>('POST', `/beta/duels/${id}/guess`, { guess }),
  );

export const useNudge = (id: string) =>
  useDuelMove<void>(id, () =>
    call<Duel>('POST', `/beta/duels/${id}/nudge`, {}),
  );

export const useCancelDuel = (id: string) =>
  useDuelMove<void>(id, () =>
    call<Duel>('POST', `/beta/duels/${id}/cancel`, {}),
  );

export const useCreateDuel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opponentId: string) =>
      call<Duel>('POST', '/beta/duels', { opponentId }),
    onSuccess: (duel) => {
      queryClient.setQueryData(duelKeys.one(duel.id), duel);
      queryClient.invalidateQueries({ queryKey: duelKeys.all, exact: true });
    },
  });
};

// ---- Admin ----

export interface BetaPlayer {
  user: User;
  isAdmin: boolean;
  addedAt: string | null;
}

export interface AdminBeta {
  players: Array<BetaPlayer>;
  duels: Array<Duel>;
  promptCount: number;
  aiReady: boolean;
}

export const useAdminBeta = () =>
  useQuery({
    queryKey: ['admin', 'beta'],
    queryFn: () => call<AdminBeta>('GET', '/admin/beta'),
  });

export const useSetBetaTester = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, add }: { userId: string; add: boolean }) =>
      add
        ? call<void>('POST', '/admin/beta/testers', { userId })
        : call<void>('DELETE', `/admin/beta/testers/${userId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'beta'] }),
  });
};

// ---- Helpers ----

/** You, the other player, and which side you're on */
export const sides = (duel: Duel, userId: string) => {
  const youChallenged = duel.challenger.id === userId;
  return {
    playing: youChallenged || duel.opponent.id === userId,
    you: youChallenged ? duel.challenger : duel.opponent,
    them: youChallenged ? duel.opponent : duel.challenger,
  };
};

/** The round being played, if any */
export const currentRound = (duel: Duel) =>
  duel.round ? duel.rounds[duel.round - 1] : undefined;

/** How far the server's clock is ahead of this device's, in ms */
export const clockOffset = (duel: Duel) =>
  new Date(duel.now).getTime() - Date.now();

/** A turn is "yours" to play */
export const isYourTurn = (duel: Duel, userId: string) =>
  duel.status === 'active' && duel.turnUserId === userId;

/** The keywords hit so far across every guess, by slot */
export const hitKeywords = (round: DuelRound) => {
  const slots: Array<KeywordMark | null> = Array.from(
    { length: round.keywordCount },
    () => null,
  );
  for (const guess of round.guesses) {
    guess.feedback.keywords.forEach((mark, i) => {
      const best = slots[i];
      if (!best || mark.credit > best.credit) slots[i] = mark;
    });
  }
  return slots;
};
