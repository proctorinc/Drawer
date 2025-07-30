import { useState, type FC } from 'react';
import Button from './Button';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

type TabsProps = {
  defaultValue: string;
  children: React.ReactNode;
};

const Tabs: FC<TabsProps> = ({ defaultValue, children }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  return (
    <div className="flex justify-center w-full gap-3 px-4">{children}</div>
  );
};

type TabProps = {
  value: string;
  icon: IconDefinition;
  children: React.ReactNode;
};

export const Tab: FC<TabProps> = ({ value, icon, children }) => {
  return (
    <div className="w-1/2">
      <Button
        icon={icon}
        size="sm"
        // variant={tab === 'invitations' ? 'base' : 'primary'}
        className=" disabled:text-primary w-full h-10"
        // onClick={() => setTab('activity')}
        disableLoad
      >
        Profile
      </Button>
    </div>
  );
};

type TabContentProps = {
  value: string;
  children: React.ReactNode;
};

export const TabContent: FC<TabContentProps> = ({ value, children }) => {
  return <div id={value}>{children}</div>;
};

export default Tabs;
