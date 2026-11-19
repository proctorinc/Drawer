import { Link } from '@tanstack/react-router';
import { addDays, format } from 'date-fns';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import { ActionStatsChart } from '../components/ActionStatsChart';
import { useActivityLog, useAdminPrompts } from '../api';
import {
  AdminPage,
  Loaded,
  Panel,
  Section,
  StatTile,
  formatDay,
} from '../components/ui';
import { LogRow } from './ActivityPage';

const UPCOMING_DAYS = 14;

/** Days in the next two weeks with no prompt scheduled */
const PromptGaps = () => {
  const prompts = useAdminPrompts();
  return (
    <Loaded query={prompts}>
      {(list) => {
        const scheduled = new Set(list.map((p) => p.day));
        const missing = Array.from({ length: UPCOMING_DAYS }, (_, i) =>
          format(addDays(new Date(), i), 'yyyy-MM-dd'),
        ).filter((day) => !scheduled.has(day));

        return missing.length === 0 ? (
          <p className="text-pencil">
            every day for the next {UPCOMING_DAYS} has a prompt ✓
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {missing.map((day) => (
              <li key={day} className="text-coral">
                {formatDay(day)} has no prompt
              </li>
            ))}
          </ul>
        );
      }}
    </Loaded>
  );
};

const OverviewPage = () => {
  const { dashboardData } = useAdminDashboard();
  const log = useActivityLog();
  const overall = dashboardData?.stats.overall;
  const today = dashboardData?.stats.today;

  return (
    <AdminPage title="overview" subtitle="how drawer is doing right now">
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="players" value={overall?.totalUsers ?? '–'} />
        <StatTile label="drawings" value={overall?.totalDrawings ?? '–'} />
        <StatTile label="reactions" value={overall?.totalReactions ?? '–'} />
        <StatTile label="comments" value={overall?.totalComments ?? '–'} />
        <StatTile
          label="drawings today"
          value={today?.drawingsToday ?? '–'}
          className="bg-butter"
        />
        <StatTile
          label="reactions today"
          value={today?.reactionsToday ?? '–'}
          className="bg-blush"
        />
        <StatTile
          label="comments today"
          value={today?.commentsToday ?? '–'}
          className="bg-sky"
        />
        <StatTile
          label="joined this week"
          value={
            dashboardData ? (dashboardData.stats.recentUsers?.length ?? 0) : '–'
          }
        />
      </div>

      <ActionStatsChart />

      <div className="grid grid-cols-3 gap-8">
        <Section
          title="latest happenings"
          aside={
            <Link to="/draw/admin/activity" className="underline">
              full log →
            </Link>
          }
          className="col-span-2"
        >
          <Panel className="px-4">
            <Loaded query={log}>
              {(entries) => (
                <ul>
                  {entries.slice(0, 10).map((entry, i) => (
                    <LogRow key={i} entry={entry} />
                  ))}
                </ul>
              )}
            </Loaded>
          </Panel>
        </Section>
        <Section
          title="prompt gaps"
          aside={
            <Link to="/draw/admin/prompts" className="underline">
              prompts →
            </Link>
          }
        >
          <PromptGaps />
        </Section>
      </div>
    </AdminPage>
  );
};

export default OverviewPage;
