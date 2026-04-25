import { CustomStatusManager } from '@/components/settings/custom-status-manager';
import { NotionMapping } from '@/components/settings/notion-mapping';
import { SlackSettings } from '@/components/settings/slack-settings';
import { GCalSettings } from '@/components/settings/gcal-settings';

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <p className="text-sm text-muted-foreground">
          task 관리에 필요한 상태, 연동 서비스를 설정할 수 있습니다.
        </p>
      </div>
      <nav className="flex gap-4 text-sm text-muted-foreground mb-6">
        <a href="#statuses" className="hover:text-foreground transition-colors">상태 관리</a>
        <a href="#notion" className="hover:text-foreground transition-colors">Notion 연동</a>
        <a href="#slack" className="hover:text-foreground transition-colors">Slack 연동</a>
        <a href="#gcal" className="hover:text-foreground transition-colors">Google Calendar</a>
      </nav>
      <div id="statuses"><CustomStatusManager /></div>
      <div id="notion"><NotionMapping /></div>
      <div id="slack"><SlackSettings /></div>
      <div id="gcal"><GCalSettings /></div>
    </div>
  );
}
