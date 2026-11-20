import type { StageComponent } from './types';
import { JudgeIntroPlayer } from '@/ai/JudgeIntro';

/** Today's judge asking you to draw today's prompt */
export const JudgeIntroStage: StageComponent<'judgeIntro'> = ({
  payload,
  onDone,
}) => <JudgeIntroPlayer intro={payload.intro} onDone={onDone} />;
