import { Link } from '@tanstack/react-router';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import {
  useAcceptSuggestion,
  useAdminEvents,
  useAdminPrompts,
  useDismissSuggestion,
} from '../api';
import { AdminPage, Loaded, Section } from '../components/ui';
import { NewPrompt, PromptDraft } from '../components/PromptDraft';
import { toDay } from '../schedule';
import type { Calendar } from '../components/PromptDraft';
import type { FC } from 'react';
import type { PromptSuggestion } from '@/api/Api';

const SuggestionDraft: FC<{
  suggestion: PromptSuggestion;
  calendar: Calendar;
}> = ({ suggestion, calendar }) => {
  const accept = useAcceptSuggestion();
  const dismiss = useDismissSuggestion();
  return (
    <PromptDraft
      calendar={calendar}
      initialPrompt={suggestion.prompt}
      suggester={suggestion.createdBy}
      scheduleLabel="accept"
      onSchedule={(draft) =>
        accept.mutateAsync({ id: suggestion.id, ...draft })
      }
      onDismiss={() => {
        if (
          window.confirm(`Dismiss "${suggestion.prompt}"? It can't be undone.`)
        ) {
          dismiss.mutate(suggestion.id);
        }
      }}
    />
  );
};

const SuggestionsPage = () => {
  const { promptSuggestions } = useAdminDashboard();
  const prompts = useAdminPrompts();
  const events = useAdminEvents().data ?? [];

  return (
    <AdminPage
      title="suggestions"
      subtitle="tweak what players suggested, give it colors, and drop it on a day"
      actions={
        <Link to="/draw/admin/prompts" search={{}} className="underline">
          see the schedule →
        </Link>
      }
    >
      <Loaded query={prompts}>
        {(list) => {
          const calendar: Calendar = {
            taken: new Set(list.map((p) => p.day)),
            events,
            firstDay: toDay(new Date()),
          };
          return (
            <>
              <Section title="write your own">
                <NewPrompt calendar={calendar} />
              </Section>
              <Section
                title="from players"
                aside={`${promptSuggestions?.length ?? 0} waiting`}
              >
                {promptSuggestions?.length ? (
                  promptSuggestions.map((s) => (
                    <SuggestionDraft
                      key={s.id}
                      suggestion={s}
                      calendar={calendar}
                    />
                  ))
                ) : (
                  <p className="text-pencil">no suggestions waiting</p>
                )}
              </Section>
            </>
          );
        }}
      </Loaded>
    </AdminPage>
  );
};

export default SuggestionsPage;
